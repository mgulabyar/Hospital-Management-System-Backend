const mongoose = require("mongoose");

const medicalRecordSchema = new mongoose.Schema(
  {
    token: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AppointmentToken",
      required: true,
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
    chiefComplaints: { type: String, required: true },
    diagnosis: { type: String, required: true },
    medicines: [
      {
        name: { type: String, required: true },
        dosage: { type: String, required: true },
        frequency: { type: String, required: true },
        duration: { type: String, required: true },
      },
    ],
    advisedLabTests: [{ type: String }],
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("MedicalRecord", medicalRecordSchema);
