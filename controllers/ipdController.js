const Ward = require("../models/Ward");
const IPDAdmission = require("../models/IPDAdmission");
const PatientProfile = require("../models/patientProfile");
const User = require("../models/User");
const { createAuditLog } = require("../utils/auditLogger");

const WARD_TYPES = [
  "General",
  "Private",
  "Semi-Private",
  "ICU",
  "Emergency",
  "Maternity",
  "Pediatric",
  "Isolation",
];

const getNextAdmissionNumber = async () => {
  const year = new Date().getFullYear();

  const latestAdmission = await IPDAdmission.findOne({
    admissionNumber: new RegExp(`^IPD-${year}-`),
  })
    .sort({ createdAt: -1 })
    .select("admissionNumber");

  let nextSequence = 1;

  if (latestAdmission?.admissionNumber) {
    const previousSequence = Number(
      latestAdmission.admissionNumber.split("-").pop(),
    );

    if (!Number.isNaN(previousSequence)) {
      nextSequence = previousSequence + 1;
    }
  }

  return `IPD-${year}-${String(nextSequence).padStart(5, "0")}`;
};

const getWardOccupancy = (ward) => {
  const totalBeds = ward.beds.length;

  const availableBeds = ward.beds.filter(
    (bed) => bed.status === "Available",
  ).length;

  const occupiedBeds = ward.beds.filter(
    (bed) => bed.status === "Occupied",
  ).length;

  const maintenanceBeds = ward.beds.filter(
    (bed) => bed.status === "Maintenance",
  ).length;

  return {
    totalBeds,
    availableBeds,
    occupiedBeds,
    maintenanceBeds,
  };
};

const populateAdmission = async (admissionId) => {
  return IPDAdmission.findById(admissionId)
    .populate("patient", "patientId name age gender phone bloodGroup")
    .populate("ward", "name code wardType floor")
    .populate("admittedBy", "name email role")
    .populate("attendingDoctor", "name email department");
};

const createWard = async (req, res) => {
  try {
    const { name, code, wardType, floor, beds } = req.body;

    if (!name?.trim() || !code?.trim()) {
      await createAuditLog({
        req,
        action: "CREATE_WARD",
        module: "IPD",
        description:
          "Ward creation failed because ward name or code was missing",
        status: "FAILURE",
      });

      return res.status(400).json({
        success: false,
        message: "Ward name and ward code are required",
      });
    }

    const normalizedWardType = wardType || "General";

    if (!WARD_TYPES.includes(normalizedWardType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ward type provided",
      });
    }

    const normalizedName = name.trim().toUpperCase();
    const normalizedCode = code.trim().toUpperCase();

    const existingWard = await Ward.findOne({
      $or: [
        {
          name: normalizedName,
        },
        {
          code: normalizedCode,
        },
      ],
    });

    if (existingWard) {
      await createAuditLog({
        req,
        action: "CREATE_WARD",
        module: "IPD",
        description: `Ward creation rejected because ${normalizedName} or ${normalizedCode} already exists`,
        status: "FAILURE",
        entityType: "Ward",
        entityId: existingWard._id,
      });

      return res.status(409).json({
        success: false,
        message: "A ward with this name or code already exists",
      });
    }

    const bedList = Array.isArray(beds) ? beds : [];

    const normalizedBeds = bedList
      .map((bed) =>
        typeof bed === "string"
          ? {
              bedNumber: bed.trim().toUpperCase(),
            }
          : {
              bedNumber: String(bed?.bedNumber || "")
                .trim()
                .toUpperCase(),
              status: bed?.status || "Available",
            },
      )
      .filter((bed) => bed.bedNumber);

    const uniqueBedNumbers = new Set(
      normalizedBeds.map((bed) => bed.bedNumber),
    );

    if (uniqueBedNumbers.size !== normalizedBeds.length) {
      return res.status(400).json({
        success: false,
        message: "Duplicate bed numbers are not allowed inside one ward",
      });
    }

    const ward = await Ward.create({
      name: normalizedName,
      code: normalizedCode,
      wardType: normalizedWardType,
      floor: floor?.trim() || "Ground Floor",
      beds: normalizedBeds,
    });

    await createAuditLog({
      req,
      action: "CREATE_WARD",
      module: "IPD",
      description: `Ward ${ward.name} (${ward.code}) created successfully`,
      status: "SUCCESS",
      entityType: "Ward",
      entityId: ward._id,
      metadata: {
        wardName: ward.name,
        wardCode: ward.code,
        wardType: ward.wardType,
        floor: ward.floor,
        totalBeds: ward.beds.length,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Ward created successfully",
      data: {
        ...ward.toObject(),
        occupancy: getWardOccupancy(ward),
      },
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "CREATE_WARD",
      module: "IPD",
      description: "Ward creation failed due to a server error",
      status: "FAILURE",
      metadata: {
        error: error.message,
      },
    });

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A ward with this name or code already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create ward",
    });
  }
};

