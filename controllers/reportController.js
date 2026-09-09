const Report = require("../models/Report");
const Invoice = require("../models/Invoice");
const PatientProfile = require("../models/patientProfile");
const Appointment = require("../models/Appointment");
const AppointmentToken = require("../models/appointmentToken");
const MedicalRecord = require("../models/MedicalRecord");
const PharmacySale = require("../models/PharmacySale");
const LabReport = require("../models/LabReport");
const MedicineInventory = require("../models/medicineInventory");
const User = require("../models/User");
const Department = require("../models/Department");

// Generate Financial Report
const generateFinancialReport = async (req, res) => {
  try {
    const { startDate, endDate, paymentStatus, paymentMethod } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filter = {
      createdAt: {
        $gte: start,
        $lte: end,
      },
    };

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }

    const invoices = await Invoice.find(filter)
      .populate("patient", "name patientId")
      .populate("token", "displayToken department")
      .sort({ createdAt: -1 });

    const totalInvoices = invoices.length;
    const totalGross = invoices.reduce(
      (sum, inv) => sum + (inv.grossTotal || 0),
      0,
    );
    const totalCollected = invoices.reduce(
      (sum, inv) => sum + (inv.amountPaid || 0),
      0,
    );
    const totalOutstanding = invoices.reduce(
      (sum, inv) => sum + (inv.remainingBalance || 0),
      0,
    );

    const paidInvoices = invoices.filter(
      (inv) => inv.paymentStatus === "Paid",
    ).length;
    const unpaidInvoices = invoices.filter(
      (inv) => inv.paymentStatus === "Unpaid",
    ).length;
    const partialInvoices = invoices.filter(
      (inv) => inv.paymentStatus === "Partial",
    ).length;

    const reportData = {
      invoices,
      summary: {
        totalInvoices,
        totalGross,
        totalCollected,
        totalOutstanding,
        paidInvoices,
        unpaidInvoices,
        partialInvoices,
      },
    };

    // Save report to database
    const report = await Report.create({
      reportType: "financial",
      title: `Financial Report (${startDate} to ${endDate})`,
      description: "Comprehensive financial report with invoice details",
      dateRange: { startDate: start, endDate: end },
      filters: { paymentStatus, paymentMethod },
      generatedBy: req.user._id,
      data: reportData,
      summary: reportData.summary,
      status: "completed",
    });

    return res.status(200).json({
      success: true,
      message: "Financial report generated successfully",
      data: reportData,
      reportId: report._id,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate financial report",
    });
  }
};

// Generate Patient Report
const generatePatientReport = async (req, res) => {
  try {
    const { startDate, endDate, gender, department } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filter = {
      createdAt: {
        $gte: start,
        $lte: end,
      },
    };

    if (gender) {
      filter.gender = gender;
    }

    const patients = await PatientProfile.find(filter)
      .sort({ createdAt: -1 })
      .populate("emergencyContact.name", "name");

    const totalPatients = patients.length;
    const malePatients = patients.filter((p) => p.gender === "Male").length;
    const femalePatients = patients.filter((p) => p.gender === "Female").length;
    const otherPatients = patients.filter((p) => p.gender === "Other").length;

    const reportData = {
      patients,
      summary: {
        totalPatients,
        malePatients,
        femalePatients,
        otherPatients,
      },
    };

    const report = await Report.create({
      reportType: "patient",
      title: `Patient Report (${startDate} to ${endDate})`,
      description: "Patient registration report with demographics",
      dateRange: { startDate: start, endDate: end },
      filters: { gender, department },
      generatedBy: req.user._id,
      data: reportData,
      summary: reportData.summary,
      status: "completed",
    });

    return res.status(200).json({
      success: true,
      message: "Patient report generated successfully",
      data: reportData,
      reportId: report._id,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate patient report",
    });
  }
};

