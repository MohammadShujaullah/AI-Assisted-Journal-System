import "dotenv/config";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import journalRoutes from "./routes/journalRoutes.js";
import { getActiveProvider } from "./services/llmService.js";
import "./db/database.js";

const app = express();
const port = Number(process.env.PORT || 4000);

// ALLOWED_ORIGINS accepts comma-separated list, e.g.:
// http://localhost:5173,https://ai-journal.vercel.app
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function isAllowedVercelOrigin(origin) {
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman)
      if (!origin || allowedOrigins.includes(origin) || isAllowedVercelOrigin(origin)) {
        return callback(null, true);
      }

      // Deny unknown origins without turning it into a server error.
      return callback(null, false);
    }
  })
);

app.use(
  "/api/journal/analyze",
  rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", llmProvider: getActiveProvider() });
});

app.use("/api/journal", journalRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});
