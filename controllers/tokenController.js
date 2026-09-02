const AppointmentToken = require("../models/appointmentToken");
const User = require("../models/User");

const departmentPrefixes = {
  "General OPD": "GEN",
  Cardiology: "CARD",
  Pediatrics: "PED",
  ENT: "ENT",
  Orthopedics: "ORTHO",
  Gynecology: "GYNE",
  Dermatology: "DERM",
  Ophthalmology: "OPTH",
  Neurology: "NEURO",
  Gastroenterology: "GASTRO",
  Urology: "URO",
  Psychiatry: "PSY",
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

    const assignedDoctor = await User.findById(doctor);

    if (!assignedDoctor || assignedDoctor.role !== "doctor") {
      return res.status(400).json({
        success: false,
        message: "Assigned user id is not a valid doctor",
      });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const dailyDepartmentTokensCount = await AppointmentToken.countDocuments({
      department,
      visitDate: {
        $gte: startOfToday,
        $lte: endOfToday,
      },
    });

    const tokenNumber = dailyDepartmentTokensCount + 1;

    const departmentPrefix = departmentPrefixes[department] || "OPD";

    const displayToken = `${departmentPrefix}-${String(tokenNumber).padStart(
      3,
      "0",
    )}`;

    const token = await AppointmentToken.create({
      tokenNumber,
      displayToken,
      patient,
      doctor,
      department,
      vitals,
    });

    return res.status(201).json({
      success: true,
      message: "OPD Token generated successfully",
      data: token,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getTokensQueue = async (req, res) => {
  try {
    const { doctor, status, department } = req.query;

    const filter = {};

    if (doctor) {
      filter.doctor = doctor;
    }

    if (status) {
      filter.status = status;
    }

    if (department) {
      filter.department = department;
    }

    const queue = await AppointmentToken.find(filter)
      .populate(
        "patient",
        "patientId name age gender phone bloodGroup cnicOrPassport",
      )
      .populate("doctor", "name")
      .sort({ visitDate: 1, tokenNumber: 1 });

    return res.status(200).json({
      success: true,
      count: queue.length,
      data: queue,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  issueToken,
  getTokensQueue,
};
