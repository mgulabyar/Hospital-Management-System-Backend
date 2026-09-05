const express = require("express");

const router = express.Router();

const {
  createWard,
  getWards,
  updateWard,
  addBedToWard,
  updateBedStatus,
  createIPDAdmission,
  getIPDAdmissions,
  dischargePatient,
  getIPDDashboard,
} = require("../controllers/ipdController");

const { protect, authorizeRoles } = require("../middlewares/authMiddleware");

router.use(protect);

router.get(
  "/dashboard",
  authorizeRoles("super_admin", "receptionist", "doctor"),
  getIPDDashboard,
);

router.get(
  "/wards",
  authorizeRoles("super_admin", "receptionist", "doctor"),
  getWards,
);

router.post("/wards", authorizeRoles("super_admin"), createWard);

router.put("/wards/:id", authorizeRoles("super_admin"), updateWard);

router.post("/wards/:id/beds", authorizeRoles("super_admin"), addBedToWard);

router.put(
  "/wards/:id/beds/:bedId/status",
  authorizeRoles("super_admin"),
  updateBedStatus,
);

router.get(
  "/admissions",
  authorizeRoles("super_admin", "receptionist", "doctor"),
  getIPDAdmissions,
);

router.post(
  "/admissions",
  authorizeRoles("super_admin", "receptionist"),
  createIPDAdmission,
);

router.put(
  "/admissions/:id/discharge",
  authorizeRoles("super_admin", "receptionist", "doctor"),
  dischargePatient,
);

module.exports = router;
