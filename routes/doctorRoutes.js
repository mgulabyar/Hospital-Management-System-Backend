const express = require('express');
const router = express.Router();
const { registerDoctor, getDepartmentsList } = require('../controllers/doctorController');

// Doctor Register Setup: POST /api/doctor/register
router.post('/register', registerDoctor);

// Departments Dropdown List Setup: GET /api/doctor/departments
router.get('/departments', getDepartmentsList);

module.exports = router;
