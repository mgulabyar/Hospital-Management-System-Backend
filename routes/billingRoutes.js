const express = require("express");
const router = express.Router();
const {
  generateInvoiceSummary,
  settlePaymentInvoice,
  getHospitalDashboardData,
} = require("../controllers/billingController");
const { protect, authorizeRoles } = require("../middlewares/authMiddleware");

router.use(protect);

router.post(
  "/generate",
  authorizeRoles("super_admin", "accountant"),
  generateInvoiceSummary,
);
router.put(
  "/settle/:id",
  authorizeRoles("super_admin", "accountant"),
  settlePaymentInvoice,
);

router.get(
  "/dashboard-analytics",
  authorizeRoles("super_admin"),
  getHospitalDashboardData,
);

module.exports = router;