const getWards = async (req, res) => {
  try {
    const { activeOnly } = req.query;

    const filter = {};

    if (activeOnly === "true") {
      filter.isActive = true;
    }

    const wards = await Ward.find(filter).sort({
      wardType: 1,
      name: 1,
    });

    const wardData = wards.map((ward) => ({
      ...ward.toObject(),
      occupancy: getWardOccupancy(ward),
    }));

    return res.status(200).json({
      success: true,
      count: wardData.length,
      data: wardData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch wards",
    });
  }
};

const updateWard = async (req, res) => {
  try {
    const { name, code, wardType, floor, isActive } = req.body;

    const ward = await Ward.findById(req.params.id);

    if (!ward) {
      return res.status(404).json({
        success: false,
        message: "Ward was not found",
      });
    }

    const previousData = {
      name: ward.name,
      code: ward.code,
      wardType: ward.wardType,
      floor: ward.floor,
      isActive: ward.isActive,
    };

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Ward name cannot be empty",
        });
      }

      ward.name = name.trim().toUpperCase();
    }

    if (code !== undefined) {
      if (!code.trim()) {
        return res.status(400).json({
          success: false,
          message: "Ward code cannot be empty",
        });
      }

      ward.code = code.trim().toUpperCase();
    }

    if (wardType !== undefined) {
      if (!WARD_TYPES.includes(wardType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ward type provided",
        });
      }

      ward.wardType = wardType;
    }

    if (floor !== undefined) {
      ward.floor = floor.trim() || "Ground Floor";
    }

    if (typeof isActive === "boolean") {
      ward.isActive = isActive;
    }

    await ward.save();

    await createAuditLog({
      req,
      action: "UPDATE_WARD",
      module: "IPD",
      description: `Ward ${ward.name} updated successfully`,
      status: "SUCCESS",
      entityType: "Ward",
      entityId: ward._id,
      metadata: {
        previousData,
        updatedData: {
          name: ward.name,
          code: ward.code,
          wardType: ward.wardType,
          floor: ward.floor,
          isActive: ward.isActive,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Ward updated successfully",
      data: {
        ...ward.toObject(),
        occupancy: getWardOccupancy(ward),
      },
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "UPDATE_WARD",
      module: "IPD",
      description: "Ward update failed due to a server error",
      status: "FAILURE",
      metadata: {
        wardId: req.params.id,
        error: error.message,
      },
    });

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A ward with this name or code already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update ward",
    });
  }
};

const addBedToWard = async (req, res) => {
  try {
    const { bedNumber } = req.body;

    if (!bedNumber?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Bed number is required",
      });
    }

    const ward = await Ward.findById(req.params.id);

    if (!ward) {
      return res.status(404).json({
        success: false,
        message: "Ward was not found",
      });
    }

    const normalizedBedNumber = bedNumber.trim().toUpperCase();

    const bedExists = ward.beds.some(
      (bed) => bed.bedNumber === normalizedBedNumber,
    );

    if (bedExists) {
      return res.status(409).json({
        success: false,
        message: "This bed number already exists in the selected ward",
      });
    }

    ward.beds.push({
      bedNumber: normalizedBedNumber,
      status: "Available",
    });

    await ward.save();

    const newBed = ward.beds[ward.beds.length - 1];

    await createAuditLog({
      req,
      action: "ADD_WARD_BED",
      module: "IPD",
      description: `Bed ${newBed.bedNumber} added to ward ${ward.name}`,
      status: "SUCCESS",
      entityType: "Ward",
      entityId: ward._id,
      metadata: {
        wardName: ward.name,
        bedNumber: newBed.bedNumber,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Bed added to ward successfully",
      data: {
        ward: {
          ...ward.toObject(),
          occupancy: getWardOccupancy(ward),
        },
        bed: newBed,
      },
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "ADD_WARD_BED",
      module: "IPD",
      description: "Adding bed to ward failed due to a server error",
      status: "FAILURE",
      metadata: {
        wardId: req.params.id,
        error: error.message,
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to add bed to ward",
    });
  }
};

const updateBedStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = ["Available", "Maintenance"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Bed status can only be changed to Available or Maintenance manually",
      });
    }

    const ward = await Ward.findById(req.params.id);

    if (!ward) {
      return res.status(404).json({
        success: false,
        message: "Ward was not found",
      });
    }

    const bed = ward.beds.id(req.params.bedId);

    if (!bed) {
      return res.status(404).json({
        success: false,
        message: "Bed was not found in this ward",
      });
    }

    if (bed.status === "Occupied") {
      return res.status(400).json({
        success: false,
        message:
          "Occupied beds cannot be manually updated. Discharge or transfer the active admission first.",
      });
    }

    const previousStatus = bed.status;

    bed.status = status;

    await ward.save();

    await createAuditLog({
      req,
      action: "UPDATE_BED_STATUS",
      module: "IPD",
      description: `Bed ${bed.bedNumber} in ward ${ward.name} changed from ${previousStatus} to ${status}`,
      status: "SUCCESS",
      entityType: "Ward",
      entityId: ward._id,
      metadata: {
        wardName: ward.name,
        bedId: bed._id,
        bedNumber: bed.bedNumber,
        previousStatus,
        currentStatus: status,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Bed status updated successfully",
      data: {
        ward: {
          ...ward.toObject(),
          occupancy: getWardOccupancy(ward),
        },
        bed,
      },
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "UPDATE_BED_STATUS",
      module: "IPD",
      description: "Bed status update failed due to a server error",
      status: "FAILURE",
      metadata: {
        wardId: req.params.id,
        bedId: req.params.bedId,
        error: error.message,
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update bed status",
    });
  }
};

const createIPDAdmission = async (req, res) => {
  try {
    const {
      patient,
      ward,
      bedId,
      attendingDoctor,
      admissionReason,
      initialNotes,
    } = req.body;

    if (!patient || !ward || !bedId || !admissionReason?.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Patient, ward, bed, and admission reason are required for IPD admission",
      });
    }

    const [patientProfile, wardRecord] = await Promise.all([
      PatientProfile.findById(patient),
      Ward.findById(ward),
    ]);

    if (!patientProfile) {
      return res.status(404).json({
        success: false,
        message: "Selected patient profile was not found",
      });
    }

    if (!wardRecord || !wardRecord.isActive) {
      return res.status(400).json({
        success: false,
        message: "Selected ward does not exist or is inactive",
      });
    }

    const selectedBed = wardRecord.beds.id(bedId);

    if (!selectedBed) {
      return res.status(404).json({
        success: false,
        message: "Selected bed was not found in this ward",
      });
    }

    if (selectedBed.status !== "Available") {
      return res.status(400).json({
        success: false,
        message: `Bed ${selectedBed.bedNumber} is currently ${selectedBed.status}`,
      });
    }

    const existingAdmission = await IPDAdmission.findOne({
      patient,
      status: "Admitted",
    });

    if (existingAdmission) {
      return res.status(409).json({
        success: false,
        message: "This patient already has an active IPD admission",
      });
    }

    let doctor = null;

    if (attendingDoctor) {
      doctor = await User.findById(attendingDoctor);

      if (!doctor || doctor.role !== "doctor" || !doctor.isActive) {
        return res.status(400).json({
          success: false,
          message: "Selected attending doctor is invalid or inactive",
        });
      }
    }

    const admissionNumber = await getNextAdmissionNumber();

    const admission = await IPDAdmission.create({
      admissionNumber,
      patient,
      ward,
      bedId: selectedBed._id,
      bedNumber: selectedBed.bedNumber,
      admittedBy: req.user._id,
      attendingDoctor: doctor?._id || null,
      admissionReason: admissionReason.trim(),
      initialNotes: initialNotes?.trim() || "",
      status: "Admitted",
    });

    selectedBed.status = "Occupied";
    selectedBed.currentAdmission = admission._id;

    await wardRecord.save();

    const populatedAdmission = await populateAdmission(admission._id);

    await createAuditLog({
      req,
      action: "CREATE_IPD_ADMISSION",
      module: "IPD",
      description: `Patient ${patientProfile.name} admitted to ${wardRecord.name}, bed ${selectedBed.bedNumber}`,
      status: "SUCCESS",
      entityType: "IPDAdmission",
      entityId: admission._id,
      metadata: {
        admissionNumber,
        patientId: patientProfile.patientId,
        patientName: patientProfile.name,
        wardName: wardRecord.name,
        wardCode: wardRecord.code,
        bedNumber: selectedBed.bedNumber,
        attendingDoctor: doctor?.name || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Patient admitted to IPD successfully",
      data: populatedAdmission,
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "CREATE_IPD_ADMISSION",
      module: "IPD",
      description: "Patient IPD admission failed due to a server error",
      status: "FAILURE",
      metadata: {
        error: error.message,
      },
    });

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This patient already has an active IPD admission",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to admit patient to IPD",
    });
  }
};

const getIPDAdmissions = async (req, res) => {
  try {
    const { status, ward, patient, doctor } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (ward) {
      filter.ward = ward;
    }

    if (patient) {
      filter.patient = patient;
    }

    if (doctor) {
      filter.attendingDoctor = doctor;
    }

    if (req.user.role === "doctor") {
      filter.attendingDoctor = req.user._id;
    }

    const admissions = await IPDAdmission.find(filter)
      .populate("patient", "patientId name age gender phone bloodGroup")
      .populate("ward", "name code wardType floor")
      .populate("admittedBy", "name email role")
      .populate("attendingDoctor", "name email department")
      .sort({ admissionDate: -1 });

    return res.status(200).json({
      success: true,
      count: admissions.length,
      data: admissions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch IPD admissions",
    });
  }
};

const dischargePatient = async (req, res) => {
  try {
    const { dischargeSummary } = req.body;

    const admission = await IPDAdmission.findById(req.params.id)
      .populate("patient", "patientId name")
      .populate("ward", "name code beds");

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: "IPD admission record was not found",
      });
    }

    if (admission.status !== "Admitted") {
      return res.status(400).json({
        success: false,
        message: `Only admitted patients can be discharged. Current status: ${admission.status}`,
      });
    }

    const ward = await Ward.findById(admission.ward._id);

    if (!ward) {
      return res.status(404).json({
        success: false,
        message: "Assigned ward was not found",
      });
    }

    const bed = ward.beds.id(admission.bedId);

    if (!bed) {
      return res.status(404).json({
        success: false,
        message: "Assigned bed was not found in the ward",
      });
    }

    admission.status = "Discharged";
    admission.dischargeDate = new Date();
    admission.dischargeSummary = dischargeSummary?.trim() || "";

    await admission.save();

    bed.status = "Available";
    bed.currentAdmission = null;

    await ward.save();

    const populatedAdmission = await populateAdmission(admission._id);

    await createAuditLog({
      req,
      action: "DISCHARGE_IPD_PATIENT",
      module: "IPD",
      description: `Patient ${admission.patient.name} discharged from ${ward.name}, bed ${bed.bedNumber}`,
      status: "SUCCESS",
      entityType: "IPDAdmission",
      entityId: admission._id,
      metadata: {
        admissionNumber: admission.admissionNumber,
        patientId: admission.patient.patientId,
        patientName: admission.patient.name,
        wardName: ward.name,
        bedNumber: bed.bedNumber,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Patient discharged and bed released successfully",
      data: populatedAdmission,
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "DISCHARGE_IPD_PATIENT",
      module: "IPD",
      description: "IPD patient discharge failed due to a server error",
      status: "FAILURE",
      metadata: {
        admissionId: req.params.id,
        error: error.message,
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to discharge IPD patient",
    });
  }
};

const getIPDDashboard = async (req, res) => {
  try {
    const wards = await Ward.find({
      isActive: true,
    });

    const occupancy = wards.reduce(
      (summary, ward) => {
        const wardOccupancy = getWardOccupancy(ward);

        summary.totalWards += 1;
        summary.totalBeds += wardOccupancy.totalBeds;
        summary.availableBeds += wardOccupancy.availableBeds;
        summary.occupiedBeds += wardOccupancy.occupiedBeds;
        summary.maintenanceBeds += wardOccupancy.maintenanceBeds;

        return summary;
      },
      {
        totalWards: 0,
        totalBeds: 0,
        availableBeds: 0,
        occupiedBeds: 0,
        maintenanceBeds: 0,
      },
    );

    const activeAdmissions = await IPDAdmission.countDocuments({
      status: "Admitted",
    });

    return res.status(200).json({
      success: true,
      data: {
        ...occupancy,
        activeAdmissions,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch IPD dashboard",
    });
  }
};

module.exports = {
  createWard,
  getWards,
  updateWard,
  addBedToWard,
  updateBedStatus,
  createIPDAdmission,
  getIPDAdmissions,
  dischargePatient,
  getIPDDashboard,
};
