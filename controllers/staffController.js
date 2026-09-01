const User = require("../models/User");

const createStaff = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Please provide all details including role",
      });
    }

    const allowedRoles = [
      "doctor",
      "receptionist",
      "pharmacist",
      "laboratorian",
      "accountant",
    ];
    if (!allowedRoles.includes(role)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid staff role provided" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "Staff member with this email already exists",
      });
    }

    const staff = await User.create({ name, email, password, role });

    return res.status(201).json({
      success: true,
      message: "Staff account created successfully",
      data: {
        _id: staff._id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        isActive: staff.isActive,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getAllStaff = async (req, res) => {
  try {
    const { role } = req.query;
    let filter = { role: { $ne: "super_admin" } };

    if (role) {
      filter.role = role;
    }

    const usersList = await User.find(filter).select("-password");
    return res
      .status(200)
      .json({ success: true, count: usersList.length, data: usersList });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateUserAccount = async (req, res) => {
  try {
    const { name, email, role, password } = req.body;
    const user = await User.findById(req.params.id);

    if (!user || user.role === "super_admin") {
      return res
        .status(404)
        .json({ success: false, message: "User record not found" });
    }

    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: "This email is already taken by another user",
        });
      }
      user.email = email;
    }

    if (name) user.name = name;
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
        return res
          .status(400)
          .json({ success: false, message: "Invalid role assignment" });
      }
      user.role = role;
    }

    if (password) user.password = password;

    const updatedUser = await user.save();

    return res.status(200).json({
      success: true,
      message: "User profile updated successfully",
      data: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteUserAccount = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user || user.role === "super_admin") {
      return res
        .status(404)
        .json({ success: false, message: "User record not found" });
    }

    await User.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: `The user account with role '${user.role}' has been permanently deleted`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const toggleStaffStatus = async (req, res) => {
  try {
    const staff = await User.findById(req.params.id);
    if (!staff || staff.role === "super_admin") {
      return res
        .status(404)
        .json({ success: false, message: "Staff member not found" });
    }

    staff.isActive = !staff.isActive;
    await staff.save();

    return res.status(200).json({
      success: true,
      message: `Staff account has been ${staff.isActive ? "activated" : "deactivated"}`,
      data: {
        _id: staff._id,
        name: staff.name,
        role: staff.role,
        isActive: staff.isActive,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createStaff,
  getAllStaff,
  updateUserAccount,
  deleteUserAccount,
  toggleStaffStatus,
};
