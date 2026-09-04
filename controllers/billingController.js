const Invoice = require("../models/Invoice");
const AppointmentToken = require("../models/appointmentToken");
const MedicalRecord = require("../models/medicalRecord");
// const MedicalRecord = require("../models/medicalRecord");
const LabReport = require("../models/LabReport");
const PharmacySale = require("../models/pharmacySale");
const User = require("../models/User");
const PatientProfile = require("../models/patientProfile");
const Department = require("../models/Department");

const PAYMENT_METHODS = ["Cash", "Card", "Insurance", "Online"];

const getNextInvoiceNumber = async () => {
  const year = new Date().getFullYear();

  const latestInvoice = await Invoice.findOne({
    invoiceNumber: new RegExp(`^INV-${year}-`),
  })
    .sort({ createdAt: -1 })
    .select("invoiceNumber");

  let nextSequence = 1;

  if (latestInvoice?.invoiceNumber) {
    const previousSequence = Number(
      latestInvoice.invoiceNumber.split("-").pop(),
    );

    if (!Number.isNaN(previousSequence)) {
      nextSequence = previousSequence + 1;
    }
  }

  return `INV-${year}-${String(nextSequence).padStart(5, "0")}`;
};

const populateInvoice = async (invoiceId) => {
  return Invoice.findById(invoiceId)
    .populate("patient", "patientId name phone")
    .populate(
      "token",
      "displayToken tokenNumber department departmentRef visitDate status",
    )
    .populate("medicalRecord", "chiefComplaints diagnosis")
    .populate("billingOfficer", "name email")
    .populate("payments.receivedBy", "name email");
};

const calculateInvoiceCharges = async (token, medicalRecord) => {
  const department =
    token.departmentRef ||
    (await Department.findOne({ name: token.department }));

  const consultationFee = Number(department?.consultationFee || 0);

  const [labReports, pharmacySales] = await Promise.all([
    LabReport.find({
      medicalRecord: medicalRecord._id,
    }).select("_id testName testFee"),
    PharmacySale.find({
      medicalRecord: medicalRecord._id,
    }).select("_id saleNumber totalAmount"),
  ]);

  const labFee = labReports.reduce(
    (total, report) => total + Number(report.testFee || 0),
    0,
  );

  const pharmacyFee = pharmacySales.reduce(
    (total, sale) => total + Number(sale.totalAmount || 0),
    0,
  );

  const invoiceItems = [
    {
      type: "Consultation",
      title: `${department?.name || token.department || "OPD"} Consultation`,
      referenceId: department?._id || null,
      quantity: 1,
      unitPrice: consultationFee,
      amount: consultationFee,
    },
    ...labReports.map((report) => ({
      type: "Lab",
      title: report.testName,
      referenceId: report._id,
      quantity: 1,
      unitPrice: Number(report.testFee || 0),
      amount: Number(report.testFee || 0),
    })),
    ...pharmacySales.map((sale) => ({
      type: "Pharmacy",
      title: `Pharmacy Receipt ${sale.saleNumber || ""}`.trim(),
      referenceId: sale._id,
      quantity: 1,
      unitPrice: Number(sale.totalAmount || 0),
      amount: Number(sale.totalAmount || 0),
    })),
  ];

  return {
    consultationFee,
    labFee,
    pharmacyFee,
    grossTotal: consultationFee + labFee + pharmacyFee,
    invoiceItems,
    labReports,
  };
};

