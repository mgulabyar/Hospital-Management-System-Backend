const express = require("express");

const router = express.Router();

const {
  createAppointment,
  getAppointments,
  getAppointmentById,
  rescheduleAppointment,
  cancelAppointment,
  checkInAppointment,
  updateAppointmentStatus,
} = require("../controllers/appointmentController");

const {
  protect,
  authorizeRoles,
} = require("../middlewares/authMiddleware");

router.use(protect);

router.use(authorizeRoles("super_admin", "receptionist", "doctor"));

router.route("/").post(createAppointment).get(getAppointments);

router.route("/:id").get(getAppointmentById);

router.put(
  "/:id/reschedule",
  authorizeRoles("super_admin", "receptionist"),
  rescheduleAppointment,
);

router.put(
  "/:id/cancel",
  authorizeRoles("super_admin", "receptionist"),
  cancelAppointment,
);

router.put(
  "/:id/check-in",
  authorizeRoles("super_admin", "receptionist"),
  checkInAppointment,
);

router.put(
  "/:id/status",
  authorizeRoles("super_admin", "receptionist", "doctor"),
  updateAppointmentStatus,
);

module.exports = router;