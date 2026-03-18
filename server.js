// const dns = require("dns");
// dns.setServers(["1.1.1.1", "8.8.8.8"]);
// const express = require("express");
// const bcrypt = require("bcrypt");
// const cors = require("cors");
// const jwt = require("jsonwebtoken");
// require("dotenv").config();
// const sendEmail = require("./utils/sendEmail");

// const connectDB = require("./config/db");
// const makeRoutes = require("./routes/makeRoutes");
// const app = express();

// // ================= MIDDLEWARE =================
// app.use(cors({
//   origin: [
//     "http://localhost:5173",
//     "https://billingsoftware-frontend.vercel.app",
//     "https://radnus-billingsoftware-frontend.vercel.app",
//     "https://service.radnus.in"
//   ],
//   credentials: true
// }));

// app.use(express.json());


// // const fs = require("fs");
// // const path = require("path");

// // const uploadDir = path.join(__dirname, "uploads");

// // // Create uploads folder if it doesn't exist
// // if (!fs.existsSync(uploadDir)) {
// //   fs.mkdirSync(uploadDir, { recursive: true });
// // }

// // ================= DB CONNECT =================
// connectDB();

// // ================= ADMIN USER =================
// // const ADMIN_USER = {
// //   username: "admin",
// //   passwordHash: "$2b$10$OMQCuC9lptEFQQebGAzgY.H9FlqkxqIQ7XK/E5j1SBlD8RMOdozty"
// // };

// // ================= TEST ROUTE =================
// app.get("/", (req, res) => {
//   res.send("Backend API running 🚀");
// });

// // ================= LOGIN API =================
// const User = require("./models/User");

// // app.post("/api/login", async (req, res) => {


// //   try {
// //     const { username, password } = req.body;

// //     // 🔥 ADMIN LOGIN (keep same)
// //     if (username === ADMIN_USER.username) {
// //       const isMatch = await bcrypt.compare(password, ADMIN_USER.passwordHash);

// //       if (!isMatch) {
// //         return res.status(401).json({ message: "Invalid credentials" });
// //       }

// //       const token = jwt.sign(
// //         { username, role: "admin" },
// //         process.env.JWT_SECRET,
// //         { expiresIn: "1d" }
// //       );

// //       return res.json({
// //         token,
// //         user: {
// //           username,
// //           role: "admin"
// //         }
// //       });
// //     }

// //     // 🔥 USER LOGIN (NEW)
// //     const user = await User.findOne({ username });

// //     if (!user) {
// //       return res.status(401).json({ message: "User not found" });
// //     }

// //     const isMatch = await bcrypt.compare(password, user.password);

// //     if (!isMatch) {
// //       return res.status(401).json({ message: "Wrong password" });
// //     }

// //     const token = jwt.sign(
// //       { userId: user._id, role: user.role },
// //       process.env.JWT_SECRET,
// //       { expiresIn: "1d" }
// //     );

// //     res.json({
// //       token,
// //       user: {
// //         userId: user._id,
// //         name: user.name,
// //         username: user.username,
// //         role: user.role
// //       }
// //     });

// //   } catch (err) {
// //   console.log("LOGIN ERROR:", err);
// //   res.status(500).json({ message: err.message });
// // }
// // });


// app.post("/api/login", async (req, res) => {
//   try {

//     const { username, password } = req.body;

//     // DB ல user find பண்ணும்
//     const user = await User.findOne({ username });

//     if (!user) {
//       return res.status(401).json({ message: "User not found" });
//     }

//     // password compare
//     const isMatch = await bcrypt.compare(password, user.password);

//     if (!isMatch) {
//       return res.status(401).json({ message: "Wrong password" });
//     }

//     // JWT token create
//     const token = jwt.sign(
//       { userId: user._id, role: user.role },
//       process.env.JWT_SECRET,
//       { expiresIn: "1d" }
//     );

//     res.json({
//       token,
//       user: {
//         userId: user._id,
//         name: user.name,
//         username: user.username,
//         role: user.role
//       }
//     });

//   } catch (err) {

//     console.log("LOGIN ERROR:", err);
//     res.status(500).json({ message: err.message });

//   }
// });

// // ================= JOB SHEET ROUTES =================
// app.use("/api/jobsheets", require("./routes/jobSheetRoutes"));
// // app.use("/uploads", express.static("uploads"));
// app.use("/api/models", require("./routes/modelRoutes"));
// app.use("/api/faults", require("./routes/faultRoutes"));
// app.use("/api/drawers", require("./routes/drawerRoutes"));
// app.use("/api/engineers", require("./routes/engineerRoutes"));
// app.use("/api/users", require("./routes/userRoutes"));
// app.use("/api/dashboard", require("./routes/dashboardRoutes"));

