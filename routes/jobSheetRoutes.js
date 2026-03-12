const express = require("express");
const router = express.Router();

const JobSheet = require("../models/JobSheet");
const upload = require("../middleware/upload");

const generatePDF = require("../utils/generatePDF");
const sendEmail = require("../utils/sendEmail");

const {
  sendEstimateEmail,
  updateJobSheet,
  getJobSheetById
} = require("../controllers/jobSheetController");


/* =====================================================
   FILTER JOBSHEETS
===================================================== */
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
    if (engineer) query["service.engineer"] = engineer;

    if (dealer) {
      query["service.dealer"] = { $regex: dealer, $options: "i" };
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

    const data = await JobSheet
      .find(query)
      .sort({ createdAt: -1 });

    res.json(data);

  } catch (err) {

    console.error("FILTER ERROR:", err);

    res.status(500).json({
      message: err.message
    });

  }
});


/* =====================================================
   CREATE JOB SHEET
===================================================== */
router.post("/", upload.single("idProofImage"), async (req, res) => {

  try {

    const newJob = new JobSheet({

      jobSheetNo: req.body.jobSheetNo,

      customer: JSON.parse(req.body.customer || "{}"),
      device: JSON.parse(req.body.device || "{}"),
      service: JSON.parse(req.body.service || "{}"),

      physicalCondition: JSON.parse(req.body.physicalCondition || "{}"),
      accessories: JSON.parse(req.body.accessories || "{}"),
      visualIssues: JSON.parse(req.body.visualIssues || "{}"),

      spareItems: JSON.parse(req.body.spareItems || "[]"),

      idProofType: req.body.idProofType,

      idProofImage: req.file ? req.file.path : null,

      createdBy: JSON.parse(req.body.createdBy || "{}")

    });

    await newJob.save();

    res.status(201).json(newJob);

  } catch (err) {

    console.error("CREATE ERROR:", err);

    res.status(500).json({
      message: err.message
    });

  }

});


/* =====================================================
   SEND INVOICE EMAIL
===================================================== */
router.post("/send-invoice/:id", async (req, res) => {

  try {

    const job = await JobSheet.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        message: "Job not found"
      });
    }

    if (!job.customer?.email) {
      return res.status(400).json({
        message: "Customer email not available"
      });
    }
const pdfBuffer = await generatePDF(job, "invoice");

    const total =
      Number(job.service?.serviceCharge || 0) +
      Number(job.service?.spareCharge || 0);

    const subject = `Invoice - ${job.jobSheetNo}`;

    const text = `
Dear ${job.customer.name},

Your device service has been completed.

Invoice No: ${job.jobSheetNo}
Total Amount: ₹${total}

Thank you for choosing Radnus Communication.
`;

    await sendEmail(
      job.customer.email,
      subject,
      text,
      pdfBuffer,
      `Invoice-${job.jobSheetNo}.pdf`
    );

    res.json({
      message: "Invoice sent successfully ✅"
    });

  } catch (err) {

    console.error("SEND INVOICE ERROR:", err);

    res.status(500).json({
      message: err.message
    });

  }

});


/* =====================================================
   LOCK INVOICE
===================================================== */
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

    console.error("LOCK ERROR:", err);

    res.status(500).json({
      message: "Error locking invoice"
    });

  }

});


/* =====================================================
   UPDATE SPARE ITEMS
===================================================== */
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

    res.status(500).json({
      error: err.message
    });

  }

});


/* =====================================================
   NEXT JOB NUMBER
===================================================== */
router.get("/next-number", async (req, res) => {

  try {

    const lastJob = await JobSheet
      .findOne()
      .sort({ createdAt: -1 });

    if (!lastJob) {
      return res.json({ next: "JS-001" });
    }

    const lastNumber = parseInt(
      lastJob.jobSheetNo.split("-")[1]
    );

    const nextNumber = lastNumber + 1;

    const formatted =
      `JS-${String(nextNumber).padStart(3, "0")}`;

    res.json({ next: formatted });

  } catch (err) {

    res.status(500).json({
      message: err.message
    });

  }

});


/* =====================================================
   BASIC ROUTES
===================================================== */

router.get("/:id", getJobSheetById);

router.put("/:id", updateJobSheet);

router.post("/send-estimate/:id", sendEstimateEmail);


module.exports = router;