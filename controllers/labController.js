const LabReport = require("../models/LabReport");
const MedicalRecord = require("../models/MedicalRecord");

const initializeLabRequests = async (req, res) => {
  try {
    const { medicalRecordId } = req.body;

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

    const generatedReports = [];

    const existingReports = await LabReport.find({
      medicalRecord: medicalRecordId,
    });
    if (existingReports.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Lab reports already initialized for this prescription",
      });
    }

    for (let test of record.advisedLabTests) {
      const report = await LabReport.create({
        medicalRecord: medicalRecordId,
        patient: record.patient,
        testName: test,
        status: "Pending",
      });
      generatedReports.push(report);
    }

    return res.status(201).json({
      success: true,
      message: `${generatedReports.length} Pending lab tests generated successfully`,
      data: generatedReports,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const submitLabResult = async (req, res) => {
  try {
    const { testResultValues } = req.body;

    if (!testResultValues) {
      return res.status(400).json({
        success: false,
        message: "Please provide test analytical values",
      });
    }

    const report = await LabReport.findById(req.params.id);
    if (!report) {
      return res
        .status(404)
        .json({ success: false, message: "Lab report slot not found" });
    }

    report.testResultValues = testResultValues;
    report.status = "Completed";
    report.labTechnician = req.user._id;

    await report.save();

    return res.status(200).json({
      success: true,
      message: "Lab result submitted successfully",
      data: report,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getLabReports = async (req, res) => {
  try {
    const { status } = req.query;
    let filter = {};
    if (status) filter.status = status;

    const reports = await LabReport.find(filter)
      .populate("patient", "name age gender phone patientId")
      .populate("labTechnician", "name");

    return res
      .status(200)
      .json({ success: true, count: reports.length, data: reports });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { initializeLabRequests, submitLabResult, getLabReports };
