# AI-Assisted Journal System

Complete full-stack journal app with LLM emotion analysis, insights aggregation, and a React UI.

## What You Get

- Journal entry creation and history
- Emotion analysis from LLM
- Keyword extraction and short summary
- Per-user insights: total entries, top emotion, most used ambience, recent keywords
- Analysis caching for faster repeated requests

## Tech Stack

- Backend: Node.js + Express
- Frontend: React + Vite
- Database: SQLite (better-sqlite3)
- LLM providers (fallback order):
  - Groq
  - OpenRouter
  - Ollama (local)

## Project Structure

```text
backend/
  src/
    db/database.js
    routes/journalRoutes.js
    services/llmService.js
    index.js
  .env.example
frontend/
  src/
    App.jsx
    main.jsx
    styles.css
README.md
```

## Prerequisites

- Node.js 18+ (recommended: 20+)
- npm
- Optional: Ollama installed locally if you want offline/local inference

## Quick Start

### 1. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Configure environment

```bash
cd ../backend
copy .env.example .env
```

Open backend/.env and configure at least one provider.

Option A (recommended): Groq

```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.1-8b-instant
```

Option B: OpenRouter

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
```

Option C: Ollama local

```bash
ollama pull llama3.1:8b
```

Keep in .env:

```env
OLLAMA_MODEL=llama3.1:8b
```

### 3. Run backend

```bash
cd backend
npm run dev
```

Backend: http://localhost:4000

### 4. Run frontend

Open another terminal:

```bash
cd frontend
npm run dev
```

Frontend: http://localhost:5173

The frontend proxies /api requests to the backend.

## First-Time Usage Walkthrough

1. Open http://localhost:5173
2. Enter user ID (example: 123)
3. Select ambience (forest, ocean, mountain)
4. Write journal text
5. Click Save Entry
6. Click Analyze to get emotion, keywords, and summary
7. Check User Insights and Previous Entries sections

## API Reference

### Health

GET /api/health

Response:

```json
{
  "status": "ok",
  "llmProvider": "groq"
}
```

### Create Entry

POST /api/journal

Request:

```json
{
  "userId": "123",
  "ambience": "forest",
  "text": "I felt calm today after listening to the rain."
}
```

### Get Entries

GET /api/journal/:userId

### Analyze Text

POST /api/journal/analyze

Request:

```json
{
  "text": "I felt calm today after listening to the rain."
}
```

Response shape:

```json
{
  "emotion": "calm",
  "keywords": ["rain", "nature", "peaceful"],
  "summary": "User felt relaxed and emotionally settled.",
  "provider": "groq",
  "cached": false
}
```

### Get Insights

GET /api/journal/insights/:userId

Response shape:

```json
{
  "totalEntries": 8,
  "topEmotion": "calm",
  "mostUsedAmbience": "forest",
  "recentKeywords": ["focus", "nature", "rain"]
}
```

### Attach Analysis To Existing Entry

POST /api/journal/:id/attach-analysis

This analyzes the stored entry text and saves emotion, keywords, and summary onto that entry.

## Verification Steps (Fast)

### Verify backend

```bash
powershell -Command "Invoke-RestMethod http://localhost:4000/api/health | ConvertTo-Json"
```

Expected: status ok and active provider.

### Verify frontend build

```bash
cd frontend
npm run build
```

Expected: build succeeds without errors.

### Verify analysis endpoint directly

```bash
powershell -Command "$base='http://localhost:4000'; $payload = @{ text='I felt calm today after listening to the rain and birds.' } | ConvertTo-Json; Invoke-RestMethod -Method Post -Uri \"$base/api/journal/analyze\" -ContentType 'application/json' -Body $payload | ConvertTo-Json"
```

Expected: emotion, keywords, summary, provider, cached fields.

## Full Manual Test Plan

Use the checklist below for manual testing.

Recommended minimum checks:

1. Create entry for user 123.
2. Analyze text and validate non-empty emotion/keywords/summary.
3. Analyze same text again and confirm cached is true or response is much faster.
4. Create multiple entries and verify insights update.
5. Switch to user 456 and verify data isolation.
6. Check error behavior with empty input.

## Troubleshooting

### Frontend is blank

- Open browser dev tools console and check for runtime errors.
- Confirm frontend is running on http://localhost:5173.
- Confirm backend is up with /api/health.

### Analyze fails with 503

- No provider is configured or reachable.
- Add GROQ_API_KEY or OPENROUTER_API_KEY in backend/.env.
- Or run Ollama and ensure the configured model exists.

### CORS issues

- Ensure backend .env has:

```env
ALLOWED_ORIGIN=http://localhost:5173
```

- Restart backend after .env changes.

### Port already in use

- Backend default port is 4000.
- Frontend default port is 5173.
- Stop conflicting process or change PORT in backend/.env.

## Notes

- Analysis results are cached by SHA-256 hash of normalized text.
- Analyze endpoint is rate-limited to prevent abuse.
- SQLite database file is created automatically in backend/data.

## Deployment (Free — Render + Vercel)

Deploy the backend on **Render** (free tier) and the frontend on **Vercel** (free tier).

### Step 1 — Push code to GitHub

Create a new GitHub repository and push the project:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Make sure `backend/.env` is NOT committed (it is already in `.gitignore`).

---

### Step 2 — Deploy backend on Render

1. Go to https://render.com and sign up (free)
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
5. Under **Environment Variables**, add:

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `GROQ_API_KEY` | your Groq key |
   | `GROQ_MODEL` | `llama-3.1-8b-instant` |
   | `ALLOWED_ORIGINS` | *(leave blank for now — fill after Step 3)* |

6. Click **Create Web Service**
7. Wait for deploy (~2 min). Copy the URL shown, e.g. `https://ai-journal-backend.onrender.com`

   > **Note:** Render free tier spins down after 15 min of inactivity. The first request after sleep takes ~30 s to wake up. This is normal on the free plan.

