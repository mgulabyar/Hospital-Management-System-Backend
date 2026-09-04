const User = require("../models/User");
const Department = require("../models/Department");

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

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Please provide all details including role",
      });
    }

    if (!STAFF_ROLES.includes(role)) {
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
      return res.status(400).json({
        success: false,
        message: "Staff member with this email already exists",
      });
    }

    const departmentValidation = await validateDoctorDepartment(
      role,
      department,
    );

    if (!departmentValidation.valid) {
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

    return res.status(201).json({
      success: true,
      message: "Staff account created successfully",
      data: populatedStaff,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
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
      message: error.message,
    });
  }
};

const updateUserAccount = async (req, res) => {
  try {
    const { name, email, role, password, department } = req.body;

    const user = await User.findById(req.params.id);

    if (!user || user.role === "super_admin") {
      return res.status(404).json({
        success: false,
        message: "User record not found",
      });
    }

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
        return res.status(400).json({
          success: false,
          message: "This email is already taken by another user",
        });
      }

      user.email = normalizedEmail;
    }

    if (name) {
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

    return res.status(200).json({
      success: true,
      message: "User profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteUserAccount = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user || user.role === "super_admin") {
      return res.status(404).json({
        success: false,
        message: "User record not found",
      });
    }

    await User.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: `The user account with role '${user.role}' has been permanently deleted`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const toggleStaffStatus = async (req, res) => {
  try {
    const staff = await User.findById(req.params.id);

    if (!staff || staff.role === "super_admin") {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    staff.isActive = !staff.isActive;

    await staff.save();

    const updatedStaff = await User.findById(staff._id)
      .select("-password")
      .populate("department", "name code consultationFee");

    return res.status(200).json({
      success: true,
      message: `Staff account has been ${
        updatedStaff.isActive ? "activated" : "deactivated"
      }`,
      data: updatedStaff,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
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
