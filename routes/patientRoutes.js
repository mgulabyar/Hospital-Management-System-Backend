const express = require('express')
const router = express.Router()
const patientController = require('../controllers/patientController')

// CREATE -> POST
router.post('/register', patientController.registerPatient)

// READ ALL -> GET
router.get('/all', patientController.getAllPatients)

// READ SINGLE -> GET
router.get('/find/:id', patientController.getPatientById)

// UPDATE -> PUT
router.put('/update/:id', patientController.updatePatientProfile)

// DELETE -> DELETE
router.delete('/delete/:id', patientController.removePatientRecord)

module.exports = router
