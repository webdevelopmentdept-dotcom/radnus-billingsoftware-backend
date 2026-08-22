const generatePDF = require("../utils/generatePDF");
const sendEmail = require("../utils/sendEmail");
const JobSheet = require("../models/JobSheet");


/* ================= CREATE ================= */
exports.createJobSheet = async (req, res) => {
  try {

    const serviceData = JSON.parse(req.body.service || "{}");
    const advanceItems = JSON.parse(req.body.advanceItems || "[]");
    serviceData.advanceItems = advanceItems;

    const jobData = {
      jobSheetNo: req.body.jobSheetNo,

      customer: JSON.parse(req.body.customer || "{}"),
      device: JSON.parse(req.body.device || "{}"),

      physicalCondition: JSON.parse(req.body.physicalCondition || "[]"),
      accessories: JSON.parse(req.body.accessories || "[]"),
      visualIssues: JSON.parse(req.body.visualIssues || "[]"),

      idProofType: req.body.idProofType,
      idProofImage: req.file?.path || "",

      service: serviceData,

      // ✅ FIX 1 — spareItems create-ல் add பண்ணோம்
      spareItems: JSON.parse(req.body.spareItems || "[]"),

      createdBy: (() => {
        try { return JSON.parse(req.body.createdBy || "{}"); }
        catch { return { username: req.body.createdBy || "", role: "" }; }
      })(),

    };

    const job = new JobSheet(jobData);

    await job.save();

    res.status(201).json({
      message: "Job Sheet Saved ✅",
      job
    });

  } catch (err) {

    console.error("CREATE ERROR:", err);

    res.status(400).json({
      error: err.message
    });

  }
};


/* ================= GET ALL ================= */
exports.getJobSheets = async (req, res) => {

  try {

    const jobs = await JobSheet.find().sort({ createdAt: -1 });

    res.json(jobs);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

};


/* ================= GET SINGLE ================= */
exports.getJobSheetById = async (req, res) => {

  try {

    const job = await JobSheet.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        message: "Job sheet not found ❌"
      });
    }

    res.json(job);

  } catch (err) {

    res.status(500).json({
      message: err.message
    });

  }

};


/* ================= UPDATE ================= */
exports.updateJobSheet = async (req, res) => {
  try {
    const job = await JobSheet.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });

    // ✅ Parse all JSON fields
    const serviceData        = typeof req.body.service === "string"          ? JSON.parse(req.body.service)          : (req.body.service          || {});
    
    const customerData       = typeof req.body.customer === "string"         ? JSON.parse(req.body.customer)         : (req.body.customer         || {});
    const deviceData         = typeof req.body.device === "string"           ? JSON.parse(req.body.device)           : (req.body.device           || {});
    const physicalCondition  = typeof req.body.physicalCondition === "string"? JSON.parse(req.body.physicalCondition): (req.body.physicalCondition || []);
    const accessories        = typeof req.body.accessories === "string"      ? JSON.parse(req.body.accessories)      : (req.body.accessories       || []);
    const visualIssues       = typeof req.body.visualIssues === "string"     ? JSON.parse(req.body.visualIssues)     : (req.body.visualIssues      || []);
    const spareItems         = typeof req.body.spareItems === "string"       ? JSON.parse(req.body.spareItems)       : (req.body.spareItems        || []);
const advanceItems = typeof req.body.advanceItems === "string"
  ? JSON.parse(req.body.advanceItems)
  : (req.body.advanceItems || []);
// ✅ NEW — delta calculation for date-wise revenue ledger (spare & others EXCLUDE — avanga own date items vachi track aagum)
const oldService = job.service || {};

const deltaService = Math.max(
  0,
  Number(serviceData.serviceCharge || 0) -
  Number(oldService.serviceCharge || 0)
);

const deltaIncome = Math.max(
  0,
  Number(serviceData.income || 0) -
  Number(oldService.income || 0)
);

const newRevenueEntries = [
  ...(oldService.revenueEntries || [])
];

// ✅ Use manually selected Income Date
// instead of always using today's date.
const revenueDate = serviceData.incomeDate
  ? new Date(`${serviceData.incomeDate}T00:00:00`)
  : new Date();

