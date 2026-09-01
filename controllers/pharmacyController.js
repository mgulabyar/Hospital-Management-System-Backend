const MedicineInventory = require("../models/medicineInventory");
const PharmacySale = require("../models/PharmacySale");

const addMedicineStock = async (req, res) => {
  try {
    const { name, category, availableStock, pricePerUnit, expiryDate } =
      req.body;

    if (!name || !availableStock || !pricePerUnit || !expiryDate) {
      return res.status(400).json({
        success: false,
        message: "Please fulfill all inventory parameters",
      });
    }

    let medicine = await MedicineInventory.findOne({ name });

    if (medicine) {
      medicine.availableStock += Number(availableStock);
      await medicine.save();
    } else {
      medicine = await MedicineInventory.create({
        name,
        category,
        availableStock,
        pricePerUnit,
        expiryDate,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Inventory stock level balanced successfully",
      data: medicine,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const dispenseMedicines = async (req, res) => {
  try {
    const { patientId, medicalRecordId, items } = req.body;

    if (!patientId || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Sales checkout array parameters missing",
      });
    }

    let totalCalculatedAmount = 0;
    const itemsSoldArray = [];

    for (let item of items) {
      const currentStockItem = await MedicineInventory.findById(
        item.medicineId,
      );
      if (!currentStockItem) {
        return res.status(404).json({
          success: false,
          message: `Medicine item with id ${item.medicineId} not found`,
        });
      }

      if (currentStockItem.availableStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock level for item: ${currentStockItem.name}`,
        });
      }

      const itemPriceCost = currentStockItem.pricePerUnit * item.quantity;
      totalCalculatedAmount += itemPriceCost;

      currentStockItem.availableStock -= item.quantity;
      await currentStockItem.save();

      itemsSoldArray.push({
        medicine: item.medicineId,
        quantity: item.quantity,
        price: currentStockItem.pricePerUnit,
      });
    }

    const finalReceipt = await PharmacySale.create({
      patient: patientId,
      medicalRecord: medicalRecordId || null,
      itemsSold: itemsSoldArray,
      totalAmount: totalCalculatedAmount,
      pharmacist: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message:
        "Pharmacy prescription invoice processed and dispensed successfully",
      data: finalReceipt,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { addMedicineStock, dispenseMedicines };
