const AppointmentToken = require("../models/appointmentToken");
const User = require("../models/User");

const issueToken = async (req, res) => {
  try {
    const { patient, doctor, department, vitals } = req.body;

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

    const dailyTokensCount = await AppointmentToken.countDocuments({
      doctor,
      createdAt: { $gte: startOfToday, $lte: endOfToday },
    });

    const tokenNumber = dailyTokensCount + 1;

    const token = await AppointmentToken.create({
      tokenNumber,
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
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getTokensQueue = async (req, res) => {
  try {
    const { doctor, status } = req.query;
    let filter = {};

    if (doctor) filter.doctor = doctor;
    if (status) filter.status = status;

    const queue = await AppointmentToken.find(filter)
      .populate("patient", "patientId name age gender phone")
      .populate("doctor", "name");

    return res
      .status(200)
      .json({ success: true, count: queue.length, data: queue });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { issueToken, getTokensQueue };
