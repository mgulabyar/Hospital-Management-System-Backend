const express = require("express");
const router = express.Router();
const {
  initializeLabRequests,
  submitLabResult,
  getLabReports,
} = require("../controllers/labController");
const { protect, authorizeRoles } = require("../middlewares/authMiddleware");

router.use(protect);

router.get(
  "/reports",
  authorizeRoles("super_admin", "laboratorian", "doctor"),
  getLabReports,
);

router.post(
  "/initialize",
  authorizeRoles("super_admin", "doctor"),
  initializeLabRequests,
);

router.put(
  "/report/:id",
  authorizeRoles("super_admin", "laboratorian"),
  submitLabResult,
);

module.exports = router;