const express = require("express");
const router = express.Router();
const {
  registerPatient,
  getPatients,
} = require("../controllers/patientController");
const { protect, authorizeRoles } = require("../middlewares/authMiddleware");

router.use(protect);
router.use(authorizeRoles("super_admin", "receptionist", "doctor"));

router.route("/").post(registerPatient).get(getPatients);

module.exports = router;
