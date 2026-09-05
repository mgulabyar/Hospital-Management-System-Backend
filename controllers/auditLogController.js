const AuditLog = require("../models/AuditLog");

const getAuditLogs = async (req, res) => {
  try {
    const {
      module,
      status,
      role,
      user,
      startDate,
      endDate,
      search,
      limit = 100,
    } = req.query;

    const filter = {};

    if (module) {
      filter.module = module.toUpperCase();
    }

    if (status) {
      filter.status = status.toUpperCase();
    }

    if (role) {
      filter.performerRole = role.toUpperCase();
    }

    if (user) {
      filter.performedBy = user;
    }

    if (search?.trim()) {
      const searchExpression = new RegExp(search.trim(), "i");

      filter.$or = [
        { logNumber: searchExpression },
        { action: searchExpression },
        { module: searchExpression },
        { description: searchExpression },
        { performerName: searchExpression },
        { performerEmail: searchExpression },
      ];
    }

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        const start = new Date(startDate);

        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Please provide a valid audit start date",
          });
        }

        start.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);

        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Please provide a valid audit end date",
          });
        }

        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const requestedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

    const logs = await AuditLog.find(filter)
      .populate("performedBy", "name email role")
      .sort({ createdAt: -1 })
      .limit(requestedLimit);

    return res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch audit logs",
    });
  }
};

const getAuditSummary = async (req, res) => {
  try {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalLogs, successLogs, failureLogs, moduleSummary] =
      await Promise.all([
        AuditLog.countDocuments({}),
        AuditLog.countDocuments({
          status: "SUCCESS",
        }),
        AuditLog.countDocuments({
          status: "FAILURE",
        }),
        AuditLog.aggregate([
          {
            $group: {
              _id: "$module",
              count: {
                $sum: 1,
              },
            },
          },
          {
            $sort: {
              count: -1,
            },
          },
        ]),
      ]);

    const recentLogs = await AuditLog.find({
      createdAt: {
        $gte: last24Hours,
      },
    }).countDocuments();

    return res.status(200).json({
      success: true,
      data: {
        totalLogs,
        successLogs,
        failureLogs,
        recentLogs,
        moduleSummary,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch audit log summary",
    });
  }
};

module.exports = {
  getAuditLogs,
  getAuditSummary,
};
