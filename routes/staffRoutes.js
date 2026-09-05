const express = require("express");

const router = express.Router();

const {
  createStaff,
  getAllStaff,
  updateUserAccount,
  deleteUserAccount,
  toggleStaffStatus,
} = require("../controllers/staffController");

const { protect, authorizeRoles } = require("../middlewares/authMiddleware");

router.use(protect);

router.get("/", authorizeRoles("super_admin", "receptionist"), getAllStaff);

router.post("/", authorizeRoles("super_admin"), createStaff);

router.put("/:id", authorizeRoles("super_admin"), updateUserAccount);

router.delete("/:id", authorizeRoles("super_admin"), deleteUserAccount);

router.put("/:id/status", authorizeRoles("super_admin"), toggleStaffStatus);

module.exports = router;
