const express = require('express')
const router = express.Router()
const authController = require('../controllers/authController')

router.post('/login', authController.loginUser)

router.post('/register', authController.addUserByAdmin)
router.get('/all', authController.getAllUsersByAdmin)
router.delete('/delete/:id', authController.removeUserByAdmin)

module.exports = router
