const mongoose = require("mongoose");

const pharmacySaleSchema = new mongoose.Schema(
  {
    saleNumber: {
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

    medicalRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicalRecord",
      default: null,
    },

    itemsSold: [
      {
        medicine: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "MedicineInventory",
          required: true,
        },

        medicineName: {
          type: String,
          required: true,
          trim: true,
        },

        quantity: {
          type: Number,
          required: true,
          min: 1,
        },

        price: {
          type: Number,
          required: true,
          min: 0,
        },

        subtotal: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid"],
      default: "Paid",
    },

    pharmacist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

pharmacySaleSchema.index(
  {
    medicalRecord: 1,
  },
  {
    unique: true,
    sparse: true,
  },
);

pharmacySaleSchema.index({
  patient: 1,
  createdAt: -1,
});

pharmacySaleSchema.index({
  pharmacist: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models.PharmacySale ||
  mongoose.model("PharmacySale", pharmacySaleSchema);