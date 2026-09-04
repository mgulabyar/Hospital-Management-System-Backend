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

    testName: {
      type: String,
      required: true,
      trim: true,
    },

    testFee: {
      type: Number,
      required: true,
      default: 500,
      min: 0,
    },

    testResultValues: {
      type: String,
      default: "Pending Analysis",
      trim: true,
    },

    status: {
      type: String,
      enum: ["Pending", "Completed"],
      default: "Pending",
    },

    labTechnician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    billedInInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
    },
  },
  { timestamps: true },
);

labReportSchema.index({
  medicalRecord: 1,
  testName: 1,
});

labReportSchema.index({
  patient: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models.LabReport || mongoose.model("LabReport", labReportSchema);
