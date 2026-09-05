const MedicalRecord = require("../models/MedicalRecord");
const AppointmentToken = require("../models/appointmentToken");
const Appointment = require("../models/Appointment");
const { createAuditLog } = require("../utils/auditLogger");

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
      await createAuditLog({
        req,
        action: "CREATE_MEDICAL_RECORD",
        module: "MEDICAL_RECORDS",
        description:
          "Medical record creation failed because required encounter details were missing",
        status: "FAILURE",
        metadata: {
          tokenId: token || null,
          patientId: patient || null,
        },
      });

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

    const activeToken = await AppointmentToken.findById(token).populate(
      "patient",
      "patientId name",
    );

    if (!activeToken) {
      await createAuditLog({
        req,
        action: "CREATE_MEDICAL_RECORD",
        module: "MEDICAL_RECORDS",
        description: `Medical record creation failed because token ${token} was not found`,
        status: "FAILURE",
        metadata: {
          tokenId: token,
        },
      });

      return res.status(404).json({
        success: false,
        message: "Associated appointment token not found",
      });
    }

    if (activeToken.doctor.toString() !== req.user._id.toString()) {
      await createAuditLog({
        req,
        action: "CREATE_MEDICAL_RECORD",
        module: "MEDICAL_RECORDS",
        description: `Unauthorized medical record creation attempted for token ${activeToken.displayToken}`,
        status: "FAILURE",
        entityType: "AppointmentToken",
        entityId: activeToken._id,
        metadata: {
          displayToken: activeToken.displayToken,
          assignedDoctorId: activeToken.doctor,
        },
      });

      return res.status(403).json({
        success: false,
        message: "You are not authorized to consult this patient",
      });
    }

    if (activeToken.patient._id.toString() !== patient.toString()) {
      await createAuditLog({
        req,
        action: "CREATE_MEDICAL_RECORD",
        module: "MEDICAL_RECORDS",
        description: `Medical record creation rejected because submitted patient does not match token ${activeToken.displayToken}`,
        status: "FAILURE",
        entityType: "AppointmentToken",
        entityId: activeToken._id,
        metadata: {
          displayToken: activeToken.displayToken,
          submittedPatientId: patient,
          tokenPatientId: activeToken.patient._id,
        },
      });

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
      await createAuditLog({
        req,
        action: "CREATE_MEDICAL_RECORD",
        module: "MEDICAL_RECORDS",
        description: `Medical record creation rejected because token ${activeToken.displayToken} already has an encounter record`,
        status: "FAILURE",
        entityType: "MedicalRecord",
        entityId: existingRecord._id,
        metadata: {
          tokenId: activeToken._id,
          displayToken: activeToken.displayToken,
        },
      });

      return res.status(409).json({
        success: false,
        message: "A medical record already exists for this patient visit token",
      });
    }

    const record = await MedicalRecord.create({
      token,
      appointment: activeToken.appointment || null,
      patient: activeToken.patient._id,
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
        await createAuditLog({
          req,
          action: "CREATE_MEDICAL_RECORD",
          module: "MEDICAL_RECORDS",
          description: `Medical record ${record._id} was created but linked appointment was not found`,
          status: "FAILURE",
          entityType: "MedicalRecord",
          entityId: record._id,
          metadata: {
            appointmentId: activeToken.appointment,
            tokenId: activeToken._id,
          },
        });

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

    await createAuditLog({
      req,
      action: "CREATE_MEDICAL_RECORD",
      module: "MEDICAL_RECORDS",
      description: `Medical record completed for token ${activeToken.displayToken} and patient ${activeToken.patient.name}`,
      status: "SUCCESS",
      entityType: "MedicalRecord",
      entityId: record._id,
      metadata: {
        displayToken: activeToken.displayToken,
        patientId: activeToken.patient.patientId,
        patientName: activeToken.patient.name,
        medicineCount: medicines.length,
        advisedLabTestsCount: advisedLabTests.length,
        linkedAppointmentId: activeToken.appointment || null,
      },
    });

    return res.status(201).json({
      success: true,
      message:
        "Medical record created and patient visit marked as completed successfully",
      data: populatedRecord,
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "CREATE_MEDICAL_RECORD",
      module: "MEDICAL_RECORDS",
      description: "Medical record creation failed due to a server error",
      status: "FAILURE",
      metadata: {
        error: error.message,
      },
    });

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
