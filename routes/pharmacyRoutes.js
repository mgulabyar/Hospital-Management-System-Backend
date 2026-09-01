const express = require("express");
const router = express.Router();
const {
  addMedicineStock,
  dispenseMedicines,
} = require("../controllers/pharmacyController");
const { protect, authorizeRoles } = require("../middlewares/authMiddleware");

router.use(protect);

router.post(
  "/inventory",
  authorizeRoles("super_admin", "pharmacist"),
  addMedicineStock,
);
router.post(
  "/sales",
  authorizeRoles("super_admin", "pharmacist"),
  dispenseMedicines,
);

module.exports = router;
