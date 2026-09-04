const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PatientProfile",
      required: true,
    },

    token: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AppointmentToken",
      required: true,
      unique: true,
    },

    medicalRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicalRecord",
      required: true,
      unique: true,
    },

    invoiceItems: [
      {
        type: {
          type: String,
          enum: ["Consultation", "Lab", "Pharmacy"],
          required: true,
        },

        title: {
          type: String,
          required: true,
          trim: true,
        },

        referenceId: {
          type: mongoose.Schema.Types.ObjectId,
          default: null,
        },

        quantity: {
          type: Number,
          required: true,
          default: 1,
          min: 1,
        },

        unitPrice: {
          type: Number,
          required: true,
          min: 0,
        },

        amount: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],

    consultationFee: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    labFee: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    pharmacyFee: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    grossTotal: {
      type: Number,
      required: true,
      min: 0,
    },

    amountPaid: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    remainingBalance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    paymentMethod: {
      type: String,
      enum: ["Cash", "Card", "Insurance", "Online", "Pending"],
      default: "Pending",
    },

    paymentStatus: {
      type: String,
      enum: ["Unpaid", "Partial", "Paid"],
      default: "Unpaid",
    },

    paymentReference: {
      type: String,
      default: "",
      trim: true,
    },

    payments: [
      {
        amount: {
          type: Number,
          required: true,
          min: 0.01,
        },

        paymentMethod: {
          type: String,
          enum: ["Cash", "Card", "Insurance", "Online"],
          required: true,
        },

        paymentReference: {
          type: String,
          default: "",
          trim: true,
        },

        receivedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },

        receivedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    billingOfficer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

invoiceSchema.index({
  patient: 1,
  createdAt: -1,
});

invoiceSchema.index({
  paymentStatus: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema);
