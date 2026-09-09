const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    reportType: {
      type: String,
      required: true,
      enum: [
        "financial",
        "patient",
        "appointment",
        "clinical",
        "pharmacy",
        "lab",
        "inventory",
        "staff",
        "department",
      ],
    },

    title: {
      type: String,
      required: true,
    },

    description: {
      type: String,
    },

    dateRange: {
      startDate: {
        type: Date,
        required: true,
      },
      endDate: {
        type: Date,
        required: true,
      },
    },

    filters: {
      department: String,
      doctor: String,
      paymentStatus: String,
      status: String,
    },

    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    summary: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Report", reportSchema);
