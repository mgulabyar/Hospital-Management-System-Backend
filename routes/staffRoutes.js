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
router.use(authorizeRoles("super_admin"));

router.route("/").post(createStaff).get(getAllStaff);

router.route("/:id").put(updateUserAccount).delete(deleteUserAccount);

router.put("/:id/status", toggleStaffStatus);

module.exports = router;
