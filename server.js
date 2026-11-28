const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);
const express = require("express");
const bcrypt = require("bcrypt");
const cors = require("cors");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
require("dotenv").config();
// const sendEmail = require("./utils/sendEmail");
const protect = require("./middleware/authMiddleware");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const makeRoutes = require("./routes/makeRoutes");
const districtRoutes = require("./routes/districtRoutes");
const talukRoutes = require("./routes/talukRoutes");


const app = express();

// Render proxy pinnaadi irukku, so real client IP-a edukka idhu thevai
app.set("trust proxy", 1);

// ✅ NEW — stops Express's default ETag-based conditional caching. Without this, browsers
// were getting 304 "Not Modified" responses for /api/faults, /api/makes, /api/models,
// /api/drawers, etc. and reusing a STALE cached list — so newly added Make/Model/Fault/Drawer
// (from the sidebar popups OR the Job Sheet inline "Add New") never showed up until a hard
// refresh. Disabling etag globally forces every GET to always return fresh data.
app.disable("etag");

app.use(helmet({
  // Frontend vera domain-la irundhu API-ah call pannum, adhunaala block aaga koodadhu
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// ================= MIDDLEWARE =================
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://billingsoftware-frontend.vercel.app",
    "https://radnus-billingsoftware-frontend.vercel.app",
    "https://service.radnus.in",
    "https://radnus-billingsoftware-backend.onrender.com"
  ],
  credentials: true
}));

app.use(express.json());

// ================= DB CONNECT =================
connectDB();

app.get("/", (req, res) => {
  res.send("Backend API running 🚀");
});

// ================= LOGIN API =================
const User = require("./models/User");

// 15 nimishathula oru IP-la 10 thappaana login attempt mattum.
// Sariyaana login count aagaadhu (skipSuccessfulRequests).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "Too many login attempts. Please try again after 15 minutes." },
});

app.post("/api/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: "Invalid username or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid username or password" });

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        userId: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        feedbackAccess: user.feedbackAccess || "none",   // ✅ NEW
        linkedRep: user.linkedRep || ""
      }
    });
  } catch (err) {
    console.log("LOGIN ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

// ================= AUTH GUARD =================
// Idhukku keela irukkura ELLA /api routes-kum valid login token kattayam.
app.use("/api", protect);

// ================= ROUTES =================
app.use("/api/jobsheets", require("./routes/jobSheetRoutes"));
app.use("/api/models", require("./routes/modelRoutes"));
app.use("/api/faults", require("./routes/faultRoutes"));
app.use("/api/drawers", require("./routes/drawerRoutes"));
app.use("/api/engineers", require("./routes/engineerRoutes"));
app.use("/api/salesreps", require("./routes/salesRepRoutes")); // ✅ ONE TIME ONLY
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/feedback", require("./routes/feedbackRoutes"));
app.use("/api/cases", require("./routes/caseRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/analytics", require("./routes/analyticsRoutes"));   // ✅ NEW
app.use("/api/makes", makeRoutes);
app.use("/api/physical-conditions", require("./routes/physicalConditionRoutes"));
app.use("/api/accessories", require("./routes/accessoryRoutes"));
app.use("/api/districts", districtRoutes);
app.use("/api/ai", require("./routes/aiRoutes"));
app.use("/api/taluks", talukRoutes);
app.use("/api/spares", require("./routes/Spareroutes"));
app.use("/api/stores", require("./routes/storeRoutes"));

// ================= TEST EMAIL =================
// app.get("/test-email", async (req, res) => {
//   try {
//     await sendEmail(
//       "sarathadeviiayyappan@gmail.com",
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
// ================= SERVER =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});