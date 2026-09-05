const AuditLog = require("../models/AuditLog");

const getClientIpAddress = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "Unknown";
};

const getNextAuditLogNumber = async () => {
  const year = new Date().getFullYear();

  const latestLog = await AuditLog.findOne({
    logNumber: new RegExp(`^AUD-${year}-`),
  })
    .sort({ createdAt: -1 })
    .select("logNumber");

  let nextSequence = 1;

  if (latestLog?.logNumber) {
    const previousSequence = Number(latestLog.logNumber.split("-").pop());

    if (!Number.isNaN(previousSequence)) {
      nextSequence = previousSequence + 1;
    }
  }

  return `AUD-${year}-${String(nextSequence).padStart(6, "0")}`;
};

const createAuditLog = async ({
  req,
  action,
  module,
  description,
  status = "SUCCESS",
  entityType = "",
  entityId = null,
  metadata = {},
  performer = null,
}) => {
  try {
    const activeUser = performer || req?.user || null;

    const logNumber = await getNextAuditLogNumber();

    return await AuditLog.create({
      logNumber,
      action,
      module,
      description,
      status,
      performedBy: activeUser?._id || null,
      performerName: activeUser?.name || "System",
      performerEmail: activeUser?.email || "",
      performerRole: activeUser?.role || "SYSTEM",
      ipAddress: req ? getClientIpAddress(req) : "System",
      entityType,
      entityId,
      metadata,
    });
  } catch (error) {
    console.error("Audit log write failed:", error.message);
    return null;
  }
};

module.exports = {
  createAuditLog,
  getClientIpAddress,
};
