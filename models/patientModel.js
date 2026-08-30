const supabase = require('../config/db')
const crypto = require('crypto')

// 1. Patient Register (Create) Function
async function create(data) {
  const secureRandomId = crypto.randomBytes(4).toString('hex') 
  const customPatientId = `PAT-${secureRandomId}` 

  const { data: newPatient, error } = await supabase
    .from('patients')
    .insert([
      {
        patient_id: customPatientId,
        patient_name: data.patient_name,
        father_guardian_name: data.father_guardian_name,
        age: data.age,
        gender: data.gender,
        phone_number: data.phone_number,
        cnic_or_bform: data.cnic_or_bform,
        address: data.address 
      }
    ])
    .select()

  if (error) throw error
  return newPatient
}

// 2. Saare Patients Get (FindAll) Function
async function findAll() {
  const { data: patients, error } = await supabase
    .from('patients')
    .select('*')
    
  if (error) throw error
  return patients
}

// 3. Kisi Ek Patient Ko ID Se Get (FindById) Function
async function findById(id) {
  const { data: patient, error } = await supabase
    .from('patients')
    .select('*')
    .eq('patient_id', id)
    
  if (error) throw error
  return patient
}

// 4. Patient Ka Data Update Function
async function update(id, updatedData) {
  const { data: patient, error } = await supabase
    .from('patients')
    .update({
      patient_name: updatedData.patient_name,
      father_guardian_name: updatedData.father_guardian_name,
      age: updatedData.age,
      gender: updatedData.gender,
      phone_number: updatedData.phone_number,
      cnic_or_bform: updatedData.cnic_or_bform,
      address: updatedData.address 
    })
    .eq('patient_id', id)
    .select()

  if (error) throw error
  return patient
}

// 5. Patient Ka Data Delete Function
async function remove(id) {
  const { data, error } = await supabase
    .from('patients')
    .delete()
    .eq('patient_id', id)
    .select()
    
  if (error) throw error
  return data
}

// Yahan check karein ke 'remove' sahi tarah export ho raha hai
module.exports = {
  create,
  findAll,
  findById,
  update,
  remove
}
