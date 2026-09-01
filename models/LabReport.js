const mongoose = require("mongoose");

const labReportSchema = new mongoose.Schema(
  {
    medicalRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicalRecord",
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PatientProfile",
      required: true,
    },
    testName: { type: String, required: true },
    testResultValues: { type: String, default: "Pending Analysis" },
    status: {
      type: String,
      enum: ["Pending", "Completed"],
      default: "Pending",
    },
    labTechnician: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("LabReport", labReportSchema);
