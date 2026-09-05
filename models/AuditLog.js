const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    logNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    action: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    module: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["SUCCESS", "FAILURE"],
      default: "SUCCESS",
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    performerName: {
      type: String,
      default: "System",
      trim: true,
    },

    performerEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },

    performerRole: {
      type: String,
      default: "SYSTEM",
      trim: true,
      uppercase: true,
    },

    ipAddress: {
      type: String,
      default: "Unknown",
      trim: true,
    },

    entityType: {
      type: String,
      default: "",
      trim: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

auditLogSchema.index({
  createdAt: -1,
});

auditLogSchema.index({
  module: 1,
  createdAt: -1,
});

auditLogSchema.index({
  performedBy: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
