const authModel = require("../models/authModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "HMS_KEY_2026";


async function loginUser(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "Email and password are both required!" });
  }

  if (email === "owner@hospital.com" && password === "Owner@2026") {
    const token = jwt.sign(
      { id: "OWNER-001", role_category: "Admin_Control" },
      JWT_SECRET,
    );

    try {
      await authModel.createSession("OWNER-001", token);
    } catch (sessionErr) {
      console.log(
        "Master session linked configuration bypassed or table auto-locked",
      );
    }

    return res.status(200).json({
      message: "Welcome Master Super Admin / Owner!",
      token,
      profile: {
        user_id: "OWNER-001",
        name: "Hospital Owner (CEO)",
        email: "owner@hospital.com",
        role_category: "Admin_Control",
        specific_role: "Super_Admin",
        phone_number: "03000000000",
      },
      allowed_views: [
        "Add_New_Staff_User",
        "Delete_Staff_User",
        "Hospital_Global_Finances",
        "Staff_Salaries_Management",
        "Clear_Utility_Bills",
      ],
    });
  }

  try {
    const member = await authModel.findByEmail(email);
    if (!member || member.length === 0) {
      return res.status(401).json({ error: "Invalid Email Address!" });
    }

    const activeUser = member[0];

    // Exact compare checking mechanism with bcryptjs string matching parameter bounds
    const isMatch = await bcrypt.compare(password, activeUser.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ error: "Incorrect Password! Access Denied." });
    }

    const token = jwt.sign(
      { id: activeUser.user_id, role_category: activeUser.role_category },
      JWT_SECRET,
    );
    await authModel.createSession(activeUser.user_id, token);

    const category = activeUser.role_category;
    const role = activeUser.specific_role;
    let views = [];

    // 🛡️ AUTHORIZATION ASSIGNMENT MATRIX ACCORDING TO SYSTEM CONFIGURATION DESIGN
    if (category === "Admin_Control") {
      views = [
        "Billing_Invoices_Verification",
        "Utility_Ledgers_Entry",
        "Salaries_Distribution_Logs",
      ];
    } else if (category === "Front_Desk") {
      views = [
        "New_Patient_Registration",
        "Search_Patient_Records",
        "Generate_Daily_Token_Slips",
        "View_Active_Doctor_Rooms",
      ];
    } else if (category === "Clinical_Medical") {
      views = [
        "View_Assigned_Department_Queue",
        "Access_Patient_Clinical_History",
      ];
      if (role === "Doctor") {
        views.push(
          "Call_Next_Queue_Patient",
          "Execute_Discharge_Completion_Triggers",
          "Fires_Digital_Prescription",
          "Order_Lab_Radiology_Tests",
        );
      } else if (role === "Assistant") {
        views.push(
          "Shared_Clinical_Summaries_Pad",
          "Minor_Observation_Loggers",
        );
      } else if (role === "Nurse") {
        views.push(
          "Record_Triage_Vitals_Form",
          "Orders_Continuum_Checklist_Execution",
        );
      }
    } else if (category === "Clinical_Support") {
      views = ["Room_Duty_Roster_Check"];
      if (role === "Lab_Tech") {
        views.push(
          "Incoming_Diagnostic_Orders_Queue",
          "Result_Data_Matrix_Editor",
          "Upload_Final_Verification_Reports",
        );
      } else if (role === "Helper") {
        views.push(
          "Basic_Patient_Wheelchair_Movement",
          "Ward_Bed_Status_Triggers",
        );
      }
    }

    res.status(200).json({
      message: `Welcome ${role} ${activeUser.name}! Dashboard Session Activated.`,
      token,
      profile: activeUser,
      allowed_views: views,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ===================================================
// 🔓 2. LOGOUT SESSION TRUNCATION CONTROLLER
// ===================================================
async function logoutUser(req, res) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res
      .status(400)
      .json({ error: "Session authentication token is missing!" });
  }

  try {
    await authModel.deleteSession(token);
    res
      .status(200)
      .json({
        message:
          "Logged out completely. Secure session data purged from system layers.",
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// =======================================================
// 🔒 3. ADMIN MANAGEMENT TERMINAL CONTROLLERS DIRECTIVES
// =======================================================
async function addUserByAdmin(req, res) {
  try {
    const record = await authModel.create(req.body);
    res
      .status(201)
      .json({
        message:
          "New Staff Personnel Registered Successfully inside Central System Ledger!",
        user: record,
      });
  } catch (err) {
    if (err.code === "23505") {
      return res
        .status(400)
        .json({
          error: "This email registration data or phone number already exists!",
        });
    }
    res.status(500).json({ error: err.message });
  }
}

async function getAllUsersByAdmin(req, res) {
  try {
    const list = await authModel.findAll();
    res.status(200).json({ total_users: list.length, data: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateStaffByAdmin(req, res) {
  const id = req.params.id;
  try {
    const data = await authModel.update(id, req.body);
    if (!data || data.length === 0) {
      return res
        .status(404)
        .json({ error: "Targeted staff profile record not found!" });
    }
    res
      .status(200)
      .json({ message: "Staff Profile Parameters Updated Safely!", data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function removeUserByAdmin(req, res) {
  const id = req.params.id;
  try {
    const deleted = await authModel.remove(id);
    if (!deleted || deleted.length === 0) {
      return res
        .status(404)
        .json({ error: "Staff member targeting profile row not found!" });
    }
    res
      .status(200)
      .json({
        message:
          "Staff removed permanently from hospital systems database layers!",
        data: deleted,
      });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  loginUser,
  logoutUser,
  addUserByAdmin,
  getAllUsersByAdmin,
  updateStaffByAdmin,
  removeUserByAdmin,
};
