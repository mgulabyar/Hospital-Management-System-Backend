const Invoice = require("../models/Invoice");
const AppointmentToken = require("../models/appointmentToken");
const LabReport = require("../models/LabReport");
const PharmacySale = require("../models/PharmacySale");
const User = require("../models/User");
const PatientProfile = require("../models/patientProfile");

const generateInvoiceSummary = async (req, res) => {
  try {
    const { tokenId, patientId, medicalRecordId } = req.body;

    if (!tokenId || !patientId) {
      return res.status(400).json({
        success: false,
        message: "Missing structural processing parameters",
      });
    }

    const labRecordsCount = await LabReport.countDocuments({
      medicalRecord: medicalRecordId,
    });
    const finalCalculatedLabFee = labRecordsCount * 500;

    const pharmacySaleRecord = await PharmacySale.findOne({
      medicalRecord: medicalRecordId,
    });
    const finalCalculatedPharmacyFee = pharmacySaleRecord
      ? pharmacySaleRecord.totalAmount
      : 0;

    const baseConsultationFee = 1500;
    const finalGrossTotal =
      baseConsultationFee + finalCalculatedLabFee + finalCalculatedPharmacyFee;

    const globalInvoicesCount = await Invoice.countDocuments({});
    const invoiceNumber = `INV-${new Date().getFullYear()}-${10001 + globalInvoicesCount}`;

    const invoice = await Invoice.create({
      invoiceNumber,
      patient: patientId,
      token: tokenId,
      consultationFee: baseConsultationFee,
      labFee: finalCalculatedLabFee,
      pharmacyFee: finalCalculatedPharmacyFee,
      grossTotal: finalGrossTotal,
      paymentStatus: "Unpaid",
    });

    return res.status(201).json({
      success: true,
      message: "Centralized billing invoice summarized successfully",
      data: invoice,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const settlePaymentInvoice = async (req, res) => {
  try {
    const { paymentMethod } = req.body;

    if (!paymentMethod || paymentMethod === "Pending") {
      return res.status(400).json({
        success: false,
        message: "Please identify a valid transactional clear method",
      });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Target ledger ledger invoice record not found",
      });
    }

    invoice.paymentMethod = paymentMethod;
    invoice.paymentStatus = "Paid";
    invoice.billingOfficer = req.user._id;

    await invoice.save();

    return res.status(200).json({
      success: true,
      message: "Hospital bill cleared and settlement processed successfully",
      data: invoice,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getHospitalDashboardData = async (req, res) => {
  try {
    const totalPatients = await PatientProfile.countDocuments({});
    const totalStaff = await User.countDocuments({
      role: { $ne: "super_admin" },
    });
    const completedAppointments = await AppointmentToken.countDocuments({
      status: "Completed",
    });

    const financialGrossRevenue = await Invoice.aggregate([
      { $match: { paymentStatus: "Paid" } },
      { $group: { _id: null, totalSales: { $sum: "$grossTotal" } } },
    ]);

    const finalRevenueAmountValue =
      financialGrossRevenue.length > 0
        ? financialGrossRevenue[0].totalSales
        : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalPatientsRegistered: totalPatients,
        totalHospitalStaffAccounts: totalStaff,
        completedConsultationsCount: completedAppointments,
        netFinancialRevenueCollected: finalRevenueAmountValue,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  generateInvoiceSummary,
  settlePaymentInvoice,
  getHospitalDashboardData,
};
