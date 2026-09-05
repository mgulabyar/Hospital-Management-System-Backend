const mongoose = require("mongoose");

const wardBedSchema = new mongoose.Schema(
  {
    bedNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    status: {
      type: String,
      enum: ["Available", "Occupied", "Maintenance"],
      default: "Available",
    },

    currentAdmission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "IPDAdmission",
      default: null,
    },
  },
  {
    _id: true,
  },
);

const wardSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    wardType: {
      type: String,
      enum: [
        "General",
        "Private",
        "Semi-Private",
        "ICU",
        "Emergency",
        "Maternity",
        "Pediatric",
        "Isolation",
      ],
      default: "General",
    },

    floor: {
      type: String,
      default: "Ground Floor",
      trim: true,
    },

    beds: {
      type: [wardBedSchema],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);



module.exports = mongoose.models.Ward || mongoose.model("Ward", wardSchema);
