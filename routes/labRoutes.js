const express = require("express");
const router = express.Router();
const {
  initializeLabRequests,
  submitLabResult,
  getLabReports,
} = require("../controllers/labController");
const { protect, authorizeRoles } = require("../middlewares/authMiddleware");

router.use(protect);

router.post("/initialize", initializeLabRequests);

router.get(
  "/reports",
  authorizeRoles("super_admin", "doctor", "laboratorian"),
  getLabReports,
);

router.put(
  "/report/:id",
  authorizeRoles("laboratorian", "super_admin"),
  submitLabResult,
);

module.exports = router;
