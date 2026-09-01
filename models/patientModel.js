const patientModel = require("../models/patientModel");

// 1. CREATE: Naya patient register karne ka logic tracking user identifiers session
async function registerPatient(req, res) {
  try {
    // Model query pass explicit tracking using mapped middleware identifiers
    const record = await patientModel.create(req.body, req.user.user_id);
    res
      .status(201)
      .json({ message: "Patient Registered Successfully!", data: record });
  } catch (err) {
    // Duplicate phone check standard parameter code key handle
    if (err.code === "23505") {
      return res
        .status(400)
        .json({ error: "Patient with this phone number already exists!" });
    }
    res.status(500).json({ error: err.message });
  }
}

// 2. READ ALL: Saare patients calculations and arrays retrieval lists
async function getAllPatients(req, res) {
  try {
    const list = await patientModel.findAll();
    res.status(200).json({ total: list.length, data: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// 3. READ SINGLE: Specific single identifier lookup profiling target
async function getPatientDetails(req, res) {
  try {
    const data = await patientModel.findById(req.params.id);
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Patient record not found!" });
    }
    res.status(200).json(data[0]); // Dynamic array destructing extraction
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// 4. UPDATE: Profile metrics data patching override data processing logic
async function updatePatientInfo(req, res) {
  try {
    const data = await patientModel.update(req.params.id, req.body);
    if (!data || data.length === 0) {
      return res
        .status(404)
        .json({ error: "Targeted patient row profile records not found!" });
    }
    res.status(200).json({ message: "Patient information updated.", data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ⭐ 5. DELETE (NEW): Patient tracking data permanently truncation controller function
async function deletePatientRecord(req, res) {
  try {
    const deleted = await patientModel.remove(req.params.id);
    if (!deleted || deleted.length === 0) {
      return res
        .status(404)
        .json({
          error: "Patient profile row not found to delete from database!",
        });
    }
    res
      .status(200)
      .json({
        message:
          "Patient record completely deleted from central database logs!",
        data: deleted,
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  registerPatient,
  getAllPatients,
  getPatientDetails,
  updatePatientInfo,
  deletePatientRecord, // New export link verified successfully here
};
