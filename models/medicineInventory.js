const mongoose = require("mongoose");

const medicineInventorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    availableStock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    reorderLevel: {
      type: Number,
      required: true,
      default: 10,
      min: 0,
    },

    pricePerUnit: {
      type: Number,
      required: true,
      min: 0,
    },

    expiryDate: {
      type: Date,
      required: true,
    },

    batchNumber: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

medicineInventorySchema.index({
  name: 1,
  isActive: 1,
});

medicineInventorySchema.virtual("isLowStock").get(function () {
  return this.availableStock <= this.reorderLevel;
});

medicineInventorySchema.set("toJSON", { virtuals: true });
medicineInventorySchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("MedicineInventory", medicineInventorySchema);
