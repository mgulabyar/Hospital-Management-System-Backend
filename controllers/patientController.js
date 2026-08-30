const patientModel = require('../models/patientModel')

// 1. Naya Patient Register Karne Ka Function
async function registerPatient(req, res) {
  const { patient_name, father_guardian_name, age, gender, phone_number, cnic_or_bform, address } = req.body

  if (!patient_name || !father_guardian_name || !age || !gender || !phone_number || !cnic_or_bform || !address) {
    return res.status(400).json({ error: "All 7 patient fields are strictly required!" })
  }

  try {
    const newPatient = await patientModel.create(req.body)
    res.status(201).json({ message: "Patient Registered Successfully!", patient: newPatient })
  } catch (err) {
    console.error(err)
    if (err.code === '23505') {
      return res.status(400).json({ error: "This phone number is already registered!" })
    }
    res.status(500).json({ error: "Database error while saving patient." })
  }
}

// 2. Saare Patients Ki List Lene Ka Function
async function getAllPatients(req, res) {
  try {
    const list = await patientModel.findAll()
    res.status(200).json({ total: list.length, data: list })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 3. Kisi Aik Patient Ko ID Se Search Karne Ka Function
async function getPatientById(req, res) {
  const id = req.params.id
  try {
    const patient = await patientModel.findById(id)
    if (!patient || patient.length === 0) {
      return res.status(404).json({ error: "Patient not found!" })
    }
    res.status(200).json(patient)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 4. Patient Ka Data Update (Correction) Karne Ka Function
async function updatePatientProfile(req, res) {
  const id = req.params.id
  const { patient_name, father_guardian_name, age, gender, phone_number, cnic_or_bform, address } = req.body

  if (!patient_name || !father_guardian_name || !age || !gender || !phone_number || !cnic_or_bform || !address) {
    return res.status(400).json({ error: "All 7 fields are required for updates!" })
  }

  try {
    const updatedRecord = await patientModel.update(id, req.body)
    if (!updatedRecord || updatedRecord.length === 0) {
      return res.status(404).json({ error: "Patient profile does not exist!" })
    }
    res.status(200).json({ message: "Patient Profile Updated Successfully!", data: updatedRecord })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// 5. Patient Ka Record Delete (Remove) Karne Ka Function
async function removePatientRecord(req, res) {
  const id = req.params.id
  try {
    const deletedData = await patientModel.remove(id)
    if (!deletedData || deletedData.length === 0) {
      return res.status(404).json({ error: "Record not found to delete!" })
    }
    res.status(200).json({ message: "Patient Record Deleted Permanently!", data: deletedData })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  registerPatient,
  getAllPatients,
  getPatientById,
  updatePatientProfile,
  removePatientRecord
}
