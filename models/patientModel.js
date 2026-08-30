const supabase = require('../config/db');

const Patient = {
  create: async (data) => {
    const { data: newPatient, error } = await supabase
      .from('patients')
      .insert([
        {
          patient_name: data.patient_name,
          father_guardian_name: data.father_guardian_name,
          age: data.age,
          gender: data.gender,
          phone_number: data.phone_number,
          cnic_or_bform: data.cnic_or_bform
        }
      ])
      .select();

    if (error) throw error;
    return newPatient;
  }
};

module.exports = Patient;
