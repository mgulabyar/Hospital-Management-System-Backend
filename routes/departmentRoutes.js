const express = require("express");
const router = express.Router();

const {
  getDepartments,
  createDepartment,
  updateDepartment,
  toggleDepartmentStatus,
} = require("../controllers/departmentController");

const {
  protect,
  authorizeRoles,
} = require("../middlewares/authMiddleware");

router.use(protect);

router.get(
  "/",
  authorizeRoles(
    "super_admin",
    "receptionist",
    "doctor",
    "accountant",
    "laboratorian",
    "pharmacist",
  ),
  getDepartments,
);

router.post(
  "/",
  authorizeRoles("super_admin"),
  createDepartment,
);

router.put(
  "/:id",
  authorizeRoles("super_admin"),
  updateDepartment,
);

router.patch(
  "/:id/toggle-status",
  authorizeRoles("super_admin"),
  toggleDepartmentStatus,
);

module.exports = router;