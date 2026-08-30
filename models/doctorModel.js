const crypto = require('crypto');
const supabase = require('../config/db');

const Doctor = {
  // Doctor create karne ka function
  create: async (data) => {
    const secureRandomId = crypto.randomBytes(4).toString('hex'); 
    const customDoctorId = `DOC-${secureRandomId}`; // e.g. DOC-a1b2c3d4

    const { data: newDoctor, error } = await supabase
      .from('doctors')
      .insert([
        {
          doctor_id: customDoctorId,
          doctor_name: data.doctor_name,
          pmdc_number: data.pmdc_number,
          qualification: data.qualification,
          department_id: data.department_id, // Connected Department Key (e.g. DEP-cardio)
          doctor_fees: data.doctor_fees,
          phone_number: data.phone_number,
          room_number: data.room_number
        }
      ])
      .select();

    if (error) throw error;
    return newDoctor;
  },

  // Sare Departments dropdown ke liye fetch karne ka function
  getAllDepartments: async () => {
    const { data: departments, error } = await supabase
      .from('departments')
      .select('*');

    if (error) throw error;
    return departments;
  }
};

module.exports = Doctor;
