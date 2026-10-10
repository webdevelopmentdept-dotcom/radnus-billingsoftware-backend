const JobSheet = require("../models/JobSheet");

const DONE_STATUSES = ["Delivered", "Delivered NR/NA", "Repaired"];

const GROUP_FIELDS = {
  engineer:   "$service.engineer",
  serviceRep: "$service.serviceRep",
  dealer:     "$service.dealer",
  make:       "$device.make",
  model:      "$device.model",
  status:     "$device.mobileStatus",
  drawer:     "$service.drawer",
  fault:      "$visualIssues", // array → unwound below
};

const INCOME_GROUPS = [...Object.keys(GROUP_FIELDS), "none"];
const OTHER_GROUPS  = [...Object.keys(GROUP_FIELDS).filter((g) => g !== "fault"), "none"];

/* ---------- helpers ---------- */
function range(from, to) {
  const r = {};
  if (from) r.$gte = new Date(`${from}T00:00:00`);
  if (to)   r.$lte = new Date(`${to}T23:59:59.999`);
  return Object.keys(r).length ? r : null;
}

function groupId(groupBy) {
  if (!groupBy || groupBy === "none") return null;
  return { $ifNull: [GROUP_FIELDS[groupBy], "Unassigned"] };
}

function faultUnwind(groupBy) {
  return groupBy === "fault"
    ? [{ $unwind: { path: "$visualIssues", preserveNullAndEmptyArrays: true } }]
    : [];
}

const lim = (n) => Math.min(Number(n) || 10, 25);

/* ---------- tool definitions (what Claude can call) ---------- */
const tools = [
  {
    name: "income_report",
    description:
      "Date-wise income and profit from the revenue ledger. 'profit' = service charge (income minus spare and others). Optionally group by engineer, serviceRep, dealer, make, model, status, drawer or fault. Use group_by 'none' for overall total. Note: fault grouping counts a job's full amount under each fault it has.",
    input_schema: {
      type: "object",
      properties: {
        group_by: { type: "string", enum: INCOME_GROUPS },
        metric:   { type: "string", enum: ["income", "profit"], description: "Sort metric, default income" },
        from:     { type: "string", description: "YYYY-MM-DD" },
        to:       { type: "string", description: "YYYY-MM-DD" },
        limit:    { type: "integer" },
      },
      required: ["group_by"],
    },
  },
  {
    name: "spare_report",
    description:
      "Spare parts spend (returned spares excluded), by spare entry date. spare_type 'market' = bought from market (default), 'raw' = shop raw spare stock used.",
    input_schema: {
      type: "object",
      properties: {
        group_by:   { type: "string", enum: OTHER_GROUPS },
        spare_type: { type: "string", enum: ["market", "raw"] },
        from:       { type: "string" },
        to:         { type: "string" },
        limit:      { type: "integer" },
      },
      required: ["group_by"],
    },
  },
  {
    name: "jobs_report",
    description:
      "Count of job sheets. completed_only=true counts jobs with status Delivered / Delivered NR/NA / Repaired (dated by last update); otherwise counts jobs created in the range (dated by creation).",
    input_schema: {
      type: "object",
      properties: {
        group_by:       { type: "string", enum: OTHER_GROUPS },
        completed_only: { type: "boolean" },
        from:           { type: "string" },
        to:             { type: "string" },
        limit:          { type: "integer" },
      },
      required: ["group_by"],
    },
  },
  {
    name: "pending_jobs",
    description:
      "List open jobs (not delivered/repaired/cancelled/invoiced) that were created more than N days ago. Optional engineer filter.",
    input_schema: {
      type: "object",
      properties: {
        older_than_days: { type: "integer", description: "Default 7" },
        engineer:        { type: "string" },
      },
    },
  },
];

