const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  getSuperAdminDashboard,
  logoutUser,
} = require("../controllers/authController");
const { protect, authorizeRoles } = require("../middlewares/authMiddleware");

router.post("/register", registerUser);
router.post("/login", loginUser);

router.post("/logout", protect, logoutUser);

router.get(
  "/superadmin-dashboard",
  protect,
  authorizeRoles("super_admin"),
  getSuperAdminDashboard,
);

module.exports = router;
