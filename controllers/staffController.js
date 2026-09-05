const User = require("../models/User");
const Department = require("../models/Department");
const { createAuditLog } = require("../utils/auditLogger");

const STAFF_ROLES = [
  "doctor",
  "receptionist",
  "pharmacist",
  "laboratorian",
  "accountant",
];

const validateDoctorDepartment = async (role, departmentId) => {
  if (role !== "doctor") {
    return {
      valid: true,
      department: null,
    };
  }

  if (!departmentId) {
    return {
      valid: false,
      message: "Please assign a department to the doctor account",
    };
  }

  const department = await Department.findById(departmentId);

  if (!department) {
    return {
      valid: false,
      message: "Selected department was not found",
    };
  }

  if (!department.isActive) {
    return {
      valid: false,
      message: "An inactive department cannot be assigned to a doctor",
    };
  }

  return {
    valid: true,
    department,
  };
};

const createStaff = async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;

    if (!name?.trim() || !email?.trim() || !password || !role) {
      await createAuditLog({
        req,
        action: "CREATE_STAFF",
        module: "STAFF",
        description:
          "Staff account creation failed because required fields were missing",
        status: "FAILURE",
        metadata: {
          email: email || "",
          role: role || "",
        },
      });

      return res.status(400).json({
        success: false,
        message: "Please provide all details including role",
      });
    }

    if (!STAFF_ROLES.includes(role)) {
      await createAuditLog({
        req,
        action: "CREATE_STAFF",
        module: "STAFF",
        description: `Staff account creation failed because role ${role} is invalid`,
        status: "FAILURE",
        metadata: {
          email,
          role,
        },
      });

      return res.status(400).json({
        success: false,
        message: "Invalid staff role provided",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const userExists = await User.findOne({
      email: normalizedEmail,
    });

    if (userExists) {
      await createAuditLog({
        req,
        action: "CREATE_STAFF",
        module: "STAFF",
        description: `Staff account creation rejected because email ${normalizedEmail} already exists`,
        status: "FAILURE",
        entityType: "User",
        entityId: userExists._id,
        metadata: {
          email: normalizedEmail,
          role,
        },
      });

      return res.status(409).json({
        success: false,
        message: "Staff member with this email already exists",
      });
    }

    const departmentValidation = await validateDoctorDepartment(
      role,
      department,
    );

    if (!departmentValidation.valid) {
      await createAuditLog({
        req,
        action: "CREATE_STAFF",
        module: "STAFF",
        description: `Staff account creation failed for ${normalizedEmail}: ${departmentValidation.message}`,
        status: "FAILURE",
        metadata: {
          email: normalizedEmail,
          role,
          departmentId: department || null,
        },
      });

      return res.status(400).json({
        success: false,
        message: departmentValidation.message,
      });
    }

    const staff = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role,
      department:
        role === "doctor" ? departmentValidation.department._id : null,
    });

    const populatedStaff = await User.findById(staff._id)
      .select("-password")
      .populate("department", "name code consultationFee");

    await createAuditLog({
      req,
      action: "CREATE_STAFF",
      module: "STAFF",
      description: `Staff account created for ${populatedStaff.name} with role ${populatedStaff.role}`,
      status: "SUCCESS",
      entityType: "User",
      entityId: populatedStaff._id,
      metadata: {
        email: populatedStaff.email,
        role: populatedStaff.role,
        department: populatedStaff.department?.name || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Staff account created successfully",
      data: populatedStaff,
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "CREATE_STAFF",
      module: "STAFF",
      description: "Staff account creation failed due to a server error",
      status: "FAILURE",
      metadata: {
        error: error.message,
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create staff account",
    });
  }
};

const getAllStaff = async (req, res) => {
  try {
    const { role, department, activeOnly } = req.query;

    const filter = {
      role: {
        $ne: "super_admin",
      },
    };

    if (role) {
      filter.role = role;
    }

    if (department) {
      filter.department = department;
    }

    if (activeOnly === "true") {
      filter.isActive = true;
    }

    const usersList = await User.find(filter)
      .select("-password")
      .populate("department", "name code consultationFee")
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: usersList.length,
      data: usersList,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch staff accounts",
    });
  }
};

