const crypto = require('crypto');
const supabase = require('../config/db');

const Doctor = {
  create: async (data) => {
    const secureRandomId = crypto.randomBytes(4).toString('hex'); 
    const customDoctorId = `DOC-${secureRandomId}`; // Output format: DOC-weasd234

    const { data: newDoctor, error } = await supabase
      .from('doctors')
      .insert([
        {
          doctor_id: customDoctorId, // Character based key target
          doctor_name: data.doctor_name,
          pmdc_number: data.pmdc_number,
          qualification: data.qualification,
          department: data.department,
          doctor_fees: data.doctor_fees,
          phone_number: data.phone_number,
          room_number: data.room_number
        }
      ])
      .select();

    if (error) throw error;
    return newDoctor;
  }
};

module.exports = Doctor;
