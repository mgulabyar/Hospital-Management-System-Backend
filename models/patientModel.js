const crypto = require("crypto"); // Built-in Node.js security package
const supabase = require("../config/db");

const Patient = {
  create: async (data) => {
    // 💾 CODE SE PROFESSIONAL ALPHANUMERIC ID GENERATE KARNA
    // Is se 8 characters ka random secure string bnega (e.g. 'weasd234')
    const secureRandomId = crypto.randomBytes(4).toString("hex");
    const customPatientId = `PAT-${secureRandomId}`; // Final Output: PAT-weasd234

    const { data: newPatient, error } = await supabase
      .from("patients")
      .insert([
        {
          patient_id: customPatientId, // Direct Primary Key me character ID bhej rahe hain!
          patient_name: data.patient_name,
          father_guardian_name: data.father_guardian_name,
          age: data.age,
          gender: data.gender,
          phone_number: data.phone_number,
          cnic_or_bform: data.cnic_or_bform,
        },
      ])
      .select();

    if (error) throw error;
    return newPatient;
  },
};

module.exports = Patient;
