const Doctor = require("../models/doctorModel");

// 1. Doctor Register Logic
const registerDoctor = async (req, res) => {
  const {
    doctor_name,
    pmdc_number,
    qualification,
    department_id,
    doctor_fees,
    phone_number,
    room_number,
  } = req.body;

  if (
    !doctor_name ||
    !pmdc_number ||
    !qualification ||
    !department_id ||
    !doctor_fees ||
    !phone_number ||
    !room_number
  ) {
    return res.status(400).json({ error: "All 7 doctor fields are required!" });
  }

  try {
    const newDoctor = await Doctor.create(req.body);
    res
      .status(201)
      .json({ message: "Doctor Registered Successfully!", doctor: newDoctor });
  } catch (err) {
    console.error(err.message);
    if (err.code === "23505") {
      return res
        .status(400)
        .json({ error: "This doctor phone number is already registered!" });
    }
    res.status(500).json({ error: "Database Error while saving doctor." });
  }
};

const getDepartmentsList = async (req, res) => {
  try {
    const list = await Doctor.getAllDepartments();
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch departments list." });
  }
};

module.exports = { registerDoctor, getDepartmentsList };
