const express = require("express");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const User = require("../models/User");
const protect = require("../middleware/authMiddleware");
const { adminOnly, adminOrManager } = require("../middleware/roleMiddleware");
const storeScope = require("../middleware/storeScope");

const router = express.Router();

const ACCESS = ["none", "with_billing", "only"];

// Phase 2D: yaaru entha role create/manage pannalam
const ADMIN_CAN_CREATE = ["admin", "user", "engineer", "storeManager"];
const MANAGER_CAN_MANAGE = ["user", "engineer"];

// CREATE USER (admin, or store manager - own store, user/engineer mattum)
router.post("/", protect, adminOrManager, storeScope, async (req, res) => {
  try {
    const { name, username, password, role, feedbackAccess, linkedRep, storeId: requestedStore } = req.body;
    const isAdmin = req.user.role === "admin";
    const finalRole = role || "user";

    if (!(isAdmin ? ADMIN_CAN_CREATE : MANAGER_CAN_MANAGE).includes(finalRole)) {
      return res.status(isAdmin ? 400 : 403).json({ message: "You cannot create this role" });
    }
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    // Store: admin-ku store illa. Store manager-ku store KATTAYAM (explicit). Matravanga: server decide pannum.
    let storeId;
    if (finalRole !== "admin") {
      if (finalRole === "storeManager" && !requestedStore) {
        return res.status(400).json({ message: "Select a store for the Store Manager" });
      }
      storeId = await storeScope.pickStoreId(req, requestedStore);
      if (storeId === null) return res.status(400).json({ message: "Invalid store" });
    }

    const hash = await bcrypt.hash(password, 10);
    const isUser = finalRole === "user";

    if (isUser && linkedRep) {
      const taken = await User.findOne({ linkedRep });
      if (taken) {
        return res.status(400).json({ message: `Rep "${linkedRep}" already linked to ${taken.username}` });
      }
    }

    const user = new User({
      name,
      username,
      password: hash,
      role: finalRole,
      feedbackAccess: isUser && ACCESS.includes(feedbackAccess) ? feedbackAccess : "none",
      linkedRep: isUser ? (linkedRep || "") : "",
      storeId,
    });
    await user.save();
    res.json({ message: "User created ✅" });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: "Username already exists" });
    res.status(500).json({ message: "Error creating user" });
  }
});

// GET USERS (admin: scope-padi ellaarum | store manager: own store, admin accounts illa)
router.get("/", protect, adminOrManager, storeScope, async (req, res) => {
  try {
    const base = req.user.role === "admin" ? {} : { role: { $in: ["user", "engineer", "storeManager"] } };
    const users = await User.find(
      storeScope.and(req, base),
      { username: 1, role: 1, name: 1, feedbackAccess: 1, linkedRep: 1, storeId: 1 }
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// UPDATE feedback access / linked rep (admin only)
router.patch("/:id/access", protect, adminOnly, async (req, res) => {
  try {
    const { feedbackAccess, linkedRep } = req.body;
    const upd = {};

    if (feedbackAccess !== undefined) {
      if (!ACCESS.includes(feedbackAccess)) {
        return res.status(400).json({ message: "Invalid access value" });
      }
      upd.feedbackAccess = feedbackAccess;
    }

    if (linkedRep !== undefined) {
      if (linkedRep) {
        const taken = await User.findOne({ linkedRep, _id: { $ne: req.params.id } });
        if (taken) {
          return res.status(400).json({ message: `Rep "${linkedRep}" already linked to ${taken.username}` });
        }
      }
      upd.linkedRep = linkedRep;
    }

    await User.findByIdAndUpdate(req.params.id, upd);
    res.json({ message: "Updated ✅" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Phase 2D: ASSIGN STORE (admin only) - pazhaya user-a vera store-ku maathu
router.patch("/:id/store", protect, adminOnly, storeScope, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid user id" });
    if (!req.body.storeId) return res.status(400).json({ message: "Select a store" });

    const target = await User.findById(req.params.id).select("role").lean();
    if (!target) return res.status(404).json({ message: "User not found" });
    if (target.role === "admin") return res.status(400).json({ message: "Admin accounts are not tied to a store" });

    const storeId = await storeScope.pickStoreId(req, req.body.storeId);
    if (!storeId) return res.status(400).json({ message: "Invalid or inactive store" });

    await User.findByIdAndUpdate(req.params.id, { storeId });
    res.json({ message: "Store updated ✅" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE USER (admin, or store manager - own store user/engineer mattum)
router.delete("/:id", protect, adminOrManager, storeScope, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid user id" });

    const target = await User.findById(req.params.id).select("role storeId").lean();
    if (!target) return res.status(404).json({ message: "User not found" });

    if (String(target._id) === String(req.user.userId)) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }
    if (req.user.role !== "admin" && !MANAGER_CAN_MANAGE.includes(target.role)) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!storeScope.canAccess(req, target)) {
      return res.status(404).json({ message: "User not found" });     // vera store user
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;