const MedicalRecord = require("../models/MedicalRecord");
const AppointmentToken = require("../models/appointmentToken");
const Appointment = require("../models/Appointment");

const createMedicalRecord = async (req, res) => {
  try {
    const {
      token,
      patient,
      chiefComplaints,
      diagnosis,
      medicines = [],
      advisedLabTests = [],
      notes,
    } = req.body;

    if (!token || !patient || !chiefComplaints || !diagnosis) {
      return res.status(400).json({
        success: false,
        message: "Please provide all necessary encounter details",
      });
    }

    if (!chiefComplaints.trim() || !diagnosis.trim()) {
      return res.status(400).json({
        success: false,
        message: "Chief complaints and diagnosis cannot be empty",
      });
    }

    if (!Array.isArray(medicines) || !Array.isArray(advisedLabTests)) {
      return res.status(400).json({
        success: false,
        message: "Medicines and advised lab tests must be valid arrays",
      });
    }

    const activeToken = await AppointmentToken.findById(token);

    if (!activeToken) {
      return res.status(404).json({
        success: false,
        message: "Associated appointment token not found",
      });
    }

    if (activeToken.doctor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to consult this patient",
      });
    }

    if (activeToken.patient.toString() !== patient.toString()) {
      return res.status(400).json({
        success: false,
        message: "Selected patient does not match the appointment token",
      });
    }

    if (!["Pending", "In-Consultation"].includes(activeToken.status)) {
      return res.status(400).json({
        success: false,
        message:
          "Medical record can only be created for a pending or in-consultation patient visit",
      });
    }

    const existingRecord = await MedicalRecord.findOne({ token });

    if (existingRecord) {
      return res.status(409).json({
        success: false,
        message: "A medical record already exists for this patient visit token",
      });
    }

    const record = await MedicalRecord.create({
      token,
      appointment: activeToken.appointment || null,
      patient: activeToken.patient,
      doctor: req.user._id,
      chiefComplaints: chiefComplaints.trim(),
      diagnosis: diagnosis.trim(),
      medicines,
      advisedLabTests,
      notes: notes?.trim() || "",
    });

    activeToken.status = "Completed";
    await activeToken.save();

    if (activeToken.appointment) {
      const updatedAppointment = await Appointment.findByIdAndUpdate(
        activeToken.appointment,
        {
          status: "Completed",
          completedAt: new Date(),
        },
        {
          new: true,
        },
      );

      if (!updatedAppointment) {
        return res.status(404).json({
          success: false,
          message:
            "Medical record was created, but the linked appointment was not found",
        });
      }
    }

    const populatedRecord = await MedicalRecord.findById(record._id)
      .populate("patient", "patientId name age gender phone bloodGroup")
      .populate("doctor", "name email")
      .populate(
        "token",
        "displayToken department departmentRef visitDate status",
      )
      .populate(
        "appointment",
        "appointmentNumber appointmentDate appointmentTime status",
      );

    return res.status(201).json({
      success: true,
      message:
        "Medical record created and patient visit marked as completed successfully",
      data: populatedRecord,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A medical record already exists for this patient visit token",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create medical record",
    });
  }
};

const getPatientHistory = async (req, res) => {
  try {
    const filter = {
      patient: req.params.patientId,
    };

    if (req.user.role === "doctor") {
      filter.doctor = req.user._id;
    }

    const records = await MedicalRecord.find(filter)
      .populate("doctor", "name")
      .populate(
        "token",
        "displayToken department departmentRef visitDate status",
      )
      .populate(
        "appointment",
        "appointmentNumber appointmentDate appointmentTime status",
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch patient medical history",
    });
  }
};

module.exports = {
  createMedicalRecord,
  getPatientHistory,
};