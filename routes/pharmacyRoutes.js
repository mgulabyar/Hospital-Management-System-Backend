const express = require("express");

const router = express.Router();

const {
  addMedicineStock,
  getInventory,
  updateMedicineInventory,
  getPendingPrescriptions,
  dispenseMedicines,
  getPharmacySales,
} = require("../controllers/pharmacyController");

const { protect, authorizeRoles } = require("../middlewares/authMiddleware");

router.use(protect);

router.get(
  "/inventory",
  authorizeRoles("super_admin", "pharmacist"),
  getInventory,
);

router.post(
  "/inventory",
  authorizeRoles("super_admin", "pharmacist"),
  addMedicineStock,
);

router.put(
  "/inventory/:id",
  authorizeRoles("super_admin", "pharmacist"),
  updateMedicineInventory,
);

router.get(
  "/prescriptions/pending",
  authorizeRoles("super_admin", "pharmacist"),
  getPendingPrescriptions,
);

router.get(
  "/sales",
  authorizeRoles("super_admin", "pharmacist"),
  getPharmacySales,
);

router.post(
  "/sales",
  authorizeRoles("super_admin", "pharmacist"),
  dispenseMedicines,
);

module.exports = router;
