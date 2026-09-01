const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PatientProfile",
      required: true,
    },
    token: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AppointmentToken",
      required: true,
    },
    consultationFee: { type: Number, required: true, default: 1500 },
    labFee: { type: Number, required: true, default: 0 },
    pharmacyFee: { type: Number, required: true, default: 0 },
    grossTotal: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Card", "Insurance", "Pending"],
      default: "Pending",
    },
    paymentStatus: {
      type: String,
      enum: ["Unpaid", "Paid"],
      default: "Unpaid",
    },
    billingOfficer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Invoice", invoiceSchema);
