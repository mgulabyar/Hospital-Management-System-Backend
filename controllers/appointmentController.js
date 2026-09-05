const Appointment = require("../models/Appointment");
const PatientProfile = require("../models/patientProfile");
const User = require("../models/User");
const Department = require("../models/Department");
const AppointmentToken = require("../models/appointmentToken");
const { createAuditLog } = require("../utils/auditLogger");

const APPOINTMENT_STATUSES = [
  "Scheduled",
  "Checked-In",
  "Completed",
  "Cancelled",
  "No-Show",
];

const ACTIVE_BOOKING_STATUSES = ["Scheduled", "Checked-In"];

const isValidTimeFormat = (time) => {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
};

const getStartAndEndOfDate = (dateValue) => {
  const selectedDate = new Date(dateValue);

  const startOfDay = new Date(selectedDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(selectedDate);
  endOfDay.setHours(23, 59, 59, 999);

  return {
    startOfDay,
    endOfDay,
  };
};

const normalizeAppointmentDate = (dateValue) => {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(0, 0, 0, 0);

  return date;
};

const getNextAppointmentNumber = async () => {
  const year = new Date().getFullYear();

  const latestAppointment = await Appointment.findOne({
    appointmentNumber: new RegExp(`^APT-${year}-`),
  })
    .sort({ createdAt: -1 })
    .select("appointmentNumber");

  let nextSequence = 1;

  if (latestAppointment?.appointmentNumber) {
    const lastSequence = Number(
      latestAppointment.appointmentNumber.split("-").pop(),
    );

    if (!Number.isNaN(lastSequence)) {
      nextSequence = lastSequence + 1;
    }
  }

  return `APT-${year}-${String(nextSequence).padStart(5, "0")}`;
};

const validateAppointmentReferences = async ({
  patientId,
  doctorId,
  departmentId,
}) => {
  const [patient, doctor, department] = await Promise.all([
    PatientProfile.findById(patientId),
    User.findById(doctorId).populate("department", "name code isActive"),
    Department.findById(departmentId),
  ]);

  if (!patient) {
    return {
      valid: false,
      statusCode: 404,
      message: "Selected patient profile was not found",
    };
  }

  if (!department) {
    return {
      valid: false,
      statusCode: 404,
      message: "Selected department was not found",
    };
  }

  if (!department.isActive) {
    return {
      valid: false,
      statusCode: 400,
      message: "Appointments cannot be created for an inactive department",
    };
  }

  if (!doctor || doctor.role !== "doctor") {
    return {
      valid: false,
      statusCode: 400,
      message: "Selected staff account is not a valid doctor",
    };
  }

  if (!doctor.isActive) {
    return {
      valid: false,
      statusCode: 400,
      message: "Selected doctor account is currently inactive",
    };
  }

  if (!doctor.department) {
    return {
      valid: false,
      statusCode: 400,
      message: "Selected doctor does not have an assigned department",
    };
  }

  if (doctor.department._id.toString() !== department._id.toString()) {
    return {
      valid: false,
      statusCode: 400,
      message: "Selected doctor does not belong to the selected department",
    };
  }

  return {
    valid: true,
    patient,
    doctor,
    department,
  };
};

const checkDoctorSlotAvailability = async ({
  doctorId,
  appointmentDate,
  appointmentTime,
  excludeAppointmentId = null,
}) => {
  const { startOfDay, endOfDay } = getStartAndEndOfDate(appointmentDate);

  const filter = {
    doctor: doctorId,
    appointmentTime,
    status: {
      $in: ACTIVE_BOOKING_STATUSES,
    },
    appointmentDate: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  };

  if (excludeAppointmentId) {
    filter._id = {
      $ne: excludeAppointmentId,
    };
  }

  const bookedAppointment = await Appointment.findOne(filter);

  return !bookedAppointment;
};

const populateAppointment = async (appointmentId) => {
  return Appointment.findById(appointmentId)
    .populate(
      "patient",
      "patientId name age gender phone bloodGroup cnicOrPassport",
    )
    .populate("doctor", "name email")
    .populate("department", "name code consultationFee")
    .populate("createdBy", "name role");
};

const createAppointment = async (req, res) => {
  try {
    const {
      patient,
      doctor,
      department,
      appointmentDate,
      appointmentTime,
      reason,
    } = req.body;

    if (
      !patient ||
      !doctor ||
      !department ||
      !appointmentDate ||
      !appointmentTime
    ) {
      await createAuditLog({
        req,
        action: "CREATE_APPOINTMENT",
        module: "APPOINTMENTS",
        description:
          "Appointment booking failed because required booking fields were missing",
        status: "FAILURE",
        metadata: {
          patientId: patient || null,
          doctorId: doctor || null,
          departmentId: department || null,
        },
      });

      return res.status(400).json({
        success: false,
        message:
          "Patient, doctor, department, appointment date and time are required",
      });
    }

    if (!isValidTimeFormat(appointmentTime)) {
      await createAuditLog({
        req,
        action: "CREATE_APPOINTMENT",
        module: "APPOINTMENTS",
        description:
          "Appointment booking failed because time format was invalid",
        status: "FAILURE",
        metadata: {
          appointmentTime,
        },
      });

      return res.status(400).json({
        success: false,
        message: "Appointment time must follow 24-hour HH:MM format",
      });
    }

    const normalizedDate = normalizeAppointmentDate(appointmentDate);

    if (!normalizedDate) {
      await createAuditLog({
        req,
        action: "CREATE_APPOINTMENT",
        module: "APPOINTMENTS",
        description: "Appointment booking failed because date was invalid",
        status: "FAILURE",
        metadata: {
          appointmentDate,
        },
      });

      return res.status(400).json({
        success: false,
        message: "Please provide a valid appointment date",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (normalizedDate < today) {
      await createAuditLog({
        req,
        action: "CREATE_APPOINTMENT",
        module: "APPOINTMENTS",
        description:
          "Appointment booking rejected because selected date was in the past",
        status: "FAILURE",
        metadata: {
          appointmentDate,
        },
      });

      return res.status(400).json({
        success: false,
        message: "Appointments cannot be booked for a past date",
      });
    }

    const referenceValidation = await validateAppointmentReferences({
      patientId: patient,
      doctorId: doctor,
      departmentId: department,
    });

    if (!referenceValidation.valid) {
      await createAuditLog({
        req,
        action: "CREATE_APPOINTMENT",
        module: "APPOINTMENTS",
        description: `Appointment booking failed: ${referenceValidation.message}`,
        status: "FAILURE",
        metadata: {
          patientId: patient,
          doctorId: doctor,
          departmentId: department,
        },
      });

      return res.status(referenceValidation.statusCode).json({
        success: false,
        message: referenceValidation.message,
      });
    }

    const slotAvailable = await checkDoctorSlotAvailability({
      doctorId: doctor,
      appointmentDate: normalizedDate,
      appointmentTime,
    });

    if (!slotAvailable) {
      await createAuditLog({
        req,
        action: "CREATE_APPOINTMENT",
        module: "APPOINTMENTS",
        description: `Appointment booking rejected because ${referenceValidation.doctor.name} already has an active booking in the selected slot`,
        status: "FAILURE",
        metadata: {
          patientId: patient,
          doctorId: doctor,
          departmentId: department,
          appointmentDate: normalizedDate,
          appointmentTime,
        },
      });

      return res.status(409).json({
        success: false,
        message:
          "This doctor already has an active appointment at the selected date and time",
      });
    }

    const appointmentNumber = await getNextAppointmentNumber();

    const appointment = await Appointment.create({
      appointmentNumber,
      patient,
      doctor,
      department,
      appointmentDate: normalizedDate,
      appointmentTime,
      reason: reason?.trim() || "",
      createdBy: req.user._id,
    });

    const populatedAppointment = await populateAppointment(appointment._id);

    await createAuditLog({
      req,
      action: "CREATE_APPOINTMENT",
      module: "APPOINTMENTS",
      description: `Appointment ${appointment.appointmentNumber} booked for ${referenceValidation.patient.name}`,
      status: "SUCCESS",
      entityType: "Appointment",
      entityId: appointment._id,
      metadata: {
        appointmentNumber: appointment.appointmentNumber,
        patientName: referenceValidation.patient.name,
        patientId: referenceValidation.patient.patientId,
        doctorName: referenceValidation.doctor.name,
        department: referenceValidation.department.name,
        appointmentDate: normalizedDate,
        appointmentTime,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      data: populatedAppointment,
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "CREATE_APPOINTMENT",
      module: "APPOINTMENTS",
      description: "Appointment booking failed due to a server error",
      status: "FAILURE",
      metadata: {
        error: error.message,
      },
    });

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "This doctor already has an active appointment at the selected date and time",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to book appointment",
    });
  }
};

const getAppointments = async (req, res) => {
  try {
    const { patient, doctor, department, status, date, startDate, endDate } =
      req.query;

    const filter = {};

    if (req.user.role === "doctor") {
      filter.doctor = req.user._id;
    }

    if (patient) {
      filter.patient = patient;
    }

    if (doctor && req.user.role !== "doctor") {
      filter.doctor = doctor;
    }

    if (department) {
      filter.department = department;
    }

    if (status) {
      const statusList = status
        .split(",")
        .map((item) => item.trim())
        .filter((item) => APPOINTMENT_STATUSES.includes(item));

      if (statusList.length > 0) {
        filter.status = {
          $in: statusList,
        };
      }
    }

    if (date) {
      const { startOfDay, endOfDay } = getStartAndEndOfDate(date);

      filter.appointmentDate = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    } else if (startDate || endDate) {
      filter.appointmentDate = {};

      if (startDate) {
        filter.appointmentDate.$gte =
          getStartAndEndOfDate(startDate).startOfDay;
      }

      if (endDate) {
        filter.appointmentDate.$lte = getStartAndEndOfDate(endDate).endOfDay;
      }
    }

    const appointments = await Appointment.find(filter)
      .populate(
        "patient",
        "patientId name age gender phone bloodGroup cnicOrPassport",
      )
      .populate("doctor", "name email")
      .populate("department", "name code consultationFee")
      .populate("createdBy", "name role")
      .sort({
        appointmentDate: 1,
        appointmentTime: 1,
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch appointments",
    });
  }
};

const getAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate(
        "patient",
        "patientId name age gender phone bloodGroup cnicOrPassport",
      )
      .populate("doctor", "name email")
      .populate("department", "name code consultationFee")
      .populate("createdBy", "name role");

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment was not found",
      });
    }

    if (
      req.user.role === "doctor" &&
      appointment.doctor?._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this appointment",
      });
    }

    return res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch appointment",
    });
  }
};

