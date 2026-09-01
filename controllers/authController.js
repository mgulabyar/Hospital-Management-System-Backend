const User = require("../models/User");
const jwt = require("jsonwebtoken");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Please fill all required fields" });
    }

    let user = await User.findOne({ email });

    if (user) {
      user.name = name;
      user.password = password;
      if (role) user.role = role;

      await user.save();

      return res.status(200).json({
        success: true,
        message: "Account updated and overwritten successfully inside database",
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          token: generateToken(user._id),
        },
      });
    }

    user = await User.create({ name, email, password, role });

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
    return res.status(500).json({ success: false, message: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide email and password" });
    }

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      return res.json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          token: generateToken(user._id),
        },
      });
    } else {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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

    await User.findByIdAndDelete(targetUserId);

    return res.status(200).json({
      success: true,
      message: `Session terminated. User profile '${userRecord.name}' with email '${userRecord.email}' has been permanently deleted from database memory.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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
