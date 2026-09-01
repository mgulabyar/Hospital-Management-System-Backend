const express = require('express')
const router = express.Router()
const patientController = require('../controllers/patientController')
const { protect, isReceptionist } = require('../middlewares/authMiddleware')

// 1. CREATE -> POST
router.post('/register', protect, isReceptionist, patientController.registerPatient)

// 2. READ ALL -> GET
router.get('/all', protect, isReceptionist, patientController.getAllPatients)

// 3. READ SINGLE -> GET
router.get('/:id', protect, isReceptionist, patientController.getPatientDetails)

// 4. UPDATE -> PUT
router.put('/update/:id', protect, isReceptionist, patientController.updatePatientInfo)

// 5. DELETE -> DELETE
router.delete('/delete/:id', protect, isReceptionist, patientController.deletePatientRecord)

module.exports = router
