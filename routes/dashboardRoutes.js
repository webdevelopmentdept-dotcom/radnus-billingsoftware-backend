const express = require("express");
const router = express.Router();

const { getDashboardStats } = require("../controllers/dashboardController");
const storeScope = require("../middleware/storeScope");

router.get("/stats", storeScope, getDashboardStats);

module.exports = router;