// Generate Appointment Report
const generateAppointmentReport = async (req, res) => {
  try {
    const { startDate, endDate, status, department } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filter = {
      appointmentDate: {
        $gte: start,
        $lte: end,
      },
    };

    if (status) {
      filter.status = status;
    }

    const appointments = await Appointment.find(filter)
      .populate("patient", "name patientId")
      .populate("doctor", "name")
      .populate("department", "name code")
      .sort({ appointmentDate: -1 });

    const totalAppointments = appointments.length;
    const scheduled = appointments.filter(
      (a) => a.status === "Scheduled",
    ).length;
    const checkedIn = appointments.filter(
      (a) => a.status === "Checked-In",
    ).length;
    const completed = appointments.filter(
      (a) => a.status === "Completed",
    ).length;
    const cancelled = appointments.filter(
      (a) => a.status === "Cancelled",
    ).length;
    const noShow = appointments.filter((a) => a.status === "No-Show").length;

    const reportData = {
      appointments,
      summary: {
        totalAppointments,
        scheduled,
        checkedIn,
        completed,
        cancelled,
        noShow,
      },
    };

    const report = await Report.create({
      reportType: "appointment",
      title: `Appointment Report (${startDate} to ${endDate})`,
      description: "Appointment booking and status report",
      dateRange: { startDate: start, endDate: end },
      filters: { status, department },
      generatedBy: req.user._id,
      data: reportData,
      summary: reportData.summary,
      status: "completed",
    });

    return res.status(200).json({
      success: true,
      message: "Appointment report generated successfully",
      data: reportData,
      reportId: report._id,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate appointment report",
    });
  }
};

// Generate Clinical Report (Medical Records)
const generateClinicalReport = async (req, res) => {
  try {
    const { startDate, endDate, doctor, department } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filter = {
      createdAt: {
        $gte: start,
        $lte: end,
      },
    };

    const records = await MedicalRecord.find(filter)
      .populate("token", "displayToken patient")
      .populate("doctor", "name")
      .sort({ createdAt: -1 });

    const totalRecords = records.length;
    const withPrescriptions = records.filter(
      (r) => r.medicines && r.medicines.length > 0,
    ).length;
    const withLabTests = records.filter(
      (r) => r.advisedLabTests && r.advisedLabTests.length > 0,
    ).length;

    const reportData = {
      records,
      summary: {
        totalRecords,
        withPrescriptions,
        withLabTests,
      },
    };

    const report = await Report.create({
      reportType: "clinical",
      title: `Clinical Report (${startDate} to ${endDate})`,
      description: "Medical records and EMR report",
      dateRange: { startDate: start, endDate: end },
      filters: { doctor, department },
      generatedBy: req.user._id,
      data: reportData,
      summary: reportData.summary,
      status: "completed",
    });

    return res.status(200).json({
      success: true,
      message: "Clinical report generated successfully",
      data: reportData,
      reportId: report._id,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate clinical report",
    });
  }
};

// Generate Pharmacy Report
const generatePharmacyReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const sales = await PharmacySale.find({
      createdAt: {
        $gte: start,
        $lte: end,
      },
    })
      .populate("patient", "name patientId")
      .populate("medicalRecord", "chiefComplaints")
      .sort({ createdAt: -1 });

    const totalSales = sales.length;
    const totalRevenue = sales.reduce(
      (sum, sale) => sum + (sale.totalAmount || 0),
      0,
    );

    const reportData = {
      sales,
      summary: {
        totalSales,
        totalRevenue,
      },
    };

    const report = await Report.create({
      reportType: "pharmacy",
      title: `Pharmacy Sales Report (${startDate} to ${endDate})`,
      description: "Pharmacy sales and revenue report",
      dateRange: { startDate: start, endDate: end },
      generatedBy: req.user._id,
      data: reportData,
      summary: reportData.summary,
      status: "completed",
    });

    return res.status(200).json({
      success: true,
      message: "Pharmacy report generated successfully",
      data: reportData,
      reportId: report._id,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate pharmacy report",
    });
  }
};

// Generate Lab Report
const generateLabReport = async (req, res) => {
  try {
    const { startDate, endDate, status } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filter = {
      createdAt: {
        $gte: start,
        $lte: end,
      },
    };

    if (status) {
      filter.status = status;
    }

    const labReports = await LabReport.find(filter)
      .populate("patient", "name patientId")
      .populate("medicalRecord", "chiefComplaints diagnosis")
      .sort({ createdAt: -1 });

    const totalTests = labReports.length;
    const pending = labReports.filter((r) => r.status === "Pending").length;
    const completed = labReports.filter((r) => r.status === "Completed").length;

    const reportData = {
      labReports,
      summary: {
        totalTests,
        pending,
        completed,
      },
    };

    const report = await Report.create({
      reportType: "lab",
      title: `Laboratory Report (${startDate} to ${endDate})`,
      description: "Lab tests and results report",
      dateRange: { startDate: start, endDate: end },
      filters: { status },
      generatedBy: req.user._id,
      data: reportData,
      summary: reportData.summary,
      status: "completed",
    });

    return res.status(200).json({
      success: true,
      message: "Lab report generated successfully",
      data: reportData,
      reportId: report._id,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate lab report",
    });
  }
};

