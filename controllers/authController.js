const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { createAuditLog } = require("../utils/auditLogger");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      await createAuditLog({
        req,
        action: "REGISTER_USER",
        module: "AUTH",
        description:
          "Account registration failed because required fields were missing",
        status: "FAILURE",
        metadata: {
          email: email || "",
        },
      });

      return res.status(400).json({
        success: false,
        message: "Please fill all required fields",
      });
    }

    let user = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    if (user) {
      user.name = name.trim();
      user.password = password;

      if (role) {
        user.role = role;
      }

      await user.save();

      await createAuditLog({
        req,
        action: "UPDATE_USER_ACCOUNT",
        module: "AUTH",
        description: `Account profile updated for ${user.email}`,
        status: "SUCCESS",
        entityType: "User",
        entityId: user._id,
        performer: user,
      });

      return res.status(200).json({
        success: true,
        message: "Account updated successfully",
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          token: generateToken(user._id),
        },
      });
    }

    user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role,
    });

    await createAuditLog({
      req,
      action: "REGISTER_USER",
      module: "AUTH",
      description: `New account registered for ${user.email}`,
      status: "SUCCESS",
      entityType: "User",
      entityId: user._id,
      performer: user,
    });

    return res.status(201).json({
      success: true,
      message: "New account registered successfully",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "REGISTER_USER",
      module: "AUTH",
      description: "Account registration failed due to server error",
      status: "FAILURE",
      metadata: {
        error: error.message,
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      await createAuditLog({
        req,
        action: "LOGIN",
        module: "AUTH",
        description: "Login failed because email or password was missing",
        status: "FAILURE",
        metadata: {
          email: email || "",
        },
      });

      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user || !(await user.matchPassword(password))) {
      await createAuditLog({
        req,
        action: "LOGIN",
        module: "AUTH",
        description: `Failed login attempt for ${normalizedEmail}`,
        status: "FAILURE",
        metadata: {
          email: normalizedEmail,
        },
      });

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      await createAuditLog({
        req,
        action: "LOGIN",
        module: "AUTH",
        description: `Login blocked for inactive account ${user.email}`,
        status: "FAILURE",
        entityType: "User",
        entityId: user._id,
        performer: user,
      });

      return res.status(403).json({
        success: false,
        message: "This staff account is inactive. Please contact Super Admin.",
      });
    }

    await createAuditLog({
      req,
      action: "LOGIN",
      module: "AUTH",
      description: `Successful login for ${user.email}`,
      status: "SUCCESS",
      entityType: "User",
      entityId: user._id,
      performer: user,
    });

    return res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "LOGIN",
      module: "AUTH",
      description: "Login failed due to server error",
      status: "FAILURE",
      metadata: {
        error: error.message,
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const logoutUser = async (req, res) => {
  try {
    const targetUserId = req.user._id;

    const userRecord = await User.findById(targetUserId);

    if (!userRecord) {
      return res.status(404).json({
        success: false,
        message: "Active session user record not found",
      });
    }

    await createAuditLog({
      req,
      action: "LOGOUT",
      module: "AUTH",
      description: `Session logout requested by ${userRecord.email}`,
      status: "SUCCESS",
      entityType: "User",
      entityId: userRecord._id,
      performer: userRecord,
    });

    return res.status(200).json({
      success: true,
      message: "Session terminated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getSuperAdminDashboard = async (req, res) => {
  return res.json({
    success: true,
    message: `Welcome to the Super Admin Dashboard, ${req.user.name}!`,
  });
};

module.exports = {
  registerUser,
  loginUser,
  getSuperAdminDashboard,
  logoutUser,
};
