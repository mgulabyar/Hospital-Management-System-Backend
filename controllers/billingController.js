const Invoice = require("../models/Invoice");
const AppointmentToken = require("../models/appointmentToken");
const MedicalRecord = require("../models/MedicalRecord");
const LabReport = require("../models/LabReport");
const PharmacySale = require("../models/PharmacySale");
const User = require("../models/User");
const PatientProfile = require("../models/patientProfile");
const Department = require("../models/Department");
const Appointment = require("../models/Appointment");
const MedicineInventory = require("../models/medicineInventory");
const { createAuditLog } = require("../utils/auditLogger");

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
      await createAuditLog({
        req,
        action: "GENERATE_INVOICE",
        module: "BILLING",
        description:
          "Invoice generation failed because appointment token id was missing",
        status: "FAILURE",
      });

      return res.status(400).json({
        success: false,
        message: "Appointment token id is required",
      });
    }

    const token = await AppointmentToken.findById(tokenId)
      .populate("patient", "patientId name phone")
      .populate("departmentRef", "name code consultationFee");

    if (!token) {
      await createAuditLog({
        req,
        action: "GENERATE_INVOICE",
        module: "BILLING",
        description: `Invoice generation failed because token ${tokenId} was not found`,
        status: "FAILURE",
        metadata: {
          tokenId,
        },
      });

      return res.status(404).json({
        success: false,
        message: "Appointment token was not found",
      });
    }

    if (token.status !== "Completed") {
      await createAuditLog({
        req,
        action: "GENERATE_INVOICE",
        module: "BILLING",
        description: `Invoice generation rejected because token ${token.displayToken} is ${token.status}`,
        status: "FAILURE",
        entityType: "AppointmentToken",
        entityId: token._id,
        metadata: {
          displayToken: token.displayToken,
          visitStatus: token.status,
        },
      });

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
      await createAuditLog({
        req,
        action: "GENERATE_INVOICE",
        module: "BILLING",
        description: `Invoice generation failed because medical record is missing for token ${token.displayToken}`,
        status: "FAILURE",
        entityType: "AppointmentToken",
        entityId: token._id,
        metadata: {
          displayToken: token.displayToken,
        },
      });

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

      await createAuditLog({
        req,
        action: "LOAD_INVOICE",
        module: "BILLING",
        description: `Existing invoice ${existingInvoice.invoiceNumber} loaded for token ${token.displayToken}`,
        status: "SUCCESS",
        entityType: "Invoice",
        entityId: existingInvoice._id,
        metadata: {
          invoiceNumber: existingInvoice.invoiceNumber,
          displayToken: token.displayToken,
          paymentStatus: existingInvoice.paymentStatus,
        },
      });

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
      await createAuditLog({
        req,
        action: "REFRESH_INVOICE",
        module: "BILLING",
        description: `Invoice refresh rejected because invoice ${existingInvoice.invoiceNumber} is already paid`,
        status: "FAILURE",
        entityType: "Invoice",
        entityId: existingInvoice._id,
        metadata: {
          invoiceNumber: existingInvoice.invoiceNumber,
        },
      });

      return res.status(400).json({
        success: false,
        message:
          "A paid invoice cannot be recalculated. Create an adjustment workflow for later changes.",
      });
    }

    const chargeSummary = await calculateInvoiceCharges(token, medicalRecord);

    let invoice;
    let invoiceAction;

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
      invoiceAction = "REFRESH_INVOICE";
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

      invoiceAction = "GENERATE_INVOICE";
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

    await createAuditLog({
      req,
      action: invoiceAction,
      module: "BILLING",
      description: `Invoice ${invoice.invoiceNumber} ${
        existingInvoice ? "refreshed" : "generated"
      } for token ${token.displayToken}`,
      status: "SUCCESS",
      entityType: "Invoice",
      entityId: invoice._id,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        displayToken: token.displayToken,
        patientName: token.patient?.name || "Unknown Patient",
        consultationFee: invoice.consultationFee,
        labFee: invoice.labFee,
        pharmacyFee: invoice.pharmacyFee,
        grossTotal: invoice.grossTotal,
        remainingBalance: invoice.remainingBalance,
      },
    });

    return res.status(existingInvoice ? 200 : 201).json({
      success: true,
      message: existingInvoice
        ? "Invoice charges refreshed successfully"
        : "Centralized billing invoice generated successfully",
      data: populatedInvoice,
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "GENERATE_INVOICE",
      module: "BILLING",
      description: "Invoice generation failed due to a server error",
      status: "FAILURE",
      metadata: {
        tokenId: req.body?.tokenId || null,
        error: error.message,
      },
    });

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
      await createAuditLog({
        req,
        action: "SETTLE_INVOICE_PAYMENT",
        module: "BILLING",
        description:
          "Invoice payment failed because an invalid payment method was submitted",
        status: "FAILURE",
        metadata: {
          invoiceId: req.params.id,
          paymentMethod: paymentMethod || "",
        },
      });

      return res.status(400).json({
        success: false,
        message: "Please identify a valid payment settlement method",
      });
    }

    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      await createAuditLog({
        req,
        action: "SETTLE_INVOICE_PAYMENT",
        module: "BILLING",
        description:
          "Invoice payment failed because payment amount was invalid",
        status: "FAILURE",
        metadata: {
          invoiceId: req.params.id,
          amount,
        },
      });

      return res.status(400).json({
        success: false,
        message: "Payment amount must be greater than zero",
      });
    }

    const invoice = await Invoice.findById(req.params.id).populate(
      "patient",
      "patientId name",
    );

    if (!invoice) {
      await createAuditLog({
        req,
        action: "SETTLE_INVOICE_PAYMENT",
        module: "BILLING",
        description: `Invoice payment failed because invoice ${req.params.id} was not found`,
        status: "FAILURE",
        metadata: {
          invoiceId: req.params.id,
        },
      });

      return res.status(404).json({
        success: false,
        message: "Target invoice record was not found",
      });
    }

    if (invoice.paymentStatus === "Paid") {
      await createAuditLog({
        req,
        action: "SETTLE_INVOICE_PAYMENT",
        module: "BILLING",
        description: `Invoice payment rejected because ${invoice.invoiceNumber} is already paid`,
        status: "FAILURE",
        entityType: "Invoice",
        entityId: invoice._id,
        metadata: {
          invoiceNumber: invoice.invoiceNumber,
        },
      });

      return res.status(400).json({
        success: false,
        message: "This invoice has already been settled",
      });
    }

    if (paymentAmount > invoice.remainingBalance) {
      await createAuditLog({
        req,
        action: "SETTLE_INVOICE_PAYMENT",
        module: "BILLING",
        description: `Invoice payment rejected because amount exceeds remaining balance for ${invoice.invoiceNumber}`,
        status: "FAILURE",
        entityType: "Invoice",
        entityId: invoice._id,
        metadata: {
          invoiceNumber: invoice.invoiceNumber,
          attemptedAmount: paymentAmount,
          remainingBalance: invoice.remainingBalance,
        },
      });

      return res.status(400).json({
        success: false,
        message: `Payment cannot exceed the remaining balance of ${invoice.remainingBalance}`,
      });
    }

    const previousPaymentStatus = invoice.paymentStatus;
    const previousAmountPaid = invoice.amountPaid;
    const previousRemainingBalance = invoice.remainingBalance;

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

    invoice.paymentStatus = invoice.remainingBalance === 0 ? "Paid" : "Partial";

    await invoice.save();

    const populatedInvoice = await populateInvoice(invoice._id);

    await createAuditLog({
      req,
      action: "SETTLE_INVOICE_PAYMENT",
      module: "BILLING",
      description: `${invoice.paymentStatus === "Paid" ? "Full" : "Partial"} payment of ${paymentAmount} recorded for invoice ${invoice.invoiceNumber}`,
      status: "SUCCESS",
      entityType: "Invoice",
      entityId: invoice._id,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        patientName: invoice.patient?.name || "Unknown Patient",
        paymentMethod,
        paymentAmount,
        paymentReference: paymentReference?.trim() || "",
        previousPaymentStatus,
        currentPaymentStatus: invoice.paymentStatus,
        previousAmountPaid,
        currentAmountPaid: invoice.amountPaid,
        previousRemainingBalance,
        currentRemainingBalance: invoice.remainingBalance,
      },
    });

    return res.status(200).json({
      success: true,
      message:
        invoice.paymentStatus === "Paid"
          ? "Hospital bill cleared and settlement processed successfully"
          : "Partial payment recorded successfully",
      data: populatedInvoice,
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "SETTLE_INVOICE_PAYMENT",
      module: "BILLING",
      description: "Invoice payment settlement failed due to a server error",
      status: "FAILURE",
      metadata: {
        invoiceId: req.params.id,
        error: error.message,
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to settle invoice payment",
    });
  }
};