const rescheduleAppointment = async (req, res) => {
  try {
    const {
      doctor,
      department,
      appointmentDate,
      appointmentTime,
      reason,
      rescheduleReason,
    } = req.body;

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      await createAuditLog({
        req,
        action: "RESCHEDULE_APPOINTMENT",
        module: "APPOINTMENTS",
        description: `Reschedule failed because appointment ${req.params.id} was not found`,
        status: "FAILURE",
        metadata: {
          appointmentId: req.params.id,
        },
      });

      return res.status(404).json({
        success: false,
        message: "Appointment was not found",
      });
    }

    if (
      appointment.status === "Completed" ||
      appointment.status === "Cancelled"
    ) {
      return res.status(400).json({
        success: false,
        message: "Completed or cancelled appointments cannot be rescheduled",
      });
    }

    const previousData = {
      doctorId: appointment.doctor.toString(),
      departmentId: appointment.department.toString(),
      appointmentDate: appointment.appointmentDate,
      appointmentTime: appointment.appointmentTime,
      status: appointment.status,
    };

    const nextDoctorId = doctor || appointment.doctor.toString();
    const nextDepartmentId = department || appointment.department.toString();
    const nextDate = appointmentDate || appointment.appointmentDate;
    const nextTime = appointmentTime || appointment.appointmentTime;

    if (!isValidTimeFormat(nextTime)) {
      return res.status(400).json({
        success: false,
        message: "Appointment time must follow 24-hour HH:MM format",
      });
    }

    const normalizedDate = normalizeAppointmentDate(nextDate);

    if (!normalizedDate) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid appointment date",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (normalizedDate < today) {
      return res.status(400).json({
        success: false,
        message: "Appointments cannot be rescheduled to a past date",
      });
    }

    const referenceValidation = await validateAppointmentReferences({
      patientId: appointment.patient.toString(),
      doctorId: nextDoctorId,
      departmentId: nextDepartmentId,
    });

    if (!referenceValidation.valid) {
      await createAuditLog({
        req,
        action: "RESCHEDULE_APPOINTMENT",
        module: "APPOINTMENTS",
        description: `Reschedule failed for ${appointment.appointmentNumber}: ${referenceValidation.message}`,
        status: "FAILURE",
        entityType: "Appointment",
        entityId: appointment._id,
        metadata: {
          previousData,
          attemptedDoctorId: nextDoctorId,
          attemptedDepartmentId: nextDepartmentId,
        },
      });

      return res.status(referenceValidation.statusCode).json({
        success: false,
        message: referenceValidation.message,
      });
    }

    const slotAvailable = await checkDoctorSlotAvailability({
      doctorId: nextDoctorId,
      appointmentDate: normalizedDate,
      appointmentTime: nextTime,
      excludeAppointmentId: appointment._id,
    });

    if (!slotAvailable) {
      await createAuditLog({
        req,
        action: "RESCHEDULE_APPOINTMENT",
        module: "APPOINTMENTS",
        description: `Reschedule rejected because selected doctor slot is already occupied`,
        status: "FAILURE",
        entityType: "Appointment",
        entityId: appointment._id,
        metadata: {
          appointmentNumber: appointment.appointmentNumber,
          previousData,
          attemptedDate: normalizedDate,
          attemptedTime: nextTime,
        },
      });

      return res.status(409).json({
        success: false,
        message:
          "This doctor already has an active appointment at the selected date and time",
      });
    }

    appointment.doctor = nextDoctorId;
    appointment.department = nextDepartmentId;
    appointment.appointmentDate = normalizedDate;
    appointment.appointmentTime = nextTime;
    appointment.reason = reason?.trim() || appointment.reason;
    appointment.rescheduleReason =
      rescheduleReason?.trim() || "Appointment rescheduled";
    appointment.status = "Scheduled";
    appointment.checkedInAt = null;

    await appointment.save();

    const populatedAppointment = await populateAppointment(appointment._id);

    await createAuditLog({
      req,
      action: "RESCHEDULE_APPOINTMENT",
      module: "APPOINTMENTS",
      description: `Appointment ${appointment.appointmentNumber} rescheduled successfully`,
      status: "SUCCESS",
      entityType: "Appointment",
      entityId: appointment._id,
      metadata: {
        previousData,
        newData: {
          doctorName: referenceValidation.doctor.name,
          departmentName: referenceValidation.department.name,
          appointmentDate: normalizedDate,
          appointmentTime: nextTime,
          rescheduleReason: appointment.rescheduleReason,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Appointment rescheduled successfully",
      data: populatedAppointment,
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "RESCHEDULE_APPOINTMENT",
      module: "APPOINTMENTS",
      description: "Appointment reschedule failed due to a server error",
      status: "FAILURE",
      metadata: {
        appointmentId: req.params.id,
        error: error.message,
      },
    });

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "This doctor already has an active appointment at the selected date and time",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to reschedule appointment",
    });
  }
};

