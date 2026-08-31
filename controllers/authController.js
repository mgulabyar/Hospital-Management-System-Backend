const authModel = require('../models/authModel') // Linked with clean auth model

// ===================================================
// 🔐 1. LOGIN SYSTEM GATEWAY WITH DYNAMIC VIEWS HOOKS
// ===================================================
async function loginUser(req, res) {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are both required!" })
  }

  // ⭐ MAKHSOOS FIXED EMAIL & PASSWORD FOR SUPER ADMIN / OWNER
  if (email === "owner@hospital.com" && password === "Owner@2026") {
    return res.status(200).json({
      message: "Welcome Master Super Admin / Owner! Accessing Global Control Dashboard.",
      user_id: "OWNER-001",
      name: "Hospital Owner (CEO)",
      role_category: "Admin_Control",
      specific_role: "Super_Admin",
      allowed_views: ["Add_New_Staff_User", "Delete_Staff_User", "Hospital_Global_Finances", "Staff_Salaries_Management", "Clear_Utility_Bills"]
    })
  }

  try {
    const member = await authModel.findByEmail(email)

    if (!member || member.length === 0) {
      return res.status(401).json({ error: "Invalid Email Address! Access Denied." })
    }

    const activeUser = member[0] // Get first element of the array

    if (activeUser.password !== password) {
      return res.status(401).json({ error: "Incorrect Password! Access Denied." })
    }

    const category = activeUser.role_category
    const role = activeUser.specific_role

    // 🛡️ AUTHORIZATION: CATEGORY & ROLE KI BASE PAR DASHBOARD ALLOCATION
    if (category === "Admin_Control") {
      return res.status(200).json({
        message: `Welcome Accountant ${activeUser.name}! Dashboard Loaded.`,
        profile: activeUser,
        allowed_views: ["Billing_Invoices_Verification", "Utility_Ledgers_Entry", "Salaries_Distribution_Logs"]
      })
    } 
    
    else if (category === "Front_Desk") {
      return res.status(200).json({
        message: `Welcome Receptionist ${activeUser.name}! Dashboard Loaded.`,
        profile: activeUser,
        allowed_views: ["New_Patient_Registration", "Search_Patient_Records", "Generate_Daily_Token_Slips"]
      })
    } 
    
    else if (category === "Clinical_Medical") {
      let views = ["View_Assigned_Department_Queue", "Access_Patient_Clinical_History"]
      if (role === "Doctor") {
        views.push("Call_Next_Queue_Patient", "Execute_Discharge_Completion_Triggers", "Fires_Digital_Prescription")
      } else if (role === "Assistant") {
        views.push("Shared_Clinical_Summaries_Pad", "Minor_Observation_Loggers")
      } else if (role === "Nurse") {
        views.push("Record_Triage_Vitals_Form", "Orders_Execution_Checklist")
      }

      return res.status(200).json({
        message: `Welcome ${role} ${activeUser.name}! Dashboard Loaded.`,
        profile: activeUser,
        allowed_views: views
      })
    } 
    
    else if (category === "Clinical_Support") {
      let views = ["Room_Duty_Roster_Check"]
      if (role === "Lab_Tech") {
        views.push("Incoming_Diagnostic_Orders_Queue", "Result_Data_Matrix_Editor")
      } else if (role === "Helper") {
        views.push("Basic_Patient_Movement", "Ward_Bed_Status_Triggers")
      }

      return res.status(200).json({
        message: `Welcome ${role} ${activeUser.name}! Dashboard Loaded.`,
        profile: activeUser,
        allowed_views: views
      })
    }

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// =======================================================
// 🛡️ 2. ADMIN PROTECTED CONTROL (STAFF USERS MANAGEMENT)
// =======================================================
async function addUserByAdmin(req, res) {
  const requesterCategory = req.headers['user-category']

  if (requesterCategory !== 'Admin_Control') {
    return res.status(403).json({ error: "Access Forbidden! Only Admin/Owner can add new staff users." })
  }

  const { name, email, password, role_category, specific_role, phone_number } = req.body

  if (!name || !email || !password || !role_category || !specific_role || !phone_number) {
    return res.status(400).json({ error: "All user configuration fields are strictly required!" })
  }

  try {
    const record = await authModel.create(req.body)
    res.status(201).json({ message: "New Staff User Registered Successfully by Admin!", user: record })
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: "This email or phone number is already registered!" })
    res.status(500).json({ error: err.message })
  }
}

async function getAllUsersByAdmin(req, res) {
  const requesterCategory = req.headers['user-category']
  if (requesterCategory !== 'Admin_Control') {
    return res.status(403).json({ error: "Access Denied!" })
  }

  try {
    const list = await authModel.findAll()
    res.status(200).json({ total_users: list.length, data: list })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

async function removeUserByAdmin(req, res) {
  const requesterCategory = req.headers['user-category']
  if (requesterCategory !== 'Admin_Control') {
    return res.status(403).json({ error: "Access Denied!" })
  }

  const id = req.params.id
  try {
    const deleted = await authModel.remove(id)
    if (!deleted || deleted.length === 0) return res.status(404).json({ error: "User not found!" })
    res.status(200).json({ message: "User deleted permanently from the system!", data: deleted })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  loginUser,
  addUserByAdmin,
  getAllUsersByAdmin,
  removeUserByAdmin
}
