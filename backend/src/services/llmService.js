import crypto from "node:crypto";

function extractJson(text) {
  const trimmed = text.trim();

  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }

  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return JSON.parse(fencedMatch[1]);
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }

  throw new Error("LLM response did not contain valid JSON.");
}

function normalizeText(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getTextHash(text) {
  const normalized = normalizeText(text);
  const hash = crypto.createHash("sha256").update(normalized).digest("hex");
  return { hash, normalized };
}

function ensureValidResult(result) {
  if (!result || typeof result !== "object") {
    throw new Error("Invalid LLM response object.");
  }

  const emotion = String(result.emotion || "").trim().toLowerCase();
  const keywordsRaw = Array.isArray(result.keywords) ? result.keywords : [];
  const keywords = keywordsRaw
    .map((k) => String(k).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
  const summary = String(result.summary || "").trim();

  if (!emotion || !summary || keywords.length === 0) {
    throw new Error("LLM response missing required fields.");
  }

  return { emotion, keywords, summary };
}

function buildPrompt(text) {
  return [
    "Analyze the emotional tone of the journal text.",
    "Return ONLY strict JSON with keys: emotion, keywords, summary.",
    "emotion: one lowercase word (example: calm, anxious, joyful).",
    "keywords: array of 3-8 short lowercase keywords.",
    "summary: one concise sentence.",
    `Journal text: ${text}`
  ].join("\n");
}

async function analyzeWithGroq(text) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
  const prompt = buildPrompt(text);

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Groq error (${response.status}): ${body}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq returned empty content.");
  }

  return ensureValidResult(extractJson(content));
}

async function analyzeWithOpenRouter(text) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free";
  const prompt = buildPrompt(text);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter error (${response.status}): ${body}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned empty content.");
  }

  return ensureValidResult(extractJson(content));
}

async function analyzeWithOllama(text) {
  const model = process.env.OLLAMA_MODEL || "llama3.1:8b";
  const prompt = buildPrompt(text);

  const response = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama error (${response.status}): ${body}`);
  }

  const data = await response.json();
  const content = data?.message?.content;
  if (!content) {
    throw new Error("Ollama returned empty content.");
  }

  return ensureValidResult(extractJson(content));
}

export function getActiveProvider() {
  if (process.env.GROQ_API_KEY) {
    return "groq";
  }
  if (process.env.OPENROUTER_API_KEY) {
    return "openrouter";
  }
  return "ollama (requires local setup)";
}

export async function analyzeEmotionWithLlm(text) {
  const groqAttempt = await analyzeWithGroq(text).catch(() => null);
  if (groqAttempt) {
    return { ...groqAttempt, provider: "groq" };
  }

  const openRouterAttempt = await analyzeWithOpenRouter(text).catch(() => null);
  if (openRouterAttempt) {
    return { ...openRouterAttempt, provider: "openrouter" };
  }

  const ollamaAttempt = await analyzeWithOllama(text).catch(() => null);
  if (ollamaAttempt) {
    return { ...ollamaAttempt, provider: "ollama" };
  }

  throw new Error(
    "No LLM provider is available. Configure GROQ_API_KEY, OPENROUTER_API_KEY, or run Ollama locally."
  );
}
