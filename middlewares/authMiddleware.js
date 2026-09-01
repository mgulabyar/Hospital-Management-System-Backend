// const authModel = require('../models/authModel')

// // 🔐 1. PROTECT: Session check gateway pipeline middleware
// const protect = async (req, res, next) => {
//   const token = req.headers.authorization?.split(' ')[1]
//   if (!token) {
//     return res.status(403).json({ error: "No token provided!" })
//   }

//   try {
//     const { data: session, error } = await authModel.findSession(token)

//     // Supabase returns an array, check if array is empty or database has errors
//     if (error || !session || session.length === 0) {
//       return res.status(401).json({ error: "Invalid session. Please login again." })
//     }

//     const currentActiveSession = session[0]

//     // Relational mapping evaluation check for the structural tables data
//     if (!currentActiveSession.users) {
//       return res.status(401).json({ error: "Associated user profile record not found!" })
//     }

//     // Dynamic extraction: user parameters mapped directly to global request node
//     req.user = currentActiveSession.users
//     next()
//   } catch (err) {
//     return res.status(500).json({ error: "Internal session server verification error" })
//   }
// }

// // 🛡️ 2. IS ADMIN: Super Admin category check authorization filter middleware
// const isAdmin = (req, res, next) => {
//   if (!req.user || req.user.role_category !== 'Admin_Control') {
//     return res.status(403).json({ error: "Access Forbidden! Administrative privileges required." })
//   }
//   next()
// }

// module.exports = {
//   protect,
//   isAdmin
// }

const authModel = require("../models/authModel");

const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(403).json({ error: "No token provided!" });
  }
  try {
    const { data: session, error } = await authModel.findSession(token);
    if (error || !session || session.length === 0) {
      return res
        .status(401)
        .json({ error: "Invalid session. Please login again." });
    }
    const currentActiveSession = session[0];
    if (!currentActiveSession.users) {
      return res
        .status(401)
        .json({ error: "Associated user profile record not found!" });
    }
    req.user = currentActiveSession.users;
    next();
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Internal session server verification error" });
  }
};

const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role_category !== "Admin_Control") {
    return res
      .status(403)
      .json({ error: "Access Forbidden! Administrative privileges required." });
  }
  next();
};

const isReceptionist = (req, res, next) => {
  if (
    !req.user ||
    (req.user.role_category !== "Front_Desk" &&
      req.user.role_category !== "Admin_Control")
  ) {
    return res
      .status(403)
      .json({
        error:
          "Access Denied! Only Receptionist or Admin can perform this action.",
      });
  }
  next();
};

module.exports = {
  protect,
  isAdmin,
  isReceptionist,
};
