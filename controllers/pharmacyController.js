const mongoose = require("mongoose");
const MedicineInventory = require("../models/medicineInventory");
const PharmacySale = require("../models/pharmacySale");
const MedicalRecord = require("../models/MedicalRecord");
const PatientProfile = require("../models/patientProfile");

const getNextSaleNumber = async () => {
  const year = new Date().getFullYear();

  const latestSale = await PharmacySale.findOne({
    saleNumber: new RegExp(`^PH-${year}-`),
  })
    .sort({ createdAt: -1 })
    .select("saleNumber");

  let nextSequence = 1;

  if (latestSale?.saleNumber) {
    const lastSequence = Number(latestSale.saleNumber.split("-").pop());

    if (!Number.isNaN(lastSequence)) {
      nextSequence = lastSequence + 1;
    }
  }

  return `PH-${year}-${String(nextSequence).padStart(5, "0")}`;
};

const isExpired = (expiryDate) => {
  const expiry = new Date(expiryDate);
  const today = new Date();

  expiry.setHours(23, 59, 59, 999);
  today.setHours(0, 0, 0, 0);

  return expiry < today;
};

const normalizeName = (value) => value?.trim().toUpperCase();

const addMedicineStock = async (req, res) => {
  try {
    const {
      name,
      category,
      availableStock,
      pricePerUnit,
      expiryDate,
      reorderLevel,
      batchNumber,
    } = req.body;

    if (
      !name?.trim() ||
      !category?.trim() ||
      availableStock === undefined ||
      pricePerUnit === undefined ||
      !expiryDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, category, stock quantity, unit price and expiry date are required",
      });
    }

    const stockToAdd = Number(availableStock);
    const unitPrice = Number(pricePerUnit);
    const reorderQuantity =
      reorderLevel === undefined ? 10 : Number(reorderLevel);

    if (
      !Number.isFinite(stockToAdd) ||
      stockToAdd <= 0 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0 ||
      !Number.isFinite(reorderQuantity) ||
      reorderQuantity < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Stock must be greater than zero, while prices and reorder level cannot be negative",
      });
    }

    const normalizedExpiryDate = new Date(expiryDate);

    if (Number.isNaN(normalizedExpiryDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid medicine expiry date",
      });
    }

    if (isExpired(normalizedExpiryDate)) {
      return res.status(400).json({
        success: false,
        message: "Expired medicine stock cannot be added",
      });
    }

    const normalizedMedicineName = normalizeName(name);

    let medicine = await MedicineInventory.findOne({
      name: normalizedMedicineName,
    });

    if (medicine) {
      medicine.availableStock += stockToAdd;
      medicine.pricePerUnit = unitPrice;
      medicine.expiryDate = normalizedExpiryDate;
      medicine.reorderLevel = reorderQuantity;
      medicine.category = normalizeName(category);
      medicine.batchNumber = normalizeName(batchNumber || "");
      medicine.isActive = true;

      await medicine.save();
    } else {
      medicine = await MedicineInventory.create({
        name: normalizedMedicineName,
        category: normalizeName(category),
        availableStock: stockToAdd,
        pricePerUnit: unitPrice,
        expiryDate: normalizedExpiryDate,
        reorderLevel: reorderQuantity,
        batchNumber: normalizeName(batchNumber || ""),
      });
    }

    return res.status(201).json({
      success: true,
      message: "Medicine inventory stock saved successfully",
      data: medicine,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A medicine with this name already exists in inventory",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to save medicine inventory stock",
    });
  }
};

const getInventory = async (req, res) => {
  try {
    const { search, lowStock, activeOnly } = req.query;

    const filter = {};

    if (activeOnly === "true") {
      filter.isActive = true;
    }

    if (search?.trim()) {
      const searchExpression = new RegExp(search.trim(), "i");

      filter.$or = [
        { name: searchExpression },
        { category: searchExpression },
        { batchNumber: searchExpression },
      ];
    }

    let medicines = await MedicineInventory.find(filter).sort({
      name: 1,
    });

    if (lowStock === "true") {
      medicines = medicines.filter(
        (medicine) => medicine.availableStock <= medicine.reorderLevel,
      );
    }

    return res.status(200).json({
      success: true,
      count: medicines.length,
      data: medicines,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch pharmacy inventory",
    });
  }
};