if (deltaService > 0 || deltaIncome > 0) {
  newRevenueEntries.push({
    date: revenueDate,
    service: deltaService,
    spare: 0,
    income: deltaIncome,
    others: 0,
  });
}

   let rebillSnapshot = null;
    if (job.rebillPending) {
      rebillSnapshot = {
        rebilledAt:    new Date(),
        rebilledBy:    job.statusLogs?.slice(-1)[0]?.updatedBy || "admin",
        serviceCharge: Number(serviceData.serviceCharge || 0),
        spareCharge:   Number(serviceData.spareCharge   || 0),
        spareItems,
        remarks:       serviceData.remarks || "",
        status:        "Received",
      };
    }

    // ✅ Build update — service object EXPLICIT-ஆ (எந்த field-உம் miss ஆகாது)
    const updateData = {
      jobSheetNo:        req.body.jobSheetNo,
      customer:          customerData,
      device:            { ...deviceData, idProofType: req.body.idProofType },
      physicalCondition,
      accessories,
      visualIssues,
      spareItems,
    service: {
  engineer:       serviceData.engineer       || "",
  softwareEngineer: serviceData.softwareEngineer || "",
  dealer:         serviceData.dealer         || "",
  drawer:         serviceData.drawer         || "",
  serviceRep:     serviceData.serviceRep     || "",
  serviceCharge:  Number(serviceData.serviceCharge  || 0),
  spareCharge:    Number(serviceData.spareCharge    || 0),
  income:         Number(serviceData.income  || 0),          // ✅ NEW
  incomeDate:     serviceData.incomeDate     || null,         // ✅ FIX — was missing, defaulted to today
  othersAmount:   Number(serviceData.othersAmount || 0),      // ✅ NEW
  othersItems:    serviceData.othersItems || [],              // ✅ NEW
  paymentMode:    serviceData.paymentMode    || "",
  repairDate:     serviceData.repairDate     || null,
  deliveryDate:   serviceData.deliveryDate   || null,
  advanceAmount:  Number(serviceData.advanceAmount  || 0),
  advanceItems:   advanceItems,
  margin:         Number(serviceData.margin  || 0),
  instaFollowers: serviceData.instaFollowers || "",
  googleReview:   serviceData.googleReview   || "",
  remarks:        serviceData.remarks        || "",
   revenueEntries: newRevenueEntries,   // ✅ NEW
},
    };

    if (req.file) {
      updateData.idProofImage = { url: req.file.path, public_id: req.file.filename };
    }

    if (rebillSnapshot) {
      updateData.rebillPending = false;
      updateData.$push = { rebillHistory: rebillSnapshot };
    }

   await JobSheet.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    // ✅ Fresh fetch — DB-லிருந்து latest data எடு
    const freshJob = await JobSheet.findById(req.params.id);



    res.json({ message: "Job Sheet Updated ✅", job: freshJob });

  } catch (err) {
    console.error("UPDATE ERROR:", err);
    res.status(400).json({ error: err.message });
  }
};


/* ================= SEND ESTIMATE EMAIL ================= */
exports.sendEstimateEmail = async (req, res) => {

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

    /* GENERATE PDF */

    const pdfBuffer = await generatePDF(job);

    const total =
      Number(job.service?.serviceCharge || 0) +
      Number(job.service?.spareCharge || 0);

    const subject = `Estimate - ${job.jobSheetNo}`;

    const text = `
Dear ${job.customer.name},

Here is your service estimate.

Estimate No: ${job.jobSheetNo}
Estimated Amount: ₹${total}

Thank you for choosing Radnus Communication.
`;

    /* SEND EMAIL */

    await sendEmail(
      job.customer.email,
      subject,
      text,
      pdfBuffer,
      `Estimate-${job.jobSheetNo}.pdf`
    );

    res.json({
      message: "Estimate email sent successfully"
    });

  } catch (error) {

    console.error("SEND ESTIMATE ERROR:", error);

    res.status(500).json({
      message: error.message
    });

  }

};


/* ================= USER REPORT (grouped by Service Rep) ================= */
// ✅ FIX — munnadi "createdBy.username" vachi group pannichu, so logged-in
// user vera "serviceRep" field vera irundha data varala (e.g. Kalaivani
// login pannalum service.serviceRep = "Kalai" nu irundha match aagala).
// Ippo Salesrep Report maadhiri "service.serviceRep" vachi thaan group pannum.
exports.getUserReport = async (req, res) => {
  try {
    const { jobSheetNo, fromDate, toDate } = req.query;

    const query = {};

    if (jobSheetNo && jobSheetNo.trim()) {
      const q = jobSheetNo.trim();
      query.$or = [
        { "service.serviceRep": { $regex: q, $options: "i" } },
        { jobSheetNo:           { $regex: q, $options: "i" } },
      ];
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

    const jobs = await JobSheet.find(query).sort({ createdAt: -1 });

    const grouped = {};
    for (const job of jobs) {
      const rep = job.service?.serviceRep?.trim() || "Unassigned";
      if (!grouped[rep]) grouped[rep] = [];
      grouped[rep].push(job);
    }

    res.json(grouped);
  } catch (err) {
    console.error("USER REPORT ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};