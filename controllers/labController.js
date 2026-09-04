const LabReport = require("../models/LabReport");
const MedicalRecord = require("../models/medicalRecord");

const DEFAULT_LAB_TEST_FEE = 500;

const initializeLabRequests = async (req, res) => {
  try {
    const { medicalRecordId, labTestFees = {} } = req.body;

    if (!medicalRecordId) {
      return res.status(400).json({
        success: false,
        message: "Medical record id is required",
      });
    }

    const record = await MedicalRecord.findById(medicalRecordId);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Associated prescription record not found",
      });
    }

    if (!record.advisedLabTests || record.advisedLabTests.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No lab tests were advised in this prescription",
      });
    }

    const existingReports = await LabReport.find({
      medicalRecord: medicalRecordId,
    });

    if (existingReports.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Lab reports already initialized for this prescription",
      });
    }

    const generatedReports = [];

    for (const rawTest of record.advisedLabTests) {
      const isTestObject =
        rawTest && typeof rawTest === "object" && !Array.isArray(rawTest);

      const testName = isTestObject
        ? String(rawTest.testName || rawTest.name || "").trim()
        : String(rawTest || "").trim();

      if (!testName) {
        return res.status(400).json({
          success: false,
          message: "One or more advised lab test names are invalid",
        });
      }

      const requestedFee = isTestObject
        ? rawTest.testFee
        : labTestFees[testName];

      const testFee =
        requestedFee === undefined
          ? DEFAULT_LAB_TEST_FEE
          : Number(requestedFee);

      if (!Number.isFinite(testFee) || testFee < 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid test fee for ${testName}`,
        });
      }

      const report = await LabReport.create({
        medicalRecord: medicalRecordId,
        patient: record.patient,
        testName,
        testFee,
        status: "Pending",
      });

      generatedReports.push(report);
    }

    return res.status(201).json({
      success: true,
      message: `${generatedReports.length} pending lab tests generated successfully`,
      data: generatedReports,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to initialize lab requests",
    });
  }
};

const submitLabResult = async (req, res) => {
  try {
    const { testResultValues } = req.body;

    if (!testResultValues?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide test analytical values",
      });
    }

    const report = await LabReport.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Lab report slot not found",
      });
    }

    if (report.status === "Completed") {
      return res.status(400).json({
        success: false,
        message: "This lab report has already been completed",
      });
    }

    report.testResultValues = testResultValues.trim();
    report.status = "Completed";
    report.labTechnician = req.user._id;

    await report.save();

    return res.status(200).json({
      success: true,
      message: "Lab result submitted successfully",
      data: report,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to submit lab result",
    });
  }
};

const getLabReports = async (req, res) => {
  try {
    const { status, patient, medicalRecord } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (patient) {
      filter.patient = patient;
    }

    if (medicalRecord) {
      filter.medicalRecord = medicalRecord;
    }

    const reports = await LabReport.find(filter)
      .populate("patient", "name age gender phone patientId")
      .populate("medicalRecord", "chiefComplaints diagnosis")
      .populate("labTechnician", "name")
      .populate("billedInInvoice", "invoiceNumber paymentStatus")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch lab reports",
    });
  }
};

module.exports = {
  initializeLabRequests,
  submitLabResult,
  getLabReports,
};
