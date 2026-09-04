const express = require("express");

const router = express.Router();

const {
  issueToken,
  getTokensQueue,
  startTokenConsultation,
} = require("../controllers/tokenController");

const { protect, authorizeRoles } = require("../middlewares/authMiddleware");

router.use(protect);

router.use(authorizeRoles("super_admin", "receptionist", "doctor"));

router.route("/").post(issueToken).get(getTokensQueue);

router.put(
  "/:id/start-consultation",
  authorizeRoles("super_admin", "doctor"),
  startTokenConsultation,
);

module.exports = router;
