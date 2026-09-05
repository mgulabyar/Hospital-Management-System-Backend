const express = require("express");

const router = express.Router();

const {
  getAuditLogs,
  getAuditSummary,
} = require("../controllers/auditLogController");

const { protect, authorizeRoles } = require("../middlewares/authMiddleware");

router.use(protect);

router.use(authorizeRoles("super_admin"));

router.get("/", getAuditLogs);

router.get("/summary", getAuditSummary);

module.exports = router;
