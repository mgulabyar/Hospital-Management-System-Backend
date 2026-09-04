const express = require("express");
const router = express.Router();
const {
  createMedicalRecord,
  getPatientHistory,
} = require("../controllers/medicalRecordController");
const { protect, authorizeRoles } = require("../middlewares/authMiddleware");

router.use(protect);

router.post("/", authorizeRoles("doctor", "super_admin"), createMedicalRecord);

router.get(
  "/patient/:patientId",
  authorizeRoles("super_admin", "doctor"),
  getPatientHistory,
);

module.exports = router;