const cancelAppointment = async (req, res) => {
  try {
    const { cancellationReason } = req.body;

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      await createAuditLog({
        req,
        action: "CANCEL_APPOINTMENT",
        module: "APPOINTMENTS",
        description: `Appointment cancellation failed because ${req.params.id} was not found`,
        status: "FAILURE",
        metadata: {
          appointmentId: req.params.id,
        },
      });

      return res.status(404).json({
        success: false,
        message: "Appointment was not found",
      });
    }

    if (appointment.status === "Completed") {
      return res.status(400).json({
        success: false,
        message: "Completed appointments cannot be cancelled",
      });
    }

    if (appointment.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "This appointment is already cancelled",
      });
    }

    const previousStatus = appointment.status;

    appointment.status = "Cancelled";
    appointment.cancelledAt = new Date();
    appointment.cancellationReason =
      cancellationReason?.trim() || "Cancelled by hospital staff";

    await appointment.save();

    const populatedAppointment = await populateAppointment(appointment._id);

    await createAuditLog({
      req,
      action: "CANCEL_APPOINTMENT",
      module: "APPOINTMENTS",
      description: `Appointment ${appointment.appointmentNumber} cancelled successfully`,
      status: "SUCCESS",
      entityType: "Appointment",
      entityId: appointment._id,
      metadata: {
        appointmentNumber: appointment.appointmentNumber,
        previousStatus,
        cancellationReason: appointment.cancellationReason,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Appointment cancelled successfully",
      data: populatedAppointment,
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "CANCEL_APPOINTMENT",
      module: "APPOINTMENTS",
      description: "Appointment cancellation failed due to a server error",
      status: "FAILURE",
      metadata: {
        appointmentId: req.params.id,
        error: error.message,
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to cancel appointment",
    });
  }
};

const checkInAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate("doctor", "name department isActive role")
      .populate("department", "name code isActive")
      .populate("patient", "patientId name");

    if (!appointment) {
      await createAuditLog({
        req,
        action: "CHECK_IN_APPOINTMENT",
        module: "APPOINTMENTS",
        description: `Appointment check-in failed because ${req.params.id} was not found`,
        status: "FAILURE",
        metadata: {
          appointmentId: req.params.id,
        },
      });

      return res.status(404).json({
        success: false,
        message: "Appointment was not found",
      });
    }

    if (appointment.status !== "Scheduled") {
      return res.status(400).json({
        success: false,
        message: "Only scheduled appointments can be checked in at reception",
      });
    }

    if (!appointment.doctor || appointment.doctor.role !== "doctor") {
      return res.status(400).json({
        success: false,
        message: "Appointment does not have a valid assigned doctor",
      });
    }

    if (!appointment.doctor.isActive) {
      return res.status(400).json({
        success: false,
        message: "Assigned doctor account is currently inactive",
      });
    }

    if (!appointment.department || !appointment.department.isActive) {
      return res.status(400).json({
        success: false,
        message: "Appointment department does not exist or is inactive",
      });
    }

    if (
      !appointment.doctor.department ||
      appointment.doctor.department.toString() !==
        appointment.department._id.toString()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Appointment doctor does not belong to the assigned department",
      });
    }

    const existingToken = await AppointmentToken.findOne({
      appointment: appointment._id,
    });

    if (existingToken) {
      await createAuditLog({
        req,
        action: "CHECK_IN_APPOINTMENT",
        module: "APPOINTMENTS",
        description: `Appointment ${appointment.appointmentNumber} already has token ${existingToken.displayToken}`,
        status: "FAILURE",
        entityType: "Appointment",
        entityId: appointment._id,
        metadata: {
          appointmentNumber: appointment.appointmentNumber,
          tokenId: existingToken._id,
          displayToken: existingToken.displayToken,
        },
      });

      return res.status(409).json({
        success: false,
        message: "A patient visit token already exists for this appointment",
      });
    }

    const visitDate = new Date();

    const startOfToday = new Date(visitDate);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(visitDate);
    endOfToday.setHours(23, 59, 59, 999);

    const dailyDepartmentTokensCount = await AppointmentToken.countDocuments({
      departmentRef: appointment.department._id,
      visitDate: {
        $gte: startOfToday,
        $lte: endOfToday,
      },
    });

    const tokenNumber = dailyDepartmentTokensCount + 1;

    const displayToken = `${appointment.department.code}-${String(
      tokenNumber,
    ).padStart(3, "0")}`;

    const token = await AppointmentToken.create({
      tokenNumber,
      displayToken,
      patient: appointment.patient._id,
      doctor: appointment.doctor._id,
      department: appointment.department.name,
      departmentRef: appointment.department._id,
      appointment: appointment._id,
      vitals: {
        bp: "N/A",
        pulse: 0,
        weight: 0,
        temperature: 0,
      },
      status: "Pending",
      visitDate,
    });

    appointment.status = "Checked-In";
    appointment.checkedInAt = visitDate;

    await appointment.save();

    const populatedAppointment = await populateAppointment(appointment._id);

    await createAuditLog({
      req,
      action: "CHECK_IN_APPOINTMENT",
      module: "APPOINTMENTS",
      description: `Appointment ${appointment.appointmentNumber} checked in and patient visit token ${token.displayToken} created`,
      status: "SUCCESS",
      entityType: "Appointment",
      entityId: appointment._id,
      metadata: {
        appointmentNumber: appointment.appointmentNumber,
        patientName: appointment.patient.name,
        patientId: appointment.patient.patientId,
        doctorName: appointment.doctor.name,
        department: appointment.department.name,
        generatedToken: token.displayToken,
        tokenId: token._id,
      },
    });

    return res.status(200).json({
      success: true,
      message:
        "Appointment checked in and patient visit token generated successfully",
      data: {
        appointment: populatedAppointment,
        token,
      },
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "CHECK_IN_APPOINTMENT",
      module: "APPOINTMENTS",
      description: "Appointment check-in failed due to a server error",
      status: "FAILURE",
      metadata: {
        appointmentId: req.params.id,
        error: error.message,
      },
    });

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A patient visit token already exists for this appointment",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to check in appointment",
    });
  }
};

const updateAppointmentStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !APPOINTMENT_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid appointment status",
      });
    }

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment was not found",
      });
    }

    if (appointment.status === "Cancelled" && status !== "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "A cancelled appointment cannot be reactivated",
      });
    }

    const previousStatus = appointment.status;

    appointment.status = status;

    if (status === "Checked-In") {
      appointment.checkedInAt = new Date();
    }

    if (status === "Completed") {
      appointment.completedAt = new Date();
    }

    if (status === "Cancelled") {
      appointment.cancelledAt = new Date();
    }

    await appointment.save();

    const populatedAppointment = await populateAppointment(appointment._id);

    await createAuditLog({
      req,
      action: "UPDATE_APPOINTMENT_STATUS",
      module: "APPOINTMENTS",
      description: `Appointment ${appointment.appointmentNumber} status changed from ${previousStatus} to ${status}`,
      status: "SUCCESS",
      entityType: "Appointment",
      entityId: appointment._id,
      metadata: {
        appointmentNumber: appointment.appointmentNumber,
        previousStatus,
        currentStatus: status,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Appointment status updated successfully",
      data: populatedAppointment,
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "UPDATE_APPOINTMENT_STATUS",
      module: "APPOINTMENTS",
      description: "Appointment status update failed due to a server error",
      status: "FAILURE",
      metadata: {
        appointmentId: req.params.id,
        error: error.message,
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update appointment status",
    });
  }
};

module.exports = {
  createAppointment,
  getAppointments,
  getAppointmentById,
  rescheduleAppointment,
  cancelAppointment,
  checkInAppointment,
  updateAppointmentStatus,
};
