const mongoose = require("mongoose");

const appointmentTokenSchema = new mongoose.Schema(
  {
    tokenNumber: { type: Number, required: true },

    displayToken: { type: String, required: true },

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

    department: { type: String, required: true },

    vitals: {
      bp: { type: String, default: "N/A" },
      pulse: { type: Number, default: 0 },
      weight: { type: Number, default: 0 },
      temperature: { type: Number, default: 0 },
    },

    status: {
      type: String,
      enum: ["Pending", "In-Consultation", "Completed", "Cancelled"],
      default: "Pending",
    },

    visitDate: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = mongoose.model("AppointmentToken", appointmentTokenSchema);