const updateMedicineInventory = async (req, res) => {
  try {
    const {
      name,
      category,
      pricePerUnit,
      expiryDate,
      reorderLevel,
      batchNumber,
      isActive,
    } = req.body;

    const medicine = await MedicineInventory.findById(req.params.id);

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: "Medicine inventory item was not found",
      });
    }

    if (name !== undefined && !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Medicine name cannot be empty",
      });
    }

    if (category !== undefined && !category.trim()) {
      return res.status(400).json({
        success: false,
        message: "Medicine category cannot be empty",
      });
    }

    if (
      pricePerUnit !== undefined &&
      (!Number.isFinite(Number(pricePerUnit)) || Number(pricePerUnit) < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Medicine unit price cannot be negative",
      });
    }

    if (
      reorderLevel !== undefined &&
      (!Number.isFinite(Number(reorderLevel)) || Number(reorderLevel) < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Medicine reorder level cannot be negative",
      });
    }

    if (expiryDate !== undefined) {
      const normalizedExpiryDate = new Date(expiryDate);

      if (
        Number.isNaN(normalizedExpiryDate.getTime()) ||
        isExpired(normalizedExpiryDate)
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid future medicine expiry date",
        });
      }

      medicine.expiryDate = normalizedExpiryDate;
    }

    if (name !== undefined) {
      medicine.name = normalizeName(name);
    }

    if (category !== undefined) {
      medicine.category = normalizeName(category);
    }

    if (pricePerUnit !== undefined) {
      medicine.pricePerUnit = Number(pricePerUnit);
    }

    if (reorderLevel !== undefined) {
      medicine.reorderLevel = Number(reorderLevel);
    }

    if (batchNumber !== undefined) {
      medicine.batchNumber = normalizeName(batchNumber);
    }

    if (typeof isActive === "boolean") {
      medicine.isActive = isActive;
    }

    await medicine.save();

    return res.status(200).json({
      success: true,
      message: "Medicine inventory item updated successfully",
      data: medicine,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A medicine with this name already exists in inventory",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update medicine inventory",
    });
  }
};

const getPendingPrescriptions = async (req, res) => {
  try {
    const dispensedMedicalRecordIds = await PharmacySale.distinct(
      "medicalRecord",
      {
        medicalRecord: {
          $ne: null,
        },
      },
    );

    const pendingPrescriptions = await MedicalRecord.find({
      medicines: {
        $exists: true,
        $not: {
          $size: 0,
        },
      },
      _id: {
        $nin: dispensedMedicalRecordIds,
      },
    })
      .populate("patient", "patientId name age gender phone")
      .populate("doctor", "name")
      .populate(
        "token",
        "displayToken department departmentRef visitDate status",
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: pendingPrescriptions.length,
      data: pendingPrescriptions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch pending prescriptions",
    });
  }
};

