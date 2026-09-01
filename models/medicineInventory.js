const mongoose = require("mongoose");

const medicineInventorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    category: { type: String, required: true },
    availableStock: { type: Number, required: true, default: 0 },
    pricePerUnit: { type: Number, required: true },
    expiryDate: { type: Date, required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("MedicineInventory", medicineInventorySchema);