// // ✅ MAKE ROUTE (only once)
// app.use("/api/makes", makeRoutes);



// app.get("/test-email", async (req, res) => {

//   try {

//     await sendEmail(
//       "sarathadeviiayyappan@gmail.com",   // ← உங்கள் email இங்கு போடுங்கள்
//       "Radnus Email Test",
//       "Test email from Radnus Billing Software",
//       null
//     );

//     res.send("✅ Email sent successfully");

//   } catch (err) {

//     console.error(err);

//     res.send("❌ Email failed");

//   }

// });

// // ================= SERVER =================
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`🚀 Backend running on port ${PORT}`);
// });



/**
 * CSV → MongoDB Upload Script (Node.js)
 * 
 * 1. Place this file in your backend project root
 * 2. Place data.csv in the same folder
 * 3. Run: node uploadJobsheets.js
 */

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { MongoClient } = require("mongodb");
const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

require("dotenv").config();

// ─── CONFIG ────────────────────────────────────────────────────────────
const MONGO_URI   = process.env.MONGO_URI || process.env.MONGODB_URI;
const DB_NAME     = "billing-software";
const COLLECTION  = "jobsheets";
const CSV_FILE    = path.join(__dirname, "data.csv");
// ───────────────────────────────────────────────────────────────────────

// Column positions (0-indexed) — detected from your CSV layout
const COLS = {
  JOBNO:    0,
  CUSTNAME: 3,
  PHONE:    8,
  MAKE:     11,
  MODEL:    15,
  IMEI:     18,
  WARRANTY: 22,
  FAULT:    24,
  RECD:     30,
  REPDATE:  33,
  DELDATE:  37,
  STATUS:   40,
};

function clean(val = "") {
  return val.replace(/[,\s]+$/, "").trim();
}

function parseDate(val = "") {
  val = val.trim();
  if (!val) return null;
  // Supports DD-MM-YYYY and DD/MM/YYYY
  const match = val.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  return new Date(`${y}-${m}-${d}`);
}

function parseRow(row) {
  // row is an object like { "0": "5,777", "1": "", ... }
  // because csv-parser uses header row — but our CSV has no clean headers.
  // We'll read the raw values by index key (set noheaders: true below).
  const get = (idx) => (row[idx] || "").trim();

  const jobRaw = get(COLS.JOBNO).replace(/,/g, "");
  if (!/^\d+$/.test(jobRaw)) return null; // skip non-data rows

  return {
    jobSheetNo:   `JS-${jobRaw}`,
    jobNo:        parseInt(jobRaw),
    customer: {
      name:  clean(get(COLS.CUSTNAME)),
      phone: clean(get(COLS.PHONE)),
    },
    device: {
      make:  clean(get(COLS.MAKE)),
      model: clean(get(COLS.MODEL)),
      imei:  clean(get(COLS.IMEI)),
    },
    warranty:     clean(get(COLS.WARRANTY)),
    fault:        clean(get(COLS.FAULT)),
    receivedDate: parseDate(get(COLS.RECD)),
    repairDate:   parseDate(get(COLS.REPDATE)),
    deliveryDate: parseDate(get(COLS.DELDATE)),
    status:       clean(get(COLS.STATUS)),
  };
}

async function run() {
  // 1. Parse CSV
  const records = await new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(CSV_FILE)
      .pipe(csv({
        headers: false,      // no header row — use index keys "0", "1", ...
        skipLines: 0,
        strict: false,
      }))
      .on("data", (row) => {
        const doc = parseRow(row);
        if (doc) results.push(doc);
      })
      .on("end", () => resolve(results))
      .on("error", reject);
  });

  console.log(`✅ Parsed ${records.length} records`);

  // 2. Connect to MongoDB
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log("🔗 Connected to MongoDB");

  const col = client.db(DB_NAME).collection(COLLECTION);

  // 3. Upsert all records (safe to run multiple times — no duplicates)
  const ops = records.map((doc) => ({
    updateOne: {
      filter: { jobSheetNo: doc.jobSheetNo },
      update: { $set: doc },
      upsert: true,
    },
  }));

  const result = await col.bulkWrite(ops);
  console.log(`🚀 Upserted: ${result.upsertedCount}  |  Modified: ${result.modifiedCount}`);

  await client.close();
  console.log("✅ Done!");
}

run().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});