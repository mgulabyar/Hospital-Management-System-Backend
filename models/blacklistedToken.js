const mongoose = require("mongoose");

const blacklistedTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
  },
  {
    timestamps: true,
  },
);

blacklistedTokenSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);

module.exports = mongoose.model("BlacklistedToken", blacklistedTokenSchema);
