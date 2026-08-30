const Patient = require("../models/patientModel");

const registerPatient = async (req, res) => {
  const {
    patient_name,
    father_guardian_name,
    age,
    gender,
    phone_number,
    cnic_or_bform,
  } = req.body;

  if (
    !patient_name ||
    !father_guardian_name ||
    !age ||
    !gender ||
    !phone_number ||
    !cnic_or_bform
  ) {
    return res
      .status(400)
      .json({ error: "All 6 fields are strictly required!" });
  }

  try {
    const newPatient = await Patient.create(req.body);

    res.status(201).json({
      message: "Patient Registered Successfully!",
      patient: newPatient,
    });
  } catch (err) {
    console.error("Controller Error:", err.message);

    if (err.code === "23505") {
      return res
        .status(400)
        .json({ error: "This phone number is already registered!" });
    }

    res
      .status(500)
      .json({ error: "Database Error while saving patient data." });
  }
};

module.exports = { registerPatient };