const getAllBillingPatients = async (req, res) => {
  try {
    const { billingStage, paymentStatus, patient, date } = req.query;

    const tokenFilter = {};

    if (patient) {
      tokenFilter.patient = patient;
    }

    if (date) {
      const selectedDate = new Date(date);

      if (Number.isNaN(selectedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid billing date",
        });
      }

      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      tokenFilter.visitDate = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    const tokens = await AppointmentToken.find(tokenFilter)
      .populate("patient", "patientId name phone age gender")
      .populate("doctor", "name")
      .populate("departmentRef", "name code consultationFee")
      .sort({ createdAt: -1 });

    const billingCases = await Promise.all(
      tokens.map(async (token) => {
        const [medicalRecord, invoice] = await Promise.all([
          MedicalRecord.findOne({
            token: token._id,
          }),
          Invoice.findOne({
            token: token._id,
          }),
        ]);

        let currentBillingStage = "Awaiting Consultation";

        if (token.status === "Cancelled") {
          currentBillingStage = "Cancelled";
        } else if (token.status === "Completed" && !medicalRecord) {
          currentBillingStage = "Medical Record Missing";
        } else if (token.status === "Completed" && medicalRecord && !invoice) {
          currentBillingStage = "Ready for Billing";
        } else if (invoice?.paymentStatus === "Unpaid") {
          currentBillingStage = "Invoice Unpaid";
        } else if (invoice?.paymentStatus === "Partial") {
          currentBillingStage = "Partial Payment";
        } else if (invoice?.paymentStatus === "Paid") {
          currentBillingStage = "Paid";
        }

        return {
          tokenId: token._id,
          patientId: token.patient?._id || null,
          medicalRecordId: medicalRecord?._id || null,
          invoiceId: invoice?._id || null,

          name: token.patient?.name || "Unknown Patient",
          phone: token.patient?.phone || "No Phone",
          uhid: token.patient?.patientId || "N/A",

          tokenNumber: token.tokenNumber,
          displayToken:
            token.displayToken ||
            `${token.department || "OPD"}-${String(
              token.tokenNumber || 0,
            ).padStart(3, "0")}`,

          department:
            token.departmentRef?.name || token.department || "General OPD",
          departmentCode: token.departmentRef?.code || "",
          doctorName: token.doctor?.name || "Assigned Doctor",

          visitStatus: token.status,
          billingStage: currentBillingStage,

          invoiceNumber: invoice?.invoiceNumber || null,
          consultationFee: invoice?.consultationFee || 0,
          labFee: invoice?.labFee || 0,
          pharmacyFee: invoice?.pharmacyFee || 0,
          grossTotal: invoice?.grossTotal || 0,
          amountPaid: invoice?.amountPaid || 0,
          remainingBalance: invoice?.remainingBalance || 0,
          paymentStatus: invoice?.paymentStatus || "Not Generated",
          paymentMethod: invoice?.paymentMethod || "Pending",
        };
      }),
    );

    const filteredCases = billingCases.filter((billingCase) => {
      const matchesStage =
        !billingStage || billingCase.billingStage === billingStage;

      const matchesPayment =
        !paymentStatus || billingCase.paymentStatus === paymentStatus;

      return matchesStage && matchesPayment;
    });

    return res.status(200).json({
      success: true,
      count: filteredCases.length,
      data: filteredCases,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch billing patients",
    });
  }
};

const generateInvoiceSummary = async (req, res) => {
  try {
    const { tokenId, refreshCharges = false } = req.body;

    if (!tokenId) {
      return res.status(400).json({
        success: false,
        message: "Appointment token id is required",
      });
    }

    const token = await AppointmentToken.findById(tokenId)
      .populate("patient", "patientId name phone")
      .populate("departmentRef", "name code consultationFee");

    if (!token) {
      return res.status(404).json({
        success: false,
        message: "Appointment token was not found",
      });
    }

    if (token.status !== "Completed") {
      return res.status(400).json({
        success: false,
        message:
          "Invoice can only be generated after the clinical consultation is completed",
      });
    }

    const medicalRecord = await MedicalRecord.findOne({
      token: token._id,
    });

    if (!medicalRecord) {
      return res.status(404).json({
        success: false,
        message: "Medical record was not found for this appointment token",
      });
    }

    const existingInvoice = await Invoice.findOne({
      token: token._id,
    });

    if (existingInvoice && !refreshCharges) {
      const populatedInvoice = await populateInvoice(existingInvoice._id);

      return res.status(200).json({
        success: true,
        message:
          existingInvoice.paymentStatus === "Paid"
            ? "This encounter invoice has already been settled"
            : "Existing invoice loaded successfully",
        data: populatedInvoice,
      });
    }

    if (existingInvoice?.paymentStatus === "Paid") {
      return res.status(400).json({
        success: false,
        message:
          "A paid invoice cannot be recalculated. Create an adjustment workflow for later changes.",
      });
    }

    const chargeSummary = await calculateInvoiceCharges(token, medicalRecord);

    let invoice;

    if (existingInvoice) {
      const newRemainingBalance = Math.max(
        chargeSummary.grossTotal - existingInvoice.amountPaid,
        0,
      );

      existingInvoice.invoiceItems = chargeSummary.invoiceItems;
      existingInvoice.consultationFee = chargeSummary.consultationFee;
      existingInvoice.labFee = chargeSummary.labFee;
      existingInvoice.pharmacyFee = chargeSummary.pharmacyFee;
      existingInvoice.grossTotal = chargeSummary.grossTotal;
      existingInvoice.remainingBalance = newRemainingBalance;
      existingInvoice.paymentStatus =
        existingInvoice.amountPaid === 0
          ? "Unpaid"
          : newRemainingBalance === 0
            ? "Paid"
            : "Partial";

      await existingInvoice.save();
      invoice = existingInvoice;
    } else {
      const invoiceNumber = await getNextInvoiceNumber();

      invoice = await Invoice.create({
        invoiceNumber,
        patient: token.patient._id,
        token: token._id,
        medicalRecord: medicalRecord._id,
        invoiceItems: chargeSummary.invoiceItems,
        consultationFee: chargeSummary.consultationFee,
        labFee: chargeSummary.labFee,
        pharmacyFee: chargeSummary.pharmacyFee,
        grossTotal: chargeSummary.grossTotal,
        amountPaid: 0,
        remainingBalance: chargeSummary.grossTotal,
        paymentMethod: "Pending",
        paymentStatus: "Unpaid",
      });
    }

    if (chargeSummary.labReports.length > 0) {
      await LabReport.updateMany(
        {
          _id: {
            $in: chargeSummary.labReports.map((report) => report._id),
          },
        },
        {
          billedInInvoice: invoice._id,
        },
      );
    }

    const populatedInvoice = await populateInvoice(invoice._id);

    return res.status(existingInvoice ? 200 : 201).json({
      success: true,
      message: existingInvoice
        ? "Invoice charges refreshed successfully"
        : "Centralized billing invoice generated successfully",
      data: populatedInvoice,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "An invoice already exists for this appointment encounter. Please refresh the billing queue.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate invoice",
    });
  }
};