---

### Step 3 — Deploy frontend on Vercel

1. Go to https://vercel.com and sign up (free)
2. Click **Add New → Project** and import your GitHub repo
3. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Under **Environment Variables**, add:

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://ai-journal-backend.onrender.com` *(your Render URL from Step 2)* |

5. Click **Deploy**
6. Vercel gives you a URL like `https://ai-journal.vercel.app`

---

### Step 4 — Wire CORS on Render

1. Go back to your Render service → **Environment**
2. Set `ALLOWED_ORIGINS` to your Vercel URL:
   ```
   https://ai-journal.vercel.app
   ```
   (Comma-separate if you have multiple, e.g. `http://localhost:5173,https://ai-journal.vercel.app`)
3. Click **Save Changes** — Render redeploys automatically

---

### Step 5 — Verify

Open your Vercel URL in a browser. The app should load, and clicking **Analyze** should return a real LLM response from the Render backend.

Quick backend health check:

```
https://ai-journal-backend.onrender.com/api/health
```

Expected response:

```json
{ "status": "ok", "llmProvider": "groq" }
```

---

### Local dev still works

The `VITE_API_URL` env var is only read in production builds. During local development the Vite dev-server proxy forwards `/api` to `localhost:4000` automatically, so nothing changes locally.

---

### Troubleshooting deployment

| Problem | Fix |
|---------|-----|
| Vercel build fails | Make sure Root Directory is `frontend` and Output is `dist` |
| API calls return 404 on Vercel | Check `VITE_API_URL` env var is set to the Render URL |
| CORS error in browser | Set `ALLOWED_ORIGINS` on Render to your exact Vercel domain |
| Render sleeps (first request slow) | Normal on free tier; first cold-start takes ~30 s |
| Groq returns 401 | Check `GROQ_API_KEY` is set correctly on Render |
| SQLite data lost after restart | Free Render tier has no persistent disk; upgrade to paid or switch to a hosted DB |
