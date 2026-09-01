const express = require("express");
const router = express.Router();
const {
  issueToken,
  getTokensQueue,
} = require("../controllers/tokenController");
const { protect, authorizeRoles } = require("../middlewares/authMiddleware");

router.use(protect);
router.use(authorizeRoles("super_admin", "receptionist", "doctor"));

router.route("/").post(issueToken).get(getTokensQueue);

module.exports = router;