const getInvoices = async (req, res) => {
  try {
    const { patient, paymentStatus, paymentMethod, startDate, endDate } =
      req.query;

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
    const { date } = req.query;

    const selectedDate = date ? new Date(date) : new Date();

    if (Number.isNaN(selectedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid dashboard date",
      });
    }

    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const [
      totalPatients,
      totalStaff,
      activeStaff,
      completedConsultations,
      pendingVisits,
      inConsultationVisits,
      completedVisitsToday,
      scheduledAppointments,
      checkedInAppointments,
      completedAppointments,
      cancelledAppointments,
      noShowAppointments,
      pendingLabTests,
      lowStockMedicines,
      paidInvoiceSummary,
      outstandingInvoiceSummary,
      pharmacySalesSummary,
      departmentVisitSummary,
      doctorWorkloadSummary,
      revenueBreakdownSummary,
    ] = await Promise.all([
      PatientProfile.countDocuments({}),

      User.countDocuments({
        role: {
          $ne: "super_admin",
        },
      }),

      User.countDocuments({
        role: {
          $ne: "super_admin",
        },
        isActive: true,
      }),

      AppointmentToken.countDocuments({
        status: "Completed",
      }),

      AppointmentToken.countDocuments({
        status: "Pending",
        visitDate: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      }),

      AppointmentToken.countDocuments({
        status: "In-Consultation",
        visitDate: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      }),

      AppointmentToken.countDocuments({
        status: "Completed",
        visitDate: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      }),

      Appointment.countDocuments({
        status: "Scheduled",
        appointmentDate: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      }),

      Appointment.countDocuments({
        status: "Checked-In",
        appointmentDate: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      }),

      Appointment.countDocuments({
        status: "Completed",
        appointmentDate: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      }),

      Appointment.countDocuments({
        status: "Cancelled",
        appointmentDate: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      }),

      Appointment.countDocuments({
        status: "No-Show",
        appointmentDate: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      }),

      LabReport.countDocuments({
        status: "Pending",
      }),

      MedicineInventory.countDocuments({
        isActive: true,
        $expr: {
          $lte: ["$availableStock", "$reorderLevel"],
        },
      }),

      Invoice.aggregate([
        {
          $match: {
            paymentStatus: {
              $in: ["Paid", "Partial"],
            },
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

      AppointmentToken.aggregate([
        {
          $match: {
            visitDate: {
              $gte: startOfDay,
              $lte: endOfDay,
            },
          },
        },
        {
          $group: {
            _id: "$departmentRef",
            visits: {
              $sum: 1,
            },
            completedVisits: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$status", "Completed"],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $lookup: {
            from: "departments",
            localField: "_id",
            foreignField: "_id",
            as: "departmentInfo",
          },
        },
        {
          $unwind: {
            path: "$departmentInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 0,
            departmentId: "$_id",
            departmentName: {
              $ifNull: ["$departmentInfo.name", "Unknown Department"],
            },
            departmentCode: {
              $ifNull: ["$departmentInfo.code", "OPD"],
            },
            visits: 1,
            completedVisits: 1,
          },
        },
        {
          $sort: {
            visits: -1,
          },
        },
      ]),

      AppointmentToken.aggregate([
        {
          $match: {
            visitDate: {
              $gte: startOfDay,
              $lte: endOfDay,
            },
          },
        },
        {
          $group: {
            _id: "$doctor",
            visits: {
              $sum: 1,
            },
            completedVisits: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$status", "Completed"],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "doctorInfo",
          },
        },
        {
          $unwind: {
            path: "$doctorInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 0,
            doctorId: "$_id",
            doctorName: {
              $ifNull: ["$doctorInfo.name", "Unknown Doctor"],
            },
            visits: 1,
            completedVisits: 1,
          },
        },
        {
          $sort: {
            visits: -1,
          },
        },
      ]),

      Invoice.aggregate([
        {
          $group: {
            _id: null,
            consultationRevenue: {
              $sum: "$consultationFee",
            },
            labRevenue: {
              $sum: "$labFee",
            },
            pharmacyRevenue: {
              $sum: "$pharmacyFee",
            },
            invoiceGrossTotal: {
              $sum: "$grossTotal",
            },
            collectedRevenue: {
              $sum: "$amountPaid",
            },
          },
        },
      ]),
    ]);

    const paidRevenue =
      paidInvoiceSummary.length > 0 ? paidInvoiceSummary[0].total : 0;

    const outstandingBalance =
      outstandingInvoiceSummary.length > 0
        ? outstandingInvoiceSummary[0].total
        : 0;

    const pharmacySalesTotal =
      pharmacySalesSummary.length > 0 ? pharmacySalesSummary[0].total : 0;

    const revenueBreakdown =
      revenueBreakdownSummary.length > 0
        ? revenueBreakdownSummary[0]
        : {
            consultationRevenue: 0,
            labRevenue: 0,
            pharmacyRevenue: 0,
            invoiceGrossTotal: 0,
            collectedRevenue: 0,
          };

    return res.status(200).json({
      success: true,
      data: {
        selectedDate: startOfDay,

        totalPatientsRegistered: totalPatients,
        totalHospitalStaffAccounts: totalStaff,
        activeHospitalStaffAccounts: activeStaff,
        completedConsultationsCount: completedConsultations,

        netFinancialRevenueCollected: paidRevenue,
        outstandingBalance,
        pharmacySalesTotal,

        dailyOperations: {
          pendingVisits,
          inConsultationVisits,
          completedVisits: completedVisitsToday,
          pendingLabTests,
          lowStockMedicines,
        },

        appointmentStatusCounts: {
          scheduled: scheduledAppointments,
          checkedIn: checkedInAppointments,
          completed: completedAppointments,
          cancelled: cancelledAppointments,
          noShow: noShowAppointments,
        },

        departmentVisitSummary,
        doctorWorkloadSummary,

        revenueBreakdown: {
          consultationRevenue: revenueBreakdown.consultationRevenue || 0,
          labRevenue: revenueBreakdown.labRevenue || 0,
          pharmacyRevenue: revenueBreakdown.pharmacyRevenue || 0,
          invoiceGrossTotal: revenueBreakdown.invoiceGrossTotal || 0,
          collectedRevenue: revenueBreakdown.collectedRevenue || 0,
        },
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
