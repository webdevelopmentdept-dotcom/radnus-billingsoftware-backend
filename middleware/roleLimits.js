// middleware/roleLimits.js
// Phase 2D - Engineer role billing/edit routes-a use panna koodaadhu.
//
// Engineer dashboard use pannura routes (ALLOWED): filter, GET /:id, PATCH status,
// steps (add / toggle / delete), transfer, workload.
// BLOCKED for engineer: job create, edit, rebill, invoice, spares, cancel,
// send-whatsapp, send-invoice, send-estimate, manual-insert.
//
// SAFE ROLLOUT:
//   Default  = AUDIT mode -> block pannaadhu, "would block" nu log mattum pannum.
//   Enforce  = .env / Render env-la   ROLE_LIMITS=enforce   (server restart venum)
// Munnaadi konja naal audit log paaru; engineer-ku theriyaama vera valid use illa nu
// confirm pannitu enforce pannu.
const ID = "[a-f0-9]{24}";

const BLOCKED = [
  ["POST", /^\/?$/],                                                   // create job
  ["PUT",  new RegExp(`^/${ID}/?$`)],                                  // edit job
  ["PUT",  new RegExp(`^/${ID}/(rebill|invoice|spares|cancel)/?$`)],   // billing ops
  ["POST", new RegExp(`^/${ID}/send-whatsapp/?$`)],
  ["POST", new RegExp(`^/send-(invoice|estimate)/${ID}/?$`)],
  ["POST", /^\/manual-insert\/?$/],
];

exports.isBlockedForEngineer = (method, path) =>
  BLOCKED.some(([m, re]) => m === method && re.test(path));

exports.engineerLimits = (req, res, next) => {
  if (req.user?.role !== "engineer") return next();
  if (!exports.isBlockedForEngineer(req.method, req.path)) return next();

  if (process.env.ROLE_LIMITS === "enforce") {
    return res.status(403).json({ message: "Not allowed for your role" });
  }
  console.warn(`[roleLimits] AUDIT (would block): engineer ${req.user.userId} ${req.method} ${req.originalUrl}`);
  next();
};