const settlePaymentInvoice = async (req, res) => {
  try {
    const { paymentMethod, amount, paymentReference } = req.body;

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Please identify a valid payment settlement method",
      });
    }

    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payment amount must be greater than zero",
      });
    }

    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Target invoice record was not found",
      });
    }

    if (invoice.paymentStatus === "Paid") {
      return res.status(400).json({
        success: false,
        message: "This invoice has already been settled",
      });
    }

    if (paymentAmount > invoice.remainingBalance) {
      return res.status(400).json({
        success: false,
        message: `Payment cannot exceed the remaining balance of ${invoice.remainingBalance}`,
      });
    }

    invoice.amountPaid += paymentAmount;
    invoice.remainingBalance = Math.max(
      invoice.grossTotal - invoice.amountPaid,
      0,
    );
    invoice.paymentMethod = paymentMethod;
    invoice.paymentReference = paymentReference?.trim() || "";
    invoice.billingOfficer = req.user._id;

    invoice.payments.push({
      amount: paymentAmount,
      paymentMethod,
      paymentReference: paymentReference?.trim() || "",
      receivedBy: req.user._id,
      receivedAt: new Date(),
    });

    invoice.paymentStatus =
      invoice.remainingBalance === 0 ? "Paid" : "Partial";

    await invoice.save();

    const populatedInvoice = await populateInvoice(invoice._id);

    return res.status(200).json({
      success: true,
      message:
        invoice.paymentStatus === "Paid"
          ? "Hospital bill cleared and settlement processed successfully"
          : "Partial payment recorded successfully",
      data: populatedInvoice,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to settle invoice payment",
    });
  }
};

const getInvoices = async (req, res) => {
  try {
    const {
      patient,
      paymentStatus,
      paymentMethod,
      startDate,
      endDate,
    } = req.query;

    const filter = {};

    if (patient) {
      filter.patient = patient;
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const invoices = await Invoice.find(filter)
      .populate("patient", "patientId name phone")
      .populate(
        "token",
        "displayToken tokenNumber department departmentRef visitDate",
      )
      .populate("medicalRecord", "chiefComplaints diagnosis")
      .populate("billingOfficer", "name")
      .populate("payments.receivedBy", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: invoices.length,
      data: invoices,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch invoice records",
    });
  }
};

const getHospitalDashboardData = async (req, res) => {
  try {
    const [
      totalPatients,
      totalStaff,
      completedAppointments,
      paidInvoiceSummary,
      unpaidInvoiceSummary,
      pharmacySalesSummary,
    ] = await Promise.all([
      PatientProfile.countDocuments({}),
      User.countDocuments({
        role: {
          $ne: "super_admin",
        },
      }),
      AppointmentToken.countDocuments({
        status: "Completed",
      }),
      Invoice.aggregate([
        {
          $match: {
            paymentStatus: "Paid",
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$amountPaid",
            },
          },
        },
      ]),
      Invoice.aggregate([
        {
          $match: {
            paymentStatus: {
              $in: ["Unpaid", "Partial"],
            },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$remainingBalance",
            },
          },
        },
      ]),
      PharmacySale.aggregate([
        {
          $group: {
            _id: null,
            total: {
              $sum: "$totalAmount",
            },
          },
        },
      ]),
    ]);

    const revenueCollected =
      paidInvoiceSummary.length > 0 ? paidInvoiceSummary[0].total : 0;

    const outstandingBalance =
      unpaidInvoiceSummary.length > 0 ? unpaidInvoiceSummary[0].total : 0;

    const pharmacySalesTotal =
      pharmacySalesSummary.length > 0
        ? pharmacySalesSummary[0].total
        : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalPatientsRegistered: totalPatients,
        totalHospitalStaffAccounts: totalStaff,
        completedConsultationsCount: completedAppointments,
        netFinancialRevenueCollected: revenueCollected,
        outstandingBalance,
        pharmacySalesTotal,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch dashboard analytics",
    });
  }
};

module.exports = {
  getAllBillingPatients,
  generateInvoiceSummary,
  settlePaymentInvoice,
  getInvoices,
  getHospitalDashboardData,
};