const updateUserAccount = async (req, res) => {
  try {
    const { name, email, role, password, department } = req.body;

    const user = await User.findById(req.params.id);

    if (!user || user.role === "super_admin") {
      await createAuditLog({
        req,
        action: "UPDATE_STAFF",
        module: "STAFF",
        description: `Staff update failed because user ${req.params.id} was not found or is protected`,
        status: "FAILURE",
        metadata: {
          userId: req.params.id,
        },
      });

      return res.status(404).json({
        success: false,
        message: "User record not found",
      });
    }

    const previousData = {
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department?.toString() || null,
      isActive: user.isActive,
    };

    const nextRole = role || user.role;

    if (email && email.trim().toLowerCase() !== user.email) {
      const normalizedEmail = email.trim().toLowerCase();

      const emailExists = await User.findOne({
        email: normalizedEmail,
        _id: {
          $ne: user._id,
        },
      });

      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: "This email is already taken by another user",
        });
      }

      user.email = normalizedEmail;
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Staff name cannot be empty",
        });
      }

      user.name = name.trim();
    }

    if (role) {
      const validRoles = [
        "doctor",
        "receptionist",
        "pharmacist",
        "laboratorian",
        "accountant",
        "patient",
      ];

      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role assignment",
        });
      }

      user.role = role;
    }

    const departmentValidation = await validateDoctorDepartment(
      nextRole,
      department !== undefined ? department : user.department,
    );

    if (!departmentValidation.valid) {
      return res.status(400).json({
        success: false,
        message: departmentValidation.message,
      });
    }

    user.department =
      nextRole === "doctor" ? departmentValidation.department._id : null;

    if (password) {
      user.password = password;
    }

    await user.save();

    const updatedUser = await User.findById(user._id)
      .select("-password")
      .populate("department", "name code consultationFee");

    await createAuditLog({
      req,
      action: "UPDATE_STAFF",
      module: "STAFF",
      description: `Staff account updated for ${updatedUser.email}`,
      status: "SUCCESS",
      entityType: "User",
      entityId: updatedUser._id,
      metadata: {
        previousData,
        updatedData: {
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          department: updatedUser.department?.name || null,
          isActive: updatedUser.isActive,
          passwordUpdated: Boolean(password),
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "User profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "UPDATE_STAFF",
      module: "STAFF",
      description: "Staff account update failed due to a server error",
      status: "FAILURE",
      metadata: {
        userId: req.params.id,
        error: error.message,
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update staff account",
    });
  }
};

const deleteUserAccount = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user || user.role === "super_admin") {
      await createAuditLog({
        req,
        action: "DELETE_STAFF",
        module: "STAFF",
        description: `Staff deletion failed because user ${req.params.id} was not found or is protected`,
        status: "FAILURE",
        metadata: {
          userId: req.params.id,
        },
      });

      return res.status(404).json({
        success: false,
        message: "User record not found",
      });
    }

    const deletedUserDetails = {
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department?.toString() || null,
    };

    await User.findByIdAndDelete(req.params.id);

    await createAuditLog({
      req,
      action: "DELETE_STAFF",
      module: "STAFF",
      description: `Staff account permanently deleted for ${deletedUserDetails.email}`,
      status: "SUCCESS",
      entityType: "User",
      entityId: user._id,
      metadata: deletedUserDetails,
    });

    return res.status(200).json({
      success: true,
      message: `The user account with role '${user.role}' has been permanently deleted`,
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "DELETE_STAFF",
      module: "STAFF",
      description: "Staff account deletion failed due to a server error",
      status: "FAILURE",
      metadata: {
        userId: req.params.id,
        error: error.message,
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete staff account",
    });
  }
};

const toggleStaffStatus = async (req, res) => {
  try {
    const staff = await User.findById(req.params.id);

    if (!staff || staff.role === "super_admin") {
      await createAuditLog({
        req,
        action: "TOGGLE_STAFF_STATUS",
        module: "STAFF",
        description: `Staff status update failed because user ${req.params.id} was not found or is protected`,
        status: "FAILURE",
        metadata: {
          userId: req.params.id,
        },
      });

      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    const previousStatus = staff.isActive;

    staff.isActive = !staff.isActive;

    await staff.save();

    const updatedStaff = await User.findById(staff._id)
      .select("-password")
      .populate("department", "name code consultationFee");

    await createAuditLog({
      req,
      action: "TOGGLE_STAFF_STATUS",
      module: "STAFF",
      description: `Staff account ${updatedStaff.email} was ${
        updatedStaff.isActive ? "activated" : "deactivated"
      }`,
      status: "SUCCESS",
      entityType: "User",
      entityId: updatedStaff._id,
      metadata: {
        name: updatedStaff.name,
        email: updatedStaff.email,
        role: updatedStaff.role,
        previousStatus,
        currentStatus: updatedStaff.isActive,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Staff account has been ${
        updatedStaff.isActive ? "activated" : "deactivated"
      }`,
      data: updatedStaff,
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "TOGGLE_STAFF_STATUS",
      module: "STAFF",
      description: "Staff status update failed due to a server error",
      status: "FAILURE",
      metadata: {
        userId: req.params.id,
        error: error.message,
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update staff account status",
    });
  }
};

module.exports = {
  createStaff,
  getAllStaff,
  updateUserAccount,
  deleteUserAccount,
  toggleStaffStatus,
};
