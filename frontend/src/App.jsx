import React, { useEffect, useMemo, useState } from "react";

// In production set VITE_API_URL to your deployed backend URL (e.g. https://ai-journal-backend.onrender.com)
// In local dev leave it unset — Vite's proxy forwards /api to localhost:4000
const API_BASE = import.meta.env.VITE_API_URL || "";

const ambienceOptions = ["forest", "ocean", "mountain"];

export default function App() {
  const [userId, setUserId] = useState("123");
  const [ambience, setAmbience] = useState("forest");
  const [text, setText] = useState("");
  const [entries, setEntries] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [insights, setInsights] = useState(null);
  const [status, setStatus] = useState("");

  const canSubmit = useMemo(() => userId.trim() && text.trim(), [userId, text]);

  async function loadEntries() {
    if (!userId.trim()) return;
    try {
      const response = await fetch(`${API_BASE}/api/journal/${encodeURIComponent(userId)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      console.log("Entries loaded:", data);
      setEntries(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load entries:", error);
      setStatus(`Error loading entries: ${error.message}`);
    }
  }

  async function loadInsights() {
    if (!userId.trim()) return;
    try {
      const response = await fetch(`${API_BASE}/api/journal/insights/${encodeURIComponent(userId)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      console.log("Insights loaded:", data);
      setInsights(data);
    } catch (error) {
      console.error("Failed to load insights:", error);
      setStatus(`Error loading insights: ${error.message}`);
    }
  }

  async function saveEntry() {
    if (!canSubmit) return;
    setStatus("Saving entry...");

    try {
      const response = await fetch(`${API_BASE}/api/journal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ambience, text })
      });

      const data = await response.json();
      if (!response.ok) {
        setStatus(data.error || `Failed to save entry (${response.status}).`);
        return;
      }

      console.log("Entry saved:", data);
      setStatus("Entry saved.");
      setText("");
      await loadEntries();
      await loadInsights();
    } catch (error) {
      console.error("Save entry error:", error);
      setStatus(`Error: ${error.message}`);
    }
  }

  async function analyze() {
    if (!text.trim()) return;
    setStatus("Analyzing with LLM...");

    try {
      const response = await fetch(`${API_BASE}/api/journal/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      const data = await response.json();
      if (!response.ok) {
        setStatus(data.error || `Analysis failed (${response.status}).`);
        return;
      }

      console.log("Analysis result:", data);
      setAnalysis(data);
      setStatus(`Analysis complete (${data.cached ? "cache" : data.provider || "llm"}).`);
    } catch (error) {
      console.error("Analyze error:", error);
      setStatus(`Error: ${error.message}`);
    }
  }

  async function analyzeAndAttach(entryId, sourceText) {
    setStatus("Analyzing entry and attaching result...");

    try {
      const analysisResponse = await fetch(`${API_BASE}/api/journal/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText })
      });

      const analysisData = await analysisResponse.json();
      if (!analysisResponse.ok) {
        setStatus(analysisData.error || "Analysis failed.");
        return;
      }

      const attachResponse = await fetch(`${API_BASE}/api/journal/${entryId}/attach-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emotion: analysisData.emotion,
          keywords: analysisData.keywords,
          summary: analysisData.summary
        })
      });

      if (!attachResponse.ok) {
        const attachData = await attachResponse.json();
        setStatus(attachData.error || "Failed to attach analysis.");
        return;
      }

      console.log("Analysis attached:", analysisData);
      setAnalysis(analysisData);
      setStatus("Entry analyzed and updated.");
      await loadEntries();
      await loadInsights();
    } catch (error) {
      console.error("Analyze and attach error:", error);
      setStatus(`Error: ${error.message}`);
    }
  }

  useEffect(() => {
    console.log("✅ App MOUNTED - Console working!");
    loadEntries();
    loadInsights();
  }, []);

  const statusTone = status.toLowerCase().includes("error") || status.toLowerCase().includes("failed")
    ? "danger"
    : status.toLowerCase().includes("complete") || status.toLowerCase().includes("saved")
      ? "success"
      : "neutral";

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Mindful Journaling, Powered by AI</p>
        <h1>AI-Assisted Journal System</h1>
        <p className="hero-subtitle">
          Capture your day, discover your emotional patterns, and reconnect with nature-inspired calm.
        </p>
      </section>

      <section className="card">
        <h2>Write Journal Entry</h2>
        <label>
          User ID
          <input value={userId} onChange={(e) => setUserId(e.target.value)} />
        </label>

        <label>
          Ambience
          <select value={ambience} onChange={(e) => setAmbience(e.target.value)}>
            {ambienceOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          Text
          <textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="How was your session?"
          />
        </label>

        <div className="row">
          <button className="btn btn-primary" onClick={saveEntry} disabled={!canSubmit}>
            Save Entry
          </button>
          <button className="btn btn-secondary" onClick={analyze} disabled={!text.trim()}>
            Analyze
          </button>
          <button
            className="btn btn-ghost"
            onClick={async () => {
              await loadEntries();
              await loadInsights();
            }}
          >
            Refresh
          </button>
        </div>

        <p className={`status status-${statusTone}`}>
          <strong>Status:</strong> {status || "Ready"}
        </p>
      </section>

      <section className="card">
        <h2>Analysis Result</h2>
        {!analysis && <p className="empty-state">No analysis yet.</p>}
        {analysis && (
          <div className="panel panel-analysis">
            <p><strong>Emotion:</strong> {analysis.emotion}</p>
            <p><strong>Keywords:</strong> {analysis.keywords.join(", ")}</p>
            <p><strong>Summary:</strong> {analysis.summary}</p>
          </div>
        )}
      </section>

      <section className="card">
        <h2>User Insights</h2>
        {!insights && <p className="empty-state">No insights yet.</p>}
        {insights && (
          <div className="panel panel-insights">
            <p><strong>Total Entries:</strong> {insights.totalEntries}</p>
            <p><strong>Top Emotion:</strong> {insights.topEmotion || "N/A"}</p>
            <p><strong>Most Used Ambience:</strong> {insights.mostUsedAmbience || "N/A"}</p>
            <p><strong>Recent Keywords:</strong> {(insights.recentKeywords || []).join(", ") || "N/A"}</p>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Previous Entries</h2>
        {entries.length === 0 && <p className="empty-state">No entries found.</p>}
        {entries.map((entry) => (
          <article key={entry.id} className="entry">
            <div className="row spread">
              <small>
                #{entry.id} | {entry.ambience} | {entry.createdAt}
              </small>
              <button className="btn btn-inline" onClick={() => analyzeAndAttach(entry.id, entry.text)}>
                Analyze Entry
              </button>
            </div>
            <p className="entry-text">{entry.text}</p>
            {entry.analysisEmotion && (
              <p className="entry-analysis">
                <strong>{entry.analysisEmotion}</strong> | {(entry.analysisKeywords || []).join(", ")}
              </p>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
