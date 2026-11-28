const JobSheet = require("../models/JobSheet");
const storeScope = require("../middleware/storeScope");   // Phase 2B

exports.getDashboardStats = async (req, res) => {
  try {
    // Phase 2B: ella count-kum store scope-oda (Main Store = pazhaya ella data)
    const scoped = (q = {}) => storeScope.and(req, q);

    // 🔢 Total Jobs
    const totalJobs = await JobSheet.countDocuments(scoped());

    // ✅ Completed (Invoice Generated)
    const completedJobs = await JobSheet.countDocuments(scoped({
      isInvoiced: true
    }));

    // ⏳ Pending Jobs
    // Repaired / Delivered jobs pending count-la varakoodadhu
    const pendingJobs = await JobSheet.countDocuments(scoped({
      isInvoiced: false,
      "device.mobileStatus": {
        $nin: ["Repaired", "Delivered", "Delivered NR/NA"]
      }
    }));

    // 📦 Received Jobs
    const receivedJobs = await JobSheet.countDocuments(scoped({
      "device.mobileStatus": "Received"
    }));

    // 🔧 Repaired Jobs (Optional Card)
    const repairedJobs = await JobSheet.countDocuments(scoped({
      "device.mobileStatus": "Repaired"
    }));

    // 📤 Response
    res.json({
      totalJobs,
      completedJobs,
      pendingJobs,
      receivedJobs,
      repairedJobs
    });

  } catch (err) {
    console.error("Dashboard error:", err);

    res.status(500).json({
      message: err.message
    });
  }
};