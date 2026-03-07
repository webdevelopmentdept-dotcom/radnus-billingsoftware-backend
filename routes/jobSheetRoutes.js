const express = require("express");
const router = express.Router();

const JobSheet = require("../models/JobSheet");
const upload = require("../middleware/upload");
const generateInvoicePDF = require("../utils/generateInvoicePDF");
const sendEmail = require("../utils/sendEmail");

const {
  createJobSheet,
  getJobSheets,
  sendEstimateEmail,
  updateJobSheet,
  getJobSheetById
} = require("../controllers/jobSheetController");



// ✅ FILTER FIRST
router.get("/filter", async (req, res) => {
  try {
    const { status, fromDate, toDate, q, engineer, dealer } = req.query;
    let query = {};

    if (q) {
      query.$or = [
        { jobSheetNo: { $regex: q, $options: "i" } },
        { "device.imei": { $regex: q, $options: "i" } },
        { "customer.contact": { $regex: q, $options: "i" } },
        { "customer.name": { $regex: q, $options: "i" } }
      ];
    }

    if (status) query["device.mobileStatus"] = status;

    if (engineer) {
      query["service.engineer"] = engineer;
    }

    if (dealer) {
  query["service.dealer"] = { $regex: dealer, $options: "i" };
}


    if (fromDate || toDate) {

      query.createdAt = {};

      if (fromDate) {
        const start = new Date(fromDate);
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }

      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }

    }

    const data = await JobSheet.find(query).sort({ createdAt: -1 });
    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// CRUD
router.post("/", upload.single("idProofImage"), async (req, res) => {
  try {
    const {
      jobSheetNo,
      idProofType
    } = req.body;

   const customer = JSON.parse(req.body.customer || "{}");
const device = JSON.parse(req.body.device || "{}");
const service = JSON.parse(req.body.service || "{}");
const physicalCondition = JSON.parse(req.body.physicalCondition || "{}");
const accessories = JSON.parse(req.body.accessories || "{}");
const visualIssues = JSON.parse(req.body.visualIssues || "{}");
    const spareItems = JSON.parse(req.body.spareItems || "[]");

    const createdBy = JSON.parse(req.body.createdBy || "{}");
    const newJob = new JobSheet({
      jobSheetNo,
      customer,
      device,
      service,
      physicalCondition,
      accessories,
      visualIssues,
        spareItems,
      idProofType,
      idProofImage: req.file ? req.file.path : null,
      createdBy
    });

    await newJob.save();

    res.status(201).json(newJob);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/send-invoice/:id", async (req, res) => {
  try {
    const job = await JobSheet.findById(req.params.id);

    if (!job || !job.customer?.email) {
      return res.status(400).json({ message: "Email not found" });
    }

    // 📄 generate PDF
    const pdfBuffer = await generateInvoicePDF(job._id);

    // 📧 email content
    const subject = `Invoice - ${job.jobSheetNo}`;
    const text = `
Dear ${job.customer.name},

Your device service has been completed.

Invoice No: ${job.jobSheetNo}
Total Amount: ₹${
  Number(job.service?.serviceCharge || 0) +
  Number(job.service?.spareCharge || 0)
}

Thank you for choosing Radnus Communication.
`;

    // 📤 send mail
    await sendEmail(
      job.customer.email,
      subject,
      text,
      pdfBuffer,
      `Invoice-${job.jobSheetNo}.pdf`
    );

    res.json({ message: "Invoice sent successfully ✅" });

  } catch (err) {
  console.error("SEND INVOICE ERROR:", err);

  res.status(500).json({
    message: err.message,
    stack: err.stack
  });
}

// ================= 🔒 INVOICE LOCK =================
router.put("/:id/invoice", async (req, res) => {
  try {
    const job = await JobSheet.findByIdAndUpdate(
      req.params.id,
      {
        isInvoiced: true,
        "device.mobileStatus": "Delivered"   
      },
      { new: true }
    );

    res.json(job);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error locking invoice" });
  }
});


router.get("/user-report", async (req, res) => {
  try {

    const { jobSheetNo } = req.query;

    let filter = {};

    if (jobSheetNo) {
      filter.jobSheetNo = { $regex: jobSheetNo, $options: "i" };
    }

    const jobs = await JobSheet.find(filter)
      .sort({ createdAt: -1 });

    // group by user
    const grouped = {};

    jobs.forEach(job => {

      const user = job.createdBy?.username || "Unknown";

      if (!grouped[user]) {
        grouped[user] = [];
      }

      grouped[user].push(job);

    });

    res.json(grouped);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.put("/:id/spares", async (req, res) => {

  try {

    const { spareItems } = req.body;

    const total = spareItems.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    const updated = await JobSheet.findByIdAndUpdate(
      req.params.id,
      {
        spareItems,
        "service.spareCharge": total
      },
      { new: true }
    );

    res.json(updated);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

router.get("/spare-report", async (req, res) => {

  try {

    const { engineer, fromDate, toDate } = req.query;

    let query = {};

    if (engineer) {
      query["service.engineer"] = engineer;
    }

    if (fromDate || toDate) {

      query.createdAt = {};

      if (fromDate) {
        const start = new Date(fromDate);
        start.setHours(0,0,0,0);
        query.createdAt.$gte = start;
      }

      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23,59,59,999);
        query.createdAt.$lte = end;
      }

    }

    const jobs = await JobSheet.find(query).sort({ createdAt: -1 });

    const report = [];

    jobs.forEach(job => {

      if (!job.spareItems) return;

      job.spareItems.forEach(spare => {

        report.push({

          jobSheetNo: job.jobSheetNo,
          date: job.createdAt,
          engineer: job.service?.engineer,
          dealer: job.service?.dealer,
          customer: job.customer?.name,

          spareName: spare.name,
          qty: spare.qty,
          rate: spare.rate,
          amount: spare.amount

        });

      });

    });

    res.json(report);

  } catch (err) {

    res.status(500).json({ error: err.message });

  }

});

// router.get("/:id", async (req, res) => {
//   const data = await JobSheet.findById(req.params.id);
//   res.json(data);
// });

router.get("/next-number", async (req, res) => {
  try {
    const lastJob = await JobSheet.findOne().sort({ createdAt: -1 });

    if (!lastJob) {
      return res.json({ next: "JS-001" });
    }

    const lastNumber = parseInt(lastJob.jobSheetNo.split("-")[1]);
    const nextNumber = lastNumber + 1;

    const formatted = `JS-${String(nextNumber).padStart(3, "0")}`;

    res.json({ next: formatted });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", getJobSheetById);
router.put("/:id", updateJobSheet);
router.post("/send-estimate/:id", sendEstimateEmail);


module.exports = router;