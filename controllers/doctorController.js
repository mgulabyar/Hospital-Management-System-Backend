const Doctor = require("../models/doctorModel");

const registerDoctor = async (req, res) => {
  const {
    doctor_name,
    pmdc_number,
    qualification,
    department,
    doctor_fees,
    phone_number,
    room_number,
  } = req.body;

  // Validation Checklist
  if (
    !doctor_name ||
    !pmdc_number ||
    !qualification ||
    !department ||
    !doctor_fees ||
    !phone_number ||
    !room_number
  ) {
    return res
      .status(400)
      .json({ error: "All 7 doctor fields are strictly required!" });
  }

  try {
    const newDoctor = await Doctor.create(req.body);
    res.status(201).json({
      message: "Doctor Registered Successfully!",
      doctor: newDoctor,
    });
  } catch (err) {
    console.error("Doctor Controller Error:", err.message);

    if (err.code === "23505") {
      return res
        .status(400)
        .json({ error: "This doctor phone number is already registered!" });
    }

    res.status(500).json({ error: "Database Error while saving doctor data." });
  }
};

module.exports = { registerDoctor };
