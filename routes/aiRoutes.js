const express = require("express");
const jwt = require("jsonwebtoken");
const { tools, runTool } = require("../services/aiTools");

const router = express.Router();

// Model names change over time. Set GEMINI_MODEL in .env to override this default.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Admin only for now
const ALLOWED_ROLES = ["admin"];

// Convert the tools defined in aiTools.js into Gemini's format
const functionDeclarations = tools.map((t) => ({
  name: t.name,
  description: t.description,
  parameters: t.input_schema,
}));

/* ---------- JWT check ---------- */
function auth(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Login required" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!ALLOWED_ROLES.includes(decoded.role)) {
      return res.status(403).json({ error: "This feature is for admins only." });
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callGemini(body) {
  const MAX_TRIES = 4;
  let lastErr;

  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    const r = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify(body),
    });
    const data = await r.json();

    if (r.ok) return data;
    lastErr = new Error(data?.error?.message || `Gemini HTTP ${r.status}`);
    lastErr.status = r.status;

    // Retry only on 500/503 (temporary overload).
    // 429 means the quota is used up, and retrying would only waste more of it.
    const retryable = [500, 503].includes(r.status);
    if (!retryable || attempt === MAX_TRIES) break;

    console.log(`Gemini busy (HTTP ${r.status}), retry ${attempt}/${MAX_TRIES - 1}...`);
    await sleep(1500 * attempt); // 1.5s, 3s, 4.5s
  }

  throw lastErr;
}

router.post("/ask", auth, async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "AI key not configured" });
    }

    const question = String(req.body.question || "").slice(0, 500).trim();
    if (!question) return res.status(400).json({ error: "Question required" });

    const history = (Array.isArray(req.body.history) ? req.body.history : [])
      .slice(-6)
      .filter((m) => m && ["user", "assistant"].includes(m.role))
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.content).slice(0, 1500) }],
      }));

    const system = `You are "Ask Radnus AI", a business insights assistant for Radnus service (mobile repair) billing software.
Today is ${new Date().toISOString().slice(0, 10)}. Currency is INR (₹).
Use ONLY the provided tools for numbers. Never guess or invent figures. If a tool returns nothing, say there is no data for that period.
Convert phrases like "this month", "last week", "yesterday" into exact from/to dates (YYYY-MM-DD).
"Profit" means service charge (income minus spare and others).
Only one store exists right now; if asked to compare stores, say store-wise data is not available yet.
Reply short and simple, in the same language as the question (English, Tamil or Tanglish). Plain text only. For several rows use "-" lists.`;

    const contents = [...history, { role: "user", parts: [{ text: question }] }];
    let answer = "";

    for (let i = 0; i < 4; i++) {
      const data = await callGemini({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        tools: [{ functionDeclarations }],
        generationConfig: { maxOutputTokens: 800, temperature: 0.2 },
      });

      const content = data.candidates?.[0]?.content;
      const parts = content?.parts || [];
      const calls = parts.filter((p) => p.functionCall);

      if (calls.length === 0) {
        answer = parts.map((p) => p.text || "").join("").trim();
        break;
      }

      // The model's tool-call message must be sent back as-is
      contents.push(content);

      const responseParts = [];
      for (const p of calls) {
        let out;
        try {
          out = await runTool(p.functionCall.name, p.functionCall.args || {});
        } catch (e) {
          console.error("AI TOOL ERROR:", p.functionCall.name, e.message);
          out = { error: "Query failed" };
        }
        responseParts.push({
          functionResponse: {
            name: p.functionCall.name,
            response: { result: out },
          },
        });
      }
      contents.push({ role: "user", parts: responseParts });
    }

    res.json({
      answer: answer || "Sorry, I could not prepare an answer. Please try again.",
    });
  } catch (err) {
    console.error("AI ERROR:", err.message);
    if (err.status === 429) {
      return res.status(429).json({
        error: "Today's free AI limit has been reached. Please try again tomorrow.",
      });
    }
    res.status(500).json({ error: "AI service error" });
  }
});

module.exports = router;