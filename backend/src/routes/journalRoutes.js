import { Router } from "express";
import { db } from "../db/database.js";
import { analyzeEmotionWithLlm, getTextHash } from "../services/llmService.js";

const router = Router();

const insertEntryStmt = db.prepare(`
  INSERT INTO journal_entries (user_id, ambience, text, analysis_emotion, analysis_keywords, analysis_summary)
  VALUES (@user_id, @ambience, @text, @analysis_emotion, @analysis_keywords, @analysis_summary)
`);

const getEntriesByUserStmt = db.prepare(`
  SELECT id, user_id AS userId, ambience, text, analysis_emotion AS analysisEmotion,
         analysis_keywords AS analysisKeywords, analysis_summary AS analysisSummary, created_at AS createdAt
  FROM journal_entries
  WHERE user_id = ?
  ORDER BY datetime(created_at) DESC
`);

const getCachedAnalysisStmt = db.prepare(`
  SELECT emotion, keywords, summary
  FROM analysis_cache
  WHERE text_hash = ?
`);

const saveCachedAnalysisStmt = db.prepare(`
  INSERT INTO analysis_cache (text_hash, normalized_text, emotion, keywords, summary)
  VALUES (@text_hash, @normalized_text, @emotion, @keywords, @summary)
  ON CONFLICT(text_hash) DO UPDATE SET
    emotion = excluded.emotion,
    keywords = excluded.keywords,
    summary = excluded.summary
`);

router.post("/", (req, res) => {
  const { userId, ambience, text } = req.body || {};

  if (!userId || !ambience || !text) {
    return res.status(400).json({ error: "userId, ambience, and text are required." });
  }

  const result = insertEntryStmt.run({
    user_id: String(userId),
    ambience: String(ambience),
    text: String(text),
    analysis_emotion: null,
    analysis_keywords: null,
    analysis_summary: null
  });

  const newEntry = db
    .prepare(
      `SELECT id, user_id AS userId, ambience, text, created_at AS createdAt FROM journal_entries WHERE id = ?`
    )
    .get(result.lastInsertRowid);

  return res.status(201).json(newEntry);
});

router.get("/:userId", (req, res) => {
  const { userId } = req.params;
  const rows = getEntriesByUserStmt.all(userId).map((row) => ({
    ...row,
    analysisKeywords: row.analysisKeywords ? JSON.parse(row.analysisKeywords) : []
  }));

  return res.json(rows);
});

router.post("/analyze", async (req, res) => {
  const { text } = req.body || {};

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text is required." });
  }

  const { hash, normalized } = getTextHash(text);
  const cached = getCachedAnalysisStmt.get(hash);

  if (cached) {
    return res.json({
      emotion: cached.emotion,
      keywords: JSON.parse(cached.keywords),
      summary: cached.summary,
      cached: true
    });
  }

  try {
    const analysis = await analyzeEmotionWithLlm(text);

    saveCachedAnalysisStmt.run({
      text_hash: hash,
      normalized_text: normalized,
      emotion: analysis.emotion,
      keywords: JSON.stringify(analysis.keywords),
      summary: analysis.summary
    });

    return res.json({
      emotion: analysis.emotion,
      keywords: analysis.keywords,
      summary: analysis.summary,
      provider: analysis.provider,
      cached: false
    });
  } catch (error) {
    return res.status(503).json({ error: error.message });
  }
});

router.get("/insights/:userId", (req, res) => {
  const { userId } = req.params;
  const rows = getEntriesByUserStmt.all(userId);

  const totalEntries = rows.length;

  const ambienceCounts = new Map();
  const emotionCounts = new Map();
  const keywordCounts = new Map();

  for (const row of rows) {
    const ambience = row.ambience?.toLowerCase();
    if (ambience) {
      ambienceCounts.set(ambience, (ambienceCounts.get(ambience) || 0) + 1);
    }

    const emotion = row.analysisEmotion?.toLowerCase();
    if (emotion) {
      emotionCounts.set(emotion, (emotionCounts.get(emotion) || 0) + 1);
    }

    if (row.analysisKeywords) {
      const parsed = JSON.parse(row.analysisKeywords);
      for (const keyword of parsed) {
        const key = String(keyword).toLowerCase();
        keywordCounts.set(key, (keywordCounts.get(key) || 0) + 1);
      }
    }
  }

  const topEmotion = [...emotionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const mostUsedAmbience = [...ambienceCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const recentKeywords = [...keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([keyword]) => keyword);

  return res.json({
    totalEntries,
    topEmotion,
    mostUsedAmbience,
    recentKeywords
  });
});

router.post("/:entryId/attach-analysis", (req, res) => {
  const { entryId } = req.params;
  const { emotion, keywords, summary } = req.body || {};

  if (!emotion || !Array.isArray(keywords) || !summary) {
    return res.status(400).json({ error: "emotion, keywords, and summary are required." });
  }

  const result = db
    .prepare(
      `UPDATE journal_entries
       SET analysis_emotion = ?, analysis_keywords = ?, analysis_summary = ?
       WHERE id = ?`
    )
    .run(String(emotion), JSON.stringify(keywords), String(summary), entryId);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Journal entry not found." });
  }

  return res.json({ success: true });
});

export default router;
