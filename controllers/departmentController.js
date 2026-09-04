const Department = require("../models/Department");

const getDepartments = async (req, res) => {
  try {
    const { activeOnly } = req.query;

    const filter = {};

    if (activeOnly === "true") {
      filter.isActive = true;
    }

    const departments = await Department.find(filter).sort({
      name: 1,
    });

    return res.status(200).json({
      success: true,
      count: departments.length,
      data: departments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const createDepartment = async (req, res) => {
  try {
    const {
      name,
      code,
      consultationFee,
      description,
    } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: "Department name and department code are required",
      });
    }

    const normalizedCode = code.trim().toUpperCase();

    const existingDepartment = await Department.findOne({
      $or: [
        {
          name: {
            $regex: `^${name.trim()}$`,
            $options: "i",
          },
        },
        {
          code: normalizedCode,
        },
      ],
    });

    if (existingDepartment) {
      return res.status(400).json({
        success: false,
        message: "A department with this name or code already exists",
      });
    }

    const department = await Department.create({
      name: name.trim(),
      code: normalizedCode,
      consultationFee: Number(consultationFee) || 1500,
      description: description?.trim() || "",
    });

    return res.status(201).json({
      success: true,
      message: "Department created successfully",
      data: department,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const {
      name,
      code,
      consultationFee,
      description,
      isActive,
    } = req.body;

    const department = await Department.findById(req.params.id);

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    if (name !== undefined) {
      department.name = name.trim();
    }

    if (code !== undefined) {
      department.code = code.trim().toUpperCase();
    }

    if (consultationFee !== undefined) {
      department.consultationFee = Number(consultationFee);
    }

    if (description !== undefined) {
      department.description = description.trim();
    }

    if (isActive !== undefined) {
      department.isActive = isActive;
    }

    await department.save();

    return res.status(200).json({
      success: true,
      message: "Department updated successfully",
      data: department,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Department name or code already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const toggleDepartmentStatus = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    department.isActive = !department.isActive;

    await department.save();

    return res.status(200).json({
      success: true,
      message: `Department ${
        department.isActive ? "activated" : "deactivated"
      } successfully`,
      data: department,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getDepartments,
  createDepartment,
  updateDepartment,
  toggleDepartmentStatus,
};