// Generate Inventory Report
const generateInventoryReport = async (req, res) => {
  try {
    const { lowStockOnly, expiredOnly } = req.body;

    const filter = {
      isActive: true,
    };

    if (lowStockOnly) {
      filter.$expr = {
        $lte: ["$availableStock", "$reorderLevel"],
      };
    }

    const medicines = await MedicineInventory.find(filter).sort({ name: 1 });

    const totalMedicines = medicines.length;
    const lowStock = medicines.filter(
      (m) => m.availableStock <= m.reorderLevel,
    ).length;
    const outOfStock = medicines.filter((m) => m.availableStock === 0).length;

    const reportData = {
      medicines,
      summary: {
        totalMedicines,
        lowStock,
        outOfStock,
      },
    };

    const report = await Report.create({
      reportType: "inventory",
      title: "Inventory Report",
      description: "Medicine inventory and stock report",
      dateRange: {
        startDate: new Date(),
        endDate: new Date(),
      },
      filters: { lowStockOnly, expiredOnly },
      generatedBy: req.user._id,
      data: reportData,
      summary: reportData.summary,
      status: "completed",
    });

    return res.status(200).json({
      success: true,
      message: "Inventory report generated successfully",
      data: reportData,
      reportId: report._id,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate inventory report",
    });
  }
};

// Generate Staff Report
const generateStaffReport = async (req, res) => {
  try {
    const { role, department, isActive } = req.body;

    const filter = {
      role: {
        $ne: "super_admin",
      },
    };

    if (role) {
      filter.role = role;
    }

    if (department) {
      filter.department = department;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    const staff = await User.find(filter)
      .populate("department", "name code")
      .sort({ name: 1 });

    const totalStaff = staff.length;
    const activeStaff = staff.filter((s) => s.isActive).length;
    const inactiveStaff = staff.filter((s) => !s.isActive).length;

    const doctors = staff.filter((s) => s.role === "doctor").length;
    const receptionists = staff.filter((s) => s.role === "receptionist").length;
    const accountants = staff.filter((s) => s.role === "accountant").length;

    const reportData = {
      staff,
      summary: {
        totalStaff,
        activeStaff,
        inactiveStaff,
        doctors,
        receptionists,
        accountants,
      },
    };

    const report = await Report.create({
      reportType: "staff",
      title: "Staff Report",
      description: "Hospital staff and roles report",
      dateRange: {
        startDate: new Date(),
        endDate: new Date(),
      },
      filters: { role, department, isActive },
      generatedBy: req.user._id,
      data: reportData,
      summary: reportData.summary,
      status: "completed",
    });

    return res.status(200).json({
      success: true,
      message: "Staff report generated successfully",
      data: reportData,
      reportId: report._id,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate staff report",
    });
  }
};

// Generate Department Report
const generateDepartmentReport = async (req, res) => {
  try {
    const departments = await Department.find({}).sort({ name: 1 });

    const totalDepartments = departments.length;
    const activeDepartments = departments.filter((d) => d.isActive).length;

    const reportData = {
      departments,
      summary: {
        totalDepartments,
        activeDepartments,
      },
    };

    const report = await Report.create({
      reportType: "department",
      title: "Department Report",
      description: "Hospital departments overview",
      dateRange: {
        startDate: new Date(),
        endDate: new Date(),
      },
      generatedBy: req.user._id,
      data: reportData,
      summary: reportData.summary,
      status: "completed",
    });

    return res.status(200).json({
      success: true,
      message: "Department report generated successfully",
      data: reportData,
      reportId: report._id,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate department report",
    });
  }
};

// Get All Reports (History)
const getAllReports = async (req, res) => {
  try {
    const { reportType, limit = 50 } = req.query;

    const filter = {};

    if (reportType) {
      filter.reportType = reportType;
    }

    const reports = await Report.find(filter)
      .populate("generatedBy", "name email")
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch reports",
    });
  }
};

// Get Single Report
const getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id).populate(
      "generatedBy",
      "name email",
    );

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch report",
    });
  }
};

module.exports = {
  generateFinancialReport,
  generatePatientReport,
  generateAppointmentReport,
  generateClinicalReport,
  generatePharmacyReport,
  generateLabReport,
  generateInventoryReport,
  generateStaffReport,
  generateDepartmentReport,
  getAllReports,
  getReportById,
};
