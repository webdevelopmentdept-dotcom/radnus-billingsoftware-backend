const generatePDF = require("../utils/generatePDF");
const sendEmail = require("../utils/sendEmail");
const JobSheet = require("../models/JobSheet");

/* ================= CREATE ================= */
exports.createJobSheet = async (req, res) => {
  try {
    const jobData = {
      jobSheetNo: req.body.jobSheetNo,

      customer: JSON.parse(req.body.customer || "{}"),
      device: JSON.parse(req.body.device || "{}"),

      physicalCondition: JSON.parse(req.body.physicalCondition || "[]"),
      accessories: JSON.parse(req.body.accessories || "[]"),
      visualIssues: JSON.parse(req.body.visualIssues || "[]"),

      idProofType: req.body.idProofType,
      idProofImage: req.file?.filename || "",

      service: JSON.parse(req.body.service || "{}"),
      createdBy: JSON.parse(req.body.createdBy || "{}"),
      
    };

    const job = new JobSheet(jobData);
    await job.save();

    res.status(201).json({
      message: "Job Sheet Saved ✅",
      job,
    });

  } catch (err) {
    console.error("CREATE ERROR:", err);
    res.status(400).json({ error: err.message });
  }
};

/* ================= GET ALL ================= */
exports.getJobSheets = async (req, res) => {
  try {
    const jobs = await JobSheet.find().sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ================= GET SINGLE ================= */
exports.getJobSheetById = async (req, res) => {
  try {
    const job = await JobSheet.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job sheet not found ❌" });
    }

    res.json(job);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ================= UPDATE ================= */
exports.updateJobSheet = async (req, res) => {
  try {
    const job = await JobSheet.findById(req.params.id);

    // 🔒 LOCK CHECK
    if (job.isInvoiced) {
      return res.status(400).json({
        message: "Cannot edit after invoice generated 🔒",
      });
    }

    const updateData = {
      ...req.body,

      customer:
        typeof req.body.customer === "string"
          ? JSON.parse(req.body.customer)
          : req.body.customer,

      device:
        typeof req.body.device === "string"
          ? JSON.parse(req.body.device)
          : req.body.device,

      service:
        typeof req.body.service === "string"
          ? JSON.parse(req.body.service)
          : req.body.service,

      physicalCondition:
        typeof req.body.physicalCondition === "string"
          ? JSON.parse(req.body.physicalCondition)
          : req.body.physicalCondition,

      accessories:
        typeof req.body.accessories === "string"
          ? JSON.parse(req.body.accessories)
          : req.body.accessories,

      visualIssues:
        typeof req.body.visualIssues === "string"
          ? JSON.parse(req.body.visualIssues)
          : req.body.visualIssues,
    };

    if (req.file) {
      updateData.idProofImage = req.file.filename;
    }

    const updated = await JobSheet.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.json({
      message: "Job Sheet Updated ✅",
      job: updated,
    });

  } catch (err) {
    console.error("UPDATE ERROR:", err);
    res.status(400).json({ error: err.message });
  }
};

/* ================= INVOICE LOCK ================= */
// exports.generateInvoice = async (req, res) => {
//   try {
//     const job = await JobSheet.findById(req.params.id);

//     if (!job) {
//       return res.status(404).json({ message: "Job not found ❌" });
//     }

//     job.isInvoiced = true;

//     // ✅ ADD THIS LINE
//     job.device.mobileStatus = "Delivered";

//     await job.save();

//     res.json({ message: "Invoice locked 🔒", job });

//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

/* ================= ESTIMATE EMAIL ================= */
exports.sendEstimateEmail = async (req, res) => {
  try {
    const job = await JobSheet.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (!job.customer?.email) {
      return res.status(400).json({ message: "Email not found" });
    }

    const pdfBuffer = await generatePDF(job._id);

    const subject = `Estimate - ${job.jobSheetNo}`;

    const text = `
Dear ${job.customer.name},

Please find your estimate attached.

Thank you,
RADNUS COMMUNICATION
`;

    await sendEmail(job.customer.email, subject, text, pdfBuffer);

    res.json({ message: "Estimate sent with PDF ✅" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Email failed ❌" });
  }
};