const Department = require("../models/Department");
const { createAuditLog } = require("../utils/auditLogger");

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
      message: error.message || "Failed to fetch departments",
    });
  }
};

const createDepartment = async (req, res) => {
  try {
    const { name, code, consultationFee, description } = req.body;

    if (!name?.trim() || !code?.trim()) {
      await createAuditLog({
        req,
        action: "CREATE_DEPARTMENT",
        module: "DEPARTMENTS",
        description: "Department creation failed because name or code was missing",
        status: "FAILURE",
        metadata: {
          name: name || "",
          code: code || "",
        },
      });

      return res.status(400).json({
        success: false,
        message: "Department name and department code are required",
      });
    }

    const normalizedName = name.trim();
    const normalizedCode = code.trim().toUpperCase();
    const normalizedFee =
      consultationFee === undefined ? 1500 : Number(consultationFee);

    if (!Number.isFinite(normalizedFee) || normalizedFee < 0) {
      await createAuditLog({
        req,
        action: "CREATE_DEPARTMENT",
        module: "DEPARTMENTS",
        description: `Department creation failed due to invalid consultation fee for ${normalizedName}`,
        status: "FAILURE",
        metadata: {
          name: normalizedName,
          code: normalizedCode,
          consultationFee,
        },
      });

      return res.status(400).json({
        success: false,
        message: "Consultation fee must be a valid non-negative number",
      });
    }

    const existingDepartment = await Department.findOne({
      $or: [
        {
          name: {
            $regex: `^${normalizedName}$`,
            $options: "i",
          },
        },
        {
          code: normalizedCode,
        },
      ],
    });

    if (existingDepartment) {
      await createAuditLog({
        req,
        action: "CREATE_DEPARTMENT",
        module: "DEPARTMENTS",
        description: `Department creation rejected because ${normalizedName} or code ${normalizedCode} already exists`,
        status: "FAILURE",
        entityType: "Department",
        entityId: existingDepartment._id,
        metadata: {
          name: normalizedName,
          code: normalizedCode,
        },
      });

      return res.status(409).json({
        success: false,
        message: "A department with this name or code already exists",
      });
    }

    const department = await Department.create({
      name: normalizedName,
      code: normalizedCode,
      consultationFee: normalizedFee,
      description: description?.trim() || "",
    });

    await createAuditLog({
      req,
      action: "CREATE_DEPARTMENT",
      module: "DEPARTMENTS",
      description: `Department ${department.name} (${department.code}) created successfully`,
      status: "SUCCESS",
      entityType: "Department",
      entityId: department._id,
      metadata: {
        name: department.name,
        code: department.code,
        consultationFee: department.consultationFee,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Department created successfully",
      data: department,
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "CREATE_DEPARTMENT",
      module: "DEPARTMENTS",
      description: "Department creation failed due to a server error",
      status: "FAILURE",
      metadata: {
        error: error.message,
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create department",
    });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const { name, code, consultationFee, description, isActive } = req.body;

    const department = await Department.findById(req.params.id);

    if (!department) {
      await createAuditLog({
        req,
        action: "UPDATE_DEPARTMENT",
        module: "DEPARTMENTS",
        description: `Department update failed because department ${req.params.id} was not found`,
        status: "FAILURE",
        metadata: {
          departmentId: req.params.id,
        },
      });

      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    const previousData = {
      name: department.name,
      code: department.code,
      consultationFee: department.consultationFee,
      isActive: department.isActive,
    };

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Department name cannot be empty",
        });
      }

      department.name = name.trim();
    }

    if (code !== undefined) {
      if (!code.trim()) {
        return res.status(400).json({
          success: false,
          message: "Department code cannot be empty",
        });
      }

      department.code = code.trim().toUpperCase();
    }

    if (consultationFee !== undefined) {
      const normalizedFee = Number(consultationFee);

      if (!Number.isFinite(normalizedFee) || normalizedFee < 0) {
        return res.status(400).json({
          success: false,
          message: "Consultation fee must be a valid non-negative number",
        });
      }

      department.consultationFee = normalizedFee;
    }

    if (description !== undefined) {
      department.description = description.trim();
    }

    if (isActive !== undefined) {
      department.isActive = Boolean(isActive);
    }

    await department.save();

    await createAuditLog({
      req,
      action: "UPDATE_DEPARTMENT",
      module: "DEPARTMENTS",
      description: `Department ${department.name} (${department.code}) updated successfully`,
      status: "SUCCESS",
      entityType: "Department",
      entityId: department._id,
      metadata: {
        previousData,
        updatedData: {
          name: department.name,
          code: department.code,
          consultationFee: department.consultationFee,
          isActive: department.isActive,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Department updated successfully",
      data: department,
    });
  } catch (error) {
    if (error.code === 11000) {
      await createAuditLog({
        req,
        action: "UPDATE_DEPARTMENT",
        module: "DEPARTMENTS",
        description: "Department update failed because name or code already exists",
        status: "FAILURE",
        metadata: {
          departmentId: req.params.id,
        },
      });

      return res.status(409).json({
        success: false,
        message: "Department name or code already exists",
      });
    }

    await createAuditLog({
      req,
      action: "UPDATE_DEPARTMENT",
      module: "DEPARTMENTS",
      description: "Department update failed due to a server error",
      status: "FAILURE",
      metadata: {
        departmentId: req.params.id,
        error: error.message,
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update department",
    });
  }
};

const toggleDepartmentStatus = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);

    if (!department) {
      await createAuditLog({
        req,
        action: "TOGGLE_DEPARTMENT_STATUS",
        module: "DEPARTMENTS",
        description: `Department status update failed because department ${req.params.id} was not found`,
        status: "FAILURE",
        metadata: {
          departmentId: req.params.id,
        },
      });

      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    const previousStatus = department.isActive;

    department.isActive = !department.isActive;

    await department.save();

    await createAuditLog({
      req,
      action: "TOGGLE_DEPARTMENT_STATUS",
      module: "DEPARTMENTS",
      description: `Department ${department.name} was ${
        department.isActive ? "activated" : "deactivated"
      }`,
      status: "SUCCESS",
      entityType: "Department",
      entityId: department._id,
      metadata: {
        departmentName: department.name,
        previousStatus,
        currentStatus: department.isActive,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Department ${
        department.isActive ? "activated" : "deactivated"
      } successfully`,
      data: department,
    });
  } catch (error) {
    await createAuditLog({
      req,
      action: "TOGGLE_DEPARTMENT_STATUS",
      module: "DEPARTMENTS",
      description: "Department status update failed due to a server error",
      status: "FAILURE",
      metadata: {
        departmentId: req.params.id,
        error: error.message,
      },
    });

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update department status",
    });
  }
};

module.exports = {
  getDepartments,
  createDepartment,
  updateDepartment,
  toggleDepartmentStatus,
};