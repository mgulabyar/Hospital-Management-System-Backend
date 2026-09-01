const PatientProfile = require("../models/patientProfile");

const registerPatient = async (req, res) => {
  try {
    const {
      name,
      age,
      gender,
      phone,
      cnicOrPassport,
      bloodGroup,
      address,
      emergencyContact,
    } = req.body;

    const patientExists = await PatientProfile.findOne({ phone });
    if (patientExists) {
      return res.status(400).json({
        success: false,
        message: "Patient with this phone number already exists",
      });
    }

    const totalRecords = await PatientProfile.countDocuments({});
    const patientId = `H-${1001 + totalRecords}`;

    const patient = await PatientProfile.create({
      patientId,
      name,
      age,
      gender,
      phone,
      cnicOrPassport,
      bloodGroup,
      address,
      emergencyContact,
    });

    return res.status(201).json({
      success: true,
      message: "Patient profile registered successfully",
      data: patient,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getPatients = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ],
      };
    }

    const patients = await PatientProfile.find(query);
    return res
      .status(200)
      .json({ success: true, count: patients.length, data: patients });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { registerPatient, getPatients };
