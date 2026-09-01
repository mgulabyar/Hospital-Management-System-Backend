const express = require('express')
const router = express.Router()
const authController = require('../controllers/authController')
const { protect, isAdmin } = require('../middlewares/authMiddleware')

router.post('/login', authController.loginUser)
router.post('/logout', authController.logoutUser)

router.post('/register', protect, isAdmin, authController.addUserByAdmin)
router.get('/all', protect, isAdmin, authController.getAllUsersByAdmin)
router.put('/update/:id', protect, isAdmin, authController.updateStaffByAdmin)
router.delete('/delete/:id', protect, isAdmin, authController.removeUserByAdmin)

module.exports = router;