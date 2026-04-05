# HawkWaste — Project Report for Presentation Generation

**Purpose:** Feed this document to an LLM with instructions like: “Create a slide deck (or 8-page PDF-style presentation) from this report. One section ≈ one slide or one page. Keep visuals suggested in brackets.”

**Project:** HawkWaste — AI-powered food waste tracking for IIT Commons (Chartwells), Illinois Institute of Technology. Built for IIT Hackathon 2026.

---

## PAGE 1 — Title & Elevator Pitch

**Title:** HawkWaste  
**Subtitle:** AI-powered food waste intelligence for university dining  
**One-line pitch:** Staff photograph waste bins at bag change; AI estimates fullness and weight; a manager dashboard shows trends, environmental impact, sustainability score, and actionable recommendations—without expensive hardware.

**Audience:** Hackathon judges, dining operations, sustainability stakeholders.

**Key promise:** Low friction (phone camera only), low cost (API vs enterprise systems), high clarity for managers.

---

## PAGE 2 — Problem Statement

**Context:** Chartwells operates IIT Commons. Kitchens generate significant food waste; reducing it saves money, water, and carbon.

**Pain points:**
- Waste is **hard to measure consistently** across shifts and days.
- **Paper logs** are slow, error-prone, and don’t aggregate into analytics.
- **Kitchen staff** cannot be asked to learn complex software during service.
- **Enterprise waste systems** often require dedicated scales/hardware and high subscription cost—poor fit for a demo budget and flexible campus operations.

**Gap:** Need a lightweight way to capture **ground truth from the bin** and connect it to **menu and operational decisions**.

---

## PAGE 3 — Solution Overview

**HawkWaste** is a web application with two primary experiences:

1. **Log Waste (staff):** Upload a photo of the waste bin after a bag change. The system uses **AI vision** to estimate bin fullness (0–100%), estimated pounds, and confidence. Logs are stored with date, shift, and optional disposal method. Images are saved for audit/review.

2. **Dashboard (managers):** View waste by day and shift (charts), filter by date, see KPIs (total waste, average per shift, bins logged, shifts tracked), **AI-powered weekly recommendation**, **sustainability score** with week-over-week trend, environmental impact (CO₂, water, cost, meals equivalent), **“today’s menu vs waste scores”** cross-reference (dishes with waste tiers and batch-cooked context), highest/lowest waste items, trending-worse items, and recent bin logs.

**Design note:** Left sidebar (Gmail-style) holds **Manager View** title and **date filter**; main content is centered for focus.

---

## PAGE 4 — User Flow & Demo Script (for slides or live demo)

**Step A — Log waste:** Open app → **Log Waste** → select shift (breakfast / lunch / dinner) → optional date → upload bin photo → submit → see result (fullness %, lbs, confidence).

**Step B — Dashboard:** Open **Dashboard** → observe **AI recommendation** and **sustainability score** → scroll to **stats** and **bar chart** (waste by day & shift) → use **left panel** to filter dates (e.g. single day vs all dates) → open **Today’s menu vs waste** for a selected date → show **environmental impact** card if time permits.

**Success criteria for judges:** Clear link from **photo** → **structured data** → **aggregated insight** → **actionable text**.

---

## PAGE 5 — Technical Architecture

**Stack:**
- **Frontend:** React 18, React Router, Recharts (charts), Create React App; styling via CSS (layout: top navbar + dashboard shell with left rail).
- **Backend:** Python 3, Flask, Flask-CORS, Gunicorn for production.
- **AI:** OpenAI API, model **gpt-4o-mini** for (1) vision analysis of bin images and (2) natural-language recommendations and trend commentary.
- **Configuration:** `python-dotenv`; API key in `backend/.env` (never committed). Frontend uses `REACT_APP_API_URL` (local dev typically `http://localhost:5001`).

**Data persistence (no traditional database):**
- `logs.json` — photo/bin log entries from real uploads.
- `mockData.json` — synthetic shift logs and `weekSummary` for charts and menu-by-date views.
- `menuDataset.json` — menu items, historical waste metadata, AI context.
- `chefMenuDataset.json` — batch sizes and station structure; **fuzzy name matching** aligns dish names across files.
- `backend/data/bin_images/` — saved images from uploads.

**API highlights:** `POST /analyze-photo`, `GET /logs`, `GET /recommendation`, `GET /trend`, `GET /impact`, `GET /menu/today`, plus chef/compare, predict, batch-optimize for extended demos.

**Performance / freshness:** Short **in-memory cache** for expensive AI endpoints; cache **cleared when a new photo is logged** so dashboard metrics can refresh after uploads.

---

## PAGE 6 — Impact & Differentiation

**Impact framing:**
- Translate pounds of waste into **CO₂ equivalent**, **water**, **estimated food cost**, and **meals equivalent**.
- Show **“if waste cut 20%”** savings scenario for storytelling to sustainability and finance.

**Why HawkWaste vs alternatives:**
- **vs paper:** Digital, aggregate-ready, time-stamped.
- **vs enterprise hardware:** Uses existing phones; marginal API cost vs capital expense.
- **vs generic AI chat:** Purpose-built UI, structured logs, charts, and menu cross-reference tied to IIT Commons data model.

**Honest scope:** Hackathon/demo uses JSON files; production could add auth, multi-site, and a real database—architecture already separates API from storage.

---

## PAGE 7 — Challenges & Outcomes

**Technical challenges addressed:**
- **Cross-dataset dish names** differ slightly between mock logs and menu files → implemented **fuzzy matching** for batch lbs and historical waste fields.
- **Frontend/backend connectivity** and dev environment (venv, CORS, correct API URL and port).
- **Stale AI/metrics** after new uploads → **cache invalidation** on new log + shorter TTL; dashboard refetch on tab focus where implemented.

**Team outcomes:** End-to-end vertical slice—capture, store, visualize, narrate—suitable for pilot conversations with dining leadership.

---

## PAGE 8 — Roadmap, Team, Closing

**Next steps (roadmap):**
- Persistent database and user roles (manager vs line staff).
- Push notifications or daily digest when waste spikes.
- Deeper POS or production integration for automatic portion counts.
- Expanded evaluation of vision estimates against calibrated weights over time.

**Team (customize names):** Backend & API; datasets & recommendations; React UI & UX; pitch & demo.

**Closing statement for slides:** *HawkWaste makes waste visible in seconds—one photo at a time—so IIT Commons can cook smarter, waste less, and tell a measurable sustainability story.*

**Q&A prompts:** Accuracy of vision estimates, privacy of photos, integration with Chartwells systems, pilot timeline on campus.

---

*End of report (8 sections = 8 pages/slides).*