const dispenseMedicines = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { patientId, medicalRecordId, items } = req.body;

    if (!patientId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Patient profile and at least one valid medicine sale item are required",
      });
    }

    const patient = await PatientProfile.findById(patientId);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Selected patient profile was not found",
      });
    }

    if (medicalRecordId) {
      const [medicalRecord, existingSale] = await Promise.all([
        MedicalRecord.findById(medicalRecordId),
        PharmacySale.findOne({
          medicalRecord: medicalRecordId,
        }),
      ]);

      if (!medicalRecord) {
        return res.status(404).json({
          success: false,
          message: "Selected medical record prescription was not found",
        });
      }

      if (medicalRecord.patient.toString() !== patientId.toString()) {
        return res.status(400).json({
          success: false,
          message:
            "Selected patient does not match the prescription medical record",
        });
      }

      if (existingSale) {
        return res.status(409).json({
          success: false,
          message:
            "This prescription has already been dispensed and cannot be processed again",
        });
      }
    }

    const medicineIdList = items.map((item) => item?.medicineId);

    if (
      medicineIdList.some(
        (medicineId) => !medicineId || !mongoose.Types.ObjectId.isValid(medicineId),
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Every sale item must contain a valid inventory medicine ID",
      });
    }

    const repeatedMedicineIds = new Set();

    for (const medicineId of medicineIdList) {
      if (repeatedMedicineIds.has(medicineId.toString())) {
        return res.status(400).json({
          success: false,
          message:
            "Duplicate medicine items are not allowed in one dispensing transaction",
        });
      }

      repeatedMedicineIds.add(medicineId.toString());
    }

    for (const item of items) {
      if (
        !Number.isInteger(Number(item.quantity)) ||
        Number(item.quantity) <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Every medicine quantity must be a whole number greater than zero",
        });
      }
    }

    let finalReceipt;

    await session.withTransaction(async () => {
      const inventoryItems = await MedicineInventory.find({
        _id: {
          $in: medicineIdList,
        },
      }).session(session);

      if (inventoryItems.length !== medicineIdList.length) {
        throw new Error("One or more selected medicines were not found");
      }

      const inventoryById = new Map(
        inventoryItems.map((medicine) => [medicine._id.toString(), medicine]),
      );

      let totalCalculatedAmount = 0;
      const itemsSoldArray = [];

      for (const item of items) {
        const currentStockItem = inventoryById.get(
          item.medicineId.toString(),
        );

        const requestedQuantity = Number(item.quantity);

        if (!currentStockItem.isActive) {
          throw new Error(
            `${currentStockItem.name} is inactive and cannot be dispensed`,
          );
        }

        if (isExpired(currentStockItem.expiryDate)) {
          throw new Error(
            `${currentStockItem.name} is expired and cannot be dispensed`,
          );
        }

        if (currentStockItem.availableStock < requestedQuantity) {
          throw new Error(
            `Insufficient stock level for item: ${currentStockItem.name}`,
          );
        }

        const itemSubtotal =
          currentStockItem.pricePerUnit * requestedQuantity;

        totalCalculatedAmount += itemSubtotal;

        currentStockItem.availableStock -= requestedQuantity;
        await currentStockItem.save({ session });

        itemsSoldArray.push({
          medicine: currentStockItem._id,
          medicineName: currentStockItem.name,
          quantity: requestedQuantity,
          price: currentStockItem.pricePerUnit,
          subtotal: itemSubtotal,
        });
      }

      const saleNumber = await getNextSaleNumber();

      const receipts = await PharmacySale.create(
        [
          {
            saleNumber,
            patient: patientId,
            medicalRecord: medicalRecordId || null,
            itemsSold: itemsSoldArray,
            totalAmount: totalCalculatedAmount,
            paymentStatus: "Paid",
            pharmacist: req.user._id,
          },
        ],
        { session },
      );

      finalReceipt = receipts[0];
    });

    const populatedReceipt = await PharmacySale.findById(finalReceipt._id)
      .populate("patient", "patientId name phone")
      .populate("medicalRecord", "chiefComplaints diagnosis")
      .populate("itemsSold.medicine", "name category batchNumber")
      .populate("pharmacist", "name email");

    return res.status(201).json({
      success: true,
      message: "Pharmacy prescription dispensed successfully",
      data: populatedReceipt,
    });
  } catch (error) {
    const message =
      error.message || "Failed to complete medicine dispensing transaction";

    const statusCode =
      message.includes("already been dispensed") ||
      message.includes("Duplicate medicine")
        ? 409
        : message.includes("not found") ||
            message.includes("inactive") ||
            message.includes("expired") ||
            message.includes("Insufficient stock")
          ? 400
          : 500;

    return res.status(statusCode).json({
      success: false,
      message,
    });
  } finally {
    await session.endSession();
  }
};

const getPharmacySales = async (req, res) => {
  try {
    const { patient, medicalRecord, startDate, endDate } = req.query;

    const filter = {};

    if (patient) {
      filter.patient = patient;
    }

    if (medicalRecord) {
      filter.medicalRecord = medicalRecord;
    }

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const sales = await PharmacySale.find(filter)
      .populate("patient", "patientId name phone")
      .populate("medicalRecord", "chiefComplaints diagnosis")
      .populate("itemsSold.medicine", "name category batchNumber")
      .populate("pharmacist", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: sales.length,
      data: sales,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch pharmacy sales history",
    });
  }
};

module.exports = {
  addMedicineStock,
  getInventory,
  updateMedicineInventory,
  getPendingPrescriptions,
  dispenseMedicines,
  getPharmacySales,
};