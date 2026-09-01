const patientModel = require("../models/patientModel");

// 1. CREATE: Naya Patient Register Karna
async function registerPatient(req, res) {
  try {
    const record = await patientModel.create(req.body, req.user.user_id);
    res
      .status(201)
      .json({ message: "Patient Registered Successfully!", data: record });
  } catch (err) {
    if (err.code === "23505") {
      return res
        .status(400)
        .json({ error: "Patient with this phone number already exists!" });
    }
    res.status(500).json({ error: err.message });
  }
}

// 2. READ ALL: Saare Patients Ki List Lene Ka Function
async function getAllPatients(req, res) {
  try {
    const list = await patientModel.findAll();
    res.status(200).json({ total: list.length, data: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// 3. READ SINGLE: ID Se Patient Dhoondna
async function getPatientDetails(req, res) {
  try {
    const data = await patientModel.findById(req.params.id);
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Patient record not found!" });
    }
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// 4. UPDATE: Patient Ka Data Update (Correction) Karna
async function updatePatientInfo(req, res) {
  try {
    const data = await patientModel.update(req.params.id, req.body);
    if (!data || data.length === 0) {
      return res
        .status(404)
        .json({ error: "Targeted patient records not found!" });
    }
    res.status(200).json({ message: "Patient information updated.", data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deletePatientRecord(req, res) {
  try {
    const deleted = await patientModel.remove(req.params.id);
    if (!deleted || deleted.length === 0) {
      return res
        .status(404)
        .json({ error: "Patient profile not found to delete!" });
    }
    res
      .status(200)
      .json({ message: "Patient record completely deleted!", data: deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  registerPatient,
  getAllPatients,
  getPatientDetails,
  updatePatientInfo,
  deletePatientRecord,
};
