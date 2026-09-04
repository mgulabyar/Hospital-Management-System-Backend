const AppointmentToken = require("../models/appointmentToken");
const User = require("../models/User");
const Department = require("../models/Department");
const PatientProfile = require("../models/patientProfile");

const getTodayRange = () => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  return {
    startOfToday,
    endOfToday,
  };
};

const issueToken = async (req, res) => {
  try {
    const { patient, doctor, department, vitals } = req.body;

    if (!patient || !doctor || !department) {
      return res.status(400).json({
        success: false,
        message: "Patient, doctor and department are required",
      });
    }

    const [selectedPatient, assignedDoctor, selectedDepartment] =
      await Promise.all([
        PatientProfile.findById(patient),
        User.findById(doctor).populate("department", "name code isActive"),
        Department.findOne({
          name: department.trim(),
          isActive: true,
        }),
      ]);

    if (!selectedPatient) {
      return res.status(404).json({
        success: false,
        message: "Selected patient profile was not found",
      });
    }

    if (!assignedDoctor || assignedDoctor.role !== "doctor") {
      return res.status(400).json({
        success: false,
        message: "Assigned user id is not a valid doctor",
      });
    }

    if (!assignedDoctor.isActive) {
      return res.status(400).json({
        success: false,
        message: "The selected doctor account is currently inactive",
      });
    }

    if (!selectedDepartment) {
      return res.status(400).json({
        success: false,
        message: "Selected department does not exist or is inactive",
      });
    }

    if (!assignedDoctor.department) {
      return res.status(400).json({
        success: false,
        message: "Selected doctor does not have an assigned department",
      });
    }

    if (
      assignedDoctor.department._id.toString() !==
      selectedDepartment._id.toString()
    ) {
      return res.status(400).json({
        success: false,
        message: "Selected doctor does not belong to the selected department",
      });
    }

    const { startOfToday, endOfToday } = getTodayRange();

    const existingActiveToken = await AppointmentToken.findOne({
      patient,
      doctor,
      departmentRef: selectedDepartment._id,
      status: {
        $in: ["Pending", "In-Consultation"],
      },
      visitDate: {
        $gte: startOfToday,
        $lte: endOfToday,
      },
    });

    if (existingActiveToken) {
      return res.status(409).json({
        success: false,
        message:
          "An active OPD token already exists for this patient and doctor today",
      });
    }

    const dailyDepartmentTokensCount = await AppointmentToken.countDocuments({
      departmentRef: selectedDepartment._id,
      visitDate: {
        $gte: startOfToday,
        $lte: endOfToday,
      },
    });

    const tokenNumber = dailyDepartmentTokensCount + 1;

    const displayToken = `${selectedDepartment.code}-${String(
      tokenNumber,
    ).padStart(3, "0")}`;

    const token = await AppointmentToken.create({
      tokenNumber,
      displayToken,
      patient,
      doctor,
      department: selectedDepartment.name,
      departmentRef: selectedDepartment._id,
      vitals: {
        bp: vitals?.bp || "N/A",
        pulse: Number(vitals?.pulse) || 0,
        weight: Number(vitals?.weight) || 0,
        temperature: Number(vitals?.temperature) || 0,
      },
      status: "Pending",
    });

    const populatedToken = await AppointmentToken.findById(token._id)
      .populate(
        "patient",
        "patientId name age gender phone bloodGroup cnicOrPassport",
      )
      .populate("doctor", "name email")
      .populate("departmentRef", "name code consultationFee");

    return res.status(201).json({
      success: true,
      message: "OPD Token generated successfully",
      data: populatedToken,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "A token with this department queue number already exists for today",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate OPD token",
    });
  }
};

const getTokensQueue = async (req, res) => {
  try {
    const { doctor, status, department, departmentRef, date } = req.query;

    const filter = {};

    if (req.user.role === "doctor") {
      filter.doctor = req.user._id;
    } else if (doctor) {
      filter.doctor = doctor;
    }

    if (status) {
      const statusList = status
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      if (statusList.length === 1) {
        filter.status = statusList[0];
      } else if (statusList.length > 1) {
        filter.status = {
          $in: statusList,
        };
      }
    }

    if (department) {
      filter.department = department;
    }

    if (departmentRef) {
      filter.departmentRef = departmentRef;
    }

    if (date) {
      const selectedDate = new Date(date);

      if (Number.isNaN(selectedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid queue date",
        });
      }

      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      filter.visitDate = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    const queue = await AppointmentToken.find(filter)
      .populate(
        "patient",
        "patientId name age gender phone bloodGroup cnicOrPassport",
      )
      .populate({
        path: "doctor",
        select: "name email department",
        populate: {
          path: "department",
          select: "name code",
        },
      })
      .populate("departmentRef", "name code consultationFee")
      .populate(
        "appointment",
        "appointmentNumber appointmentDate appointmentTime status",
      )
      .sort({ visitDate: 1, tokenNumber: 1 });

    return res.status(200).json({
      success: true,
      count: queue.length,
      data: queue,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch OPD token queue",
    });
  }
};

const startTokenConsultation = async (req, res) => {
  try {
    const token = await AppointmentToken.findById(req.params.id);

    if (!token) {
      return res.status(404).json({
        success: false,
        message: "Patient visit token was not found",
      });
    }

    if (token.doctor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to start this consultation",
      });
    }

    if (token.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: `Only pending tokens can start consultation. Current status: ${token.status}`,
      });
    }

    token.status = "In-Consultation";
    await token.save();

    const updatedToken = await AppointmentToken.findById(token._id)
      .populate(
        "patient",
        "patientId name age gender phone bloodGroup cnicOrPassport",
      )
      .populate("doctor", "name email")
      .populate("departmentRef", "name code consultationFee")
      .populate(
        "appointment",
        "appointmentNumber appointmentDate appointmentTime status",
      );

    return res.status(200).json({
      success: true,
      message: "Patient consultation started successfully",
      data: updatedToken,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to start consultation",
    });
  }
};

module.exports = {
  issueToken,
  getTokensQueue,
  startTokenConsultation,
};
