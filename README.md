# HawkWaste 🦅
**AI-powered food waste tracker for IIT Commons · Built at IIT Hackathon 2026**

HawkWaste lets FSW staff photograph the waste bin at each bag change.
GPT-4o-mini estimates fullness and weight. The dashboard shows weekly trends
and generates one AI recommendation to reduce waste next week.

---

## Setup

### Backend (Python + Flask)

```bash
cd backend
pip install -r requirements.txt
export OPENAI_API_KEY=your_key_here
python app.py
```

Backend runs at http://localhost:5000

### Frontend (React)

```bash
cd frontend
npm install
npm start
```

Frontend runs at http://localhost:3000

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| POST | /analyze-photo | Upload bin photo → returns waste estimate |
| GET | /logs | All logged entries + mock data summary |
| GET | /recommendation | AI-generated weekly waste tip |
| GET | /menu | IIT Commons station list |

### POST /analyze-photo
Form data: `image` (file), `shift` (breakfast/lunch/dinner)

Response:
```json
{
  "fullness_percent": 68,
  "estimated_lbs": 11.2,
  "confidence": "medium",
  "shift": "lunch",
  "timestamp": "2026-04-04T13:45:00"
}
```

---

## Deployment

**Backend → Render.com**
1. Push to GitHub
2. New Web Service on Render → connect repo → set root to /backend
3. Set environment variable: `OPENAI_API_KEY`
4. Build command: `pip install -r requirements.txt`
5. Start command: `gunicorn app:app`

**Frontend → Vercel**
1. Push to GitHub
2. New project on Vercel → connect repo → set root to /frontend
3. Set environment variable: `REACT_APP_API_URL=https://your-render-url.onrender.com`
4. Deploy

---

## Team
- P1 (Python + FSW) — Backend API + pitch
- P2 (Python + FSW) — Recommendations + mock data
- P3 (React) — Frontend + deployment

## The Problem We Solve
Chartwells at IIT Commons has no system to track which menu items waste the most.
Chefs use paper logs. Dishwashers can't enter data. HawkWaste requires one photo
per shift change — no training, no hardware, no behavior change from kitchen staff.

## Why Not Leanpath?
Enterprise tools like Leanpath cost thousands and require dedicated hardware.
HawkWaste costs under $1/month in API fees and runs on any phone already in the kitchen.
