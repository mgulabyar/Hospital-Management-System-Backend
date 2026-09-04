const express = require("express");

const router = express.Router();

const {
  getAllBillingPatients,
  generateInvoiceSummary,
  settlePaymentInvoice,
  getInvoices,
  getHospitalDashboardData,
} = require("../controllers/billingController");

const { protect, authorizeRoles } = require("../middlewares/authMiddleware");

router.use(protect);

router.get(
  "/patients",
  authorizeRoles("super_admin", "accountant"),
  getAllBillingPatients,
);

router.post(
  "/generate",
  authorizeRoles("super_admin", "accountant"),
  generateInvoiceSummary,
);

router.get(
  "/invoices",
  authorizeRoles("super_admin", "accountant"),
  getInvoices,
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
