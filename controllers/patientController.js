const PatientProfile = require("../models/patientProfile");
const { createAuditLog } = require("../utils/auditLogger");

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

    if (
      !name?.trim() ||
      age === undefined ||
      !gender ||
      !phone?.trim() ||
      !address?.trim() ||
      !emergencyContact?.name?.trim() ||
      !emergencyContact?.relation?.trim() ||
      !emergencyContact?.phone?.trim()
    ) {
      await createAuditLog({
        req,
        action: "REGISTER_PATIENT",
        module: "PATIENTS",
        description:
          "Patient registration failed because required fields were missing",
        status: "FAILURE",
        metadata: {
          patientName: name || "",
          phone: phone || "",
        },
      });

      return res.status(400).json({
        success: false,
        message: "Please provide all required patient profile details",
      });
    }

    const normalizedPhone = phone.trim();

    const patientExists = await PatientProfile.findOne({
      phone: normalizedPhone,
    });

    if (patientExists) {
      await createAuditLog({
        req,
        action: "REGISTER_PATIENT",
        module: "PATIENTS",
        description: `Patient registration rejected because phone ${normalizedPhone} already exists`,
        status: "FAILURE",
        entityType: "PatientProfile",
        entityId: patientExists._id,
        metadata: {
          phone: normalizedPhone,
        },
      });

      return res.status(409).json({
        success: false,
        message: "Patient with this phone number already exists",
      });
    }

    const normalizedAge = Number(age);

    if (
      !Number.isInteger(normalizedAge) ||
      normalizedAge < 0 ||
      normalizedAge > 150
    ) {
      await createAuditLog({
        req,
        action: "REGISTER_PATIENT",
        module: "PATIENTS",
        description: "Patient registration rejected due to invalid age",
        status: "FAILURE",
        metadata: {
          age,
          phone: normalizedPhone,
        },
      });

      return res.status(400).json({
        success: false,
        message: "Patient age must be a whole number between 0 and 150",
      });
    }

    const totalRecords = await PatientProfile.countDocuments({});
    const patientId = `H-${1001 + totalRecords}`;

    const patient = await PatientProfile.create({
      patientId,
      name: name.trim(),
      age: normalizedAge,
      gender,
      phone: normalizedPhone,
      cnicOrPassport: cnicOrPassport?.trim() || "",
      bloodGroup: bloodGroup || "O+",
      address: address.trim(),
      emergencyContact: {
        name: emergencyContact.name.trim(),
        relation: emergencyContact.relation.trim(),
        phone: emergencyContact.phone.trim(),
      },
    });

    await createAuditLog({
      req,
      action: "REGISTER_PATIENT",
      module: "PATIENTS",
      description: `Patient profile ${patient.patientId} registered successfully for ${patient.name}`,
      status: "SUCCESS",
      entityType: "PatientProfile",
      entityId: patient._id,
      metadata: {
        patientId: patient.patientId,
        patientName: patient.name,
        phone: patient.phone,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Patient profile registered successfully",
      data: patient,
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "REGISTER_PATIENT",
      module: "PATIENTS",
      description: "Patient registration failed due to a server error",
      status: "FAILURE",
      metadata: {
        error: error.message,
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to register patient profile",
    });
  }
};

const getPatients = async (req, res) => {
  try {
    const { search } = req.query;

    let query = {};

    if (search?.trim()) {
      query = {
        $or: [
          {
            name: {
              $regex: search.trim(),
              $options: "i",
            },
          },
          {
            phone: {
              $regex: search.trim(),
              $options: "i",
            },
          },
          {
            patientId: {
              $regex: search.trim(),
              $options: "i",
            },
          },
        ],
      };
    }

    const patients = await PatientProfile.find(query).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: patients.length,
      data: patients,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch patient profiles",
    });
  }
};

module.exports = {
  registerPatient,
  getPatients,
};
