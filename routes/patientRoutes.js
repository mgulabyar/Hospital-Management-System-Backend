const express = require('express');
const router = express.Router();
const { registerPatient } = require('../controllers/patientController');

router.post('/register', registerPatient);

module.exports = router;
