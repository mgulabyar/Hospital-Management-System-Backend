const LabReport = require("../models/LabReport");
const MedicalRecord = require("../models/MedicalRecord");
const { createAuditLog } = require("../utils/auditLogger");

const DEFAULT_LAB_TEST_FEE = 500;

const initializeLabRequests = async (req, res) => {
  try {
    const { medicalRecordId, labTestFees = {} } = req.body;

    if (!medicalRecordId) {
      await createAuditLog({
        req,
        action: "INITIALIZE_LAB_REQUESTS",
        module: "LABORATORY",
        description:
          "Lab request initialization failed because medical record id was missing",
        status: "FAILURE",
      });

      return res.status(400).json({
        success: false,
        message: "Medical record id is required",
      });
    }

    const record = await MedicalRecord.findById(medicalRecordId).populate(
      "patient",
      "patientId name",
    );

    if (!record) {
      await createAuditLog({
        req,
        action: "INITIALIZE_LAB_REQUESTS",
        module: "LABORATORY",
        description: `Lab request initialization failed because medical record ${medicalRecordId} was not found`,
        status: "FAILURE",
        metadata: {
          medicalRecordId,
        },
      });

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
      await createAuditLog({
        req,
        action: "INITIALIZE_LAB_REQUESTS",
        module: "LABORATORY",
        description: `Lab request initialization rejected because reports already exist for medical record ${medicalRecordId}`,
        status: "FAILURE",
        entityType: "MedicalRecord",
        entityId: record._id,
        metadata: {
          existingReportsCount: existingReports.length,
        },
      });

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
        patient: record.patient._id,
        testName,
        testFee,
        status: "Pending",
      });

      generatedReports.push(report);
    }

    await createAuditLog({
      req,
      action: "INITIALIZE_LAB_REQUESTS",
      module: "LABORATORY",
      description: `${generatedReports.length} lab requests initialized for patient ${record.patient?.name || "Unknown Patient"}`,
      status: "SUCCESS",
      entityType: "MedicalRecord",
      entityId: record._id,
      metadata: {
        patientId: record.patient?._id || null,
        patientName: record.patient?.name || "Unknown Patient",
        testNames: generatedReports.map((report) => report.testName),
        testCount: generatedReports.length,
      },
    });

    return res.status(201).json({
      success: true,
      message: `${generatedReports.length} pending lab tests generated successfully`,
      data: generatedReports,
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "INITIALIZE_LAB_REQUESTS",
      module: "LABORATORY",
      description: "Lab request initialization failed due to a server error",
      status: "FAILURE",
      metadata: {
        error: error.message,
      },
    });

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
      await createAuditLog({
        req,
        action: "SUBMIT_LAB_RESULT",
        module: "LABORATORY",
        description:
          "Lab result submission failed because analytical values were missing",
        status: "FAILURE",
        metadata: {
          reportId: req.params.id,
        },
      });

      return res.status(400).json({
        success: false,
        message: "Please provide test analytical values",
      });
    }

    const report = await LabReport.findById(req.params.id).populate(
      "patient",
      "patientId name",
    );

    if (!report) {
      await createAuditLog({
        req,
        action: "SUBMIT_LAB_RESULT",
        module: "LABORATORY",
        description: `Lab result submission failed because report ${req.params.id} was not found`,
        status: "FAILURE",
        metadata: {
          reportId: req.params.id,
        },
      });

      return res.status(404).json({
        success: false,
        message: "Lab report slot not found",
      });
    }

    if (report.status === "Completed") {
      await createAuditLog({
        req,
        action: "SUBMIT_LAB_RESULT",
        module: "LABORATORY",
        description: `Lab result submission rejected because ${report.testName} is already completed`,
        status: "FAILURE",
        entityType: "LabReport",
        entityId: report._id,
        metadata: {
          testName: report.testName,
        },
      });

      return res.status(400).json({
        success: false,
        message: "This lab report has already been completed",
      });
    }

    report.testResultValues = testResultValues.trim();
    report.status = "Completed";
    report.labTechnician = req.user._id;

    await report.save();

    await createAuditLog({
      req,
      action: "SUBMIT_LAB_RESULT",
      module: "LABORATORY",
      description: `Lab result submitted for ${report.testName} of patient ${report.patient?.name || "Unknown Patient"}`,
      status: "SUCCESS",
      entityType: "LabReport",
      entityId: report._id,
      metadata: {
        testName: report.testName,
        patientId: report.patient?._id || null,
        patientName: report.patient?.name || "Unknown Patient",
        testFee: report.testFee,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Lab result submitted successfully",
      data: report,
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "SUBMIT_LAB_RESULT",
      module: "LABORATORY",
      description: "Lab result submission failed due to a server error",
      status: "FAILURE",
      metadata: {
        reportId: req.params.id,
        error: error.message,
      },
    });

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

    if (req.user.role === "doctor") {
      const doctorRecords = await MedicalRecord.find({
        doctor: req.user._id,
      }).select("_id");

      filter.medicalRecord = {
        $in: doctorRecords.map((record) => record._id),
      };
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
