const MedicalRecord = require("../models/MedicalRecord");
const AppointmentToken = require("../models/appointmentToken");

const createMedicalRecord = async (req, res) => {
  try {
    const {
      token,
      patient,
      chiefComplaints,
      diagnosis,
      medicines,
      advisedLabTests,
      notes,
    } = req.body;

    if (!token || !patient || !chiefComplaints || !diagnosis) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Please provide all necessary encounter details",
        });
    }

    const activeToken = await AppointmentToken.findById(token);
    if (!activeToken) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Associated appointment token not found",
        });
    }

    if (activeToken.doctor.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({
          success: false,
          message: "You are not authorized to consult this patient",
        });
    }

    const record = await MedicalRecord.create({
      token,
      patient,
      doctor: req.user._id,
      chiefComplaints,
      diagnosis,
      medicines,
      advisedLabTests,
      notes,
    });

    activeToken.status = "Completed";
    await activeToken.save();

    return res.status(201).json({
      success: true,
      message:
        "Medical prescription created and token marked as Completed successfully",
      data: record,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getPatientHistory = async (req, res) => {
  try {
    const records = await MedicalRecord.find({ patient: req.params.patientId })
      .populate("doctor", "name")
      .populate("token", "department visitDate")
      .sort({ createdAt: -1 });

    return res
      .status(200)
      .json({ success: true, count: records.length, data: records });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createMedicalRecord, getPatientHistory };
