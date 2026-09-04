const mongoose = require("mongoose");

const medicalRecordSchema = new mongoose.Schema(
  {
    token: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AppointmentToken",
      required: true,
      unique: true,
    },

    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },

    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PatientProfile",
      required: true,
    },

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    chiefComplaints: {
      type: String,
      required: true,
      trim: true,
    },

    diagnosis: {
      type: String,
      required: true,
      trim: true,
    },

    medicines: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },

        dosage: {
          type: String,
          required: true,
          trim: true,
        },

        frequency: {
          type: String,
          required: true,
          trim: true,
        },

        duration: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],

    advisedLabTests: [
      {
        type: String,
        trim: true,
      },
    ],

    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true },
);

medicalRecordSchema.index({
  patient: 1,
  createdAt: -1,
});

medicalRecordSchema.index({
  doctor: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models.MedicalRecord ||
  mongoose.model("MedicalRecord", medicalRecordSchema);