/* ---------- executors (fixed, read-only) ---------- */
async function incomeReport(i) {
  const r = range(i.from, i.to);
  const sortKey = i.metric === "profit" ? "profit" : "income";
  const p = [
    ...faultUnwind(i.group_by),
    { $unwind: "$service.revenueEntries" },
  ];
  if (r) p.push({ $match: { "service.revenueEntries.date": r } });
  p.push(
    {
      $group: {
        _id: groupId(i.group_by),
        income: { $sum: "$service.revenueEntries.income" },
        profit: { $sum: "$service.revenueEntries.service" },
        jobIds: { $addToSet: "$_id" },
      },
    },
    { $sort: { [sortKey]: -1 } },
    { $limit: lim(i.limit) },
    {
      $project: {
        _id: 0,
        name: "$_id",
        income: { $round: ["$income", 2] },
        profit: { $round: ["$profit", 2] },
        jobs: { $size: "$jobIds" },
      },
    }
  );
  return JobSheet.aggregate(p);
}

async function spareReport(i) {
  const path = i.spare_type === "raw" ? "rawSpareItems" : "spareItems";
  const r = range(i.from, i.to);
  const m = { [`${path}.isReturned`]: { $ne: true } };
  if (r) m[`${path}.date`] = r;
  return JobSheet.aggregate([
    { $unwind: "$" + path },
    { $match: m },
    {
      $group: {
        _id: groupId(i.group_by),
        amount: { $sum: `$${path}.amount` },
        items: { $sum: 1 },
      },
    },
    { $sort: { amount: -1 } },
    { $limit: lim(i.limit) },
    { $project: { _id: 0, name: "$_id", amount: { $round: ["$amount", 2] }, items: 1 } },
  ]);
}

async function jobsReport(i) {
  const dateField = i.completed_only ? "updatedAt" : "createdAt";
  const r = range(i.from, i.to);
  const m = { isCancelled: { $ne: true } };
  if (i.completed_only) m["device.mobileStatus"] = { $in: DONE_STATUSES };
  if (r) m[dateField] = r;
  return JobSheet.aggregate([
    { $match: m },
    { $group: { _id: groupId(i.group_by), jobs: { $sum: 1 } } },
    { $sort: { jobs: -1 } },
    { $limit: lim(i.limit) },
    { $project: { _id: 0, name: "$_id", jobs: 1 } },
  ]);
}

async function pendingJobs(i) {
  const days = Number(i.older_than_days ?? 7);
  const cutoff = new Date(Date.now() - days * 86400000);
   const q = {
    "device.mobileStatus": { $nin: [...DONE_STATUSES, "Cancelled", "Return"] },
    engineerStatus: { $nin: ["Ready", "Return", "Delivered"] },
    "service.drawer": { $nin: ["Return"] },
    isCancelled: { $ne: true },
    isInvoiced: { $ne: true },
    createdAt: { $lte: cutoff },
  };
  if (i.engineer) q["service.engineer"] = { $regex: i.engineer.trim(), $options: "i" };

  const jobs = await JobSheet.find(q)
    .select("jobSheetNo customer.name device.make device.model device.mobileStatus service.engineer createdAt")
    .sort({ createdAt: 1 })
    .limit(25)
    .lean();

  return jobs.map((j) => ({
    jobSheetNo: j.jobSheetNo,
    customer: j.customer?.name || "-",
    device: `${j.device?.make || ""} ${j.device?.model || ""}`.trim() || "-",
    status: j.device?.mobileStatus || "-",
    engineer: j.service?.engineer || "-",
    daysOld: Math.floor((Date.now() - new Date(j.createdAt).getTime()) / 86400000),
  }));
}

async function runTool(name, input) {
  switch (name) {
    case "income_report": return incomeReport(input);
    case "spare_report":  return spareReport(input);
    case "jobs_report":   return jobsReport(input);
    case "pending_jobs":  return pendingJobs(input);
    default: return { error: "Unknown tool" };
  }
}

module.exports = { tools, runTool };