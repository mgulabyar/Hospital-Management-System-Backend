const supabase = require('../config/db');

const Patient = {
  create: async (data) => {
    const crypto = require('crypto');
    const secureRandomId = crypto.randomBytes(4).toString('hex'); 
    const customPatientId = `PAT-${secureRandomId}`; 

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
      .select();

    if (error) throw error;
    return newPatient;
  },

  findAll: async () => {
    const { data: patients, error } = await supabase
      .from('patients')
      .select('*');
    if (error) throw error;
    return patients;
  },

  findById: async (id) => {
    const { data: patient, error } = await supabase
      .from('patients')
      .select('*')
      .eq('patient_id', id);
    if (error) throw error;
    return patient;
  },

  update: async (id, updatedData) => {
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
      .select();

    if (error) throw error;
    return patient;
  },

  delete: async (id) => {
    const { data, error } = await supabase
      .from('patients')
      .delete()
      .eq('patient_id', id)
      .select();
    if (error) throw error;
    return data;
  }
};

module.exports = Patient;
