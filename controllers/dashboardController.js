const JobSheet = require("../models/JobSheet");

exports.getDashboardStats = async (req, res) => {

  try {

    const totalJobs = await JobSheet.countDocuments();

    const pendingJobs = await JobSheet.countDocuments({
      "device.mobileStatus": { $ne: "Delivered" }
    });

    const completedJobs = await JobSheet.countDocuments({
      "device.mobileStatus": "Delivered"
    });

    const receivedJobs = await JobSheet.countDocuments({
      "device.mobileStatus": "Received"
    });

    res.json({
      totalJobs,
      pendingJobs,
      completedJobs,
      receivedJobs
    });

  } catch (err) {

    console.error("Dashboard error:", err);

    res.status(500).json({
      message: err.message
    });

  }

};