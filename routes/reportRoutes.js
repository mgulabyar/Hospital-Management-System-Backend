const express = require("express");
const router = express.Router();

const {
  generateFinancialReport,
  generatePatientReport,
  generateAppointmentReport,
  generateClinicalReport,
  generatePharmacyReport,
  generateLabReport,
  generateInventoryReport,
  generateStaffReport,
  generateDepartmentReport,
  getAllReports,
  getReportById,
} = require("../controllers/reportController");

const { protect, authorizeRoles } = require("../middlewares/authMiddleware");

router.use(protect);

router.post(
  "/generate/financial",
  authorizeRoles("super_admin", "accountant"),
  generateFinancialReport,
);
router.post(
  "/generate/patient",
  authorizeRoles("super_admin", "receptionist"),
  generatePatientReport,
);
router.post(
  "/generate/appointment",
  authorizeRoles("super_admin", "receptionist", "doctor"),
  generateAppointmentReport,
);
router.post(
  "/generate/clinical",
  authorizeRoles("super_admin", "doctor"),
  generateClinicalReport,
);
router.post(
  "/generate/pharmacy",
  authorizeRoles("super_admin", "pharmacist"),
  generatePharmacyReport,
);
router.post(
  "/generate/lab",
  authorizeRoles("super_admin", "laboratorian"),
  generateLabReport,
);
router.post(
  "/generate/inventory",
  authorizeRoles("super_admin", "pharmacist"),
  generateInventoryReport,
);
router.post(
  "/generate/staff",
  authorizeRoles("super_admin"),
  generateStaffReport,
);
router.post(
  "/generate/department",
  authorizeRoles("super_admin"),
  generateDepartmentReport,
);

router.get("/all", authorizeRoles("super_admin"), getAllReports);
router.get("/:id", authorizeRoles("super_admin"), getReportById);

module.exports = router;
