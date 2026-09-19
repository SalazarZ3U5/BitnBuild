# Master Build Prompt — AI-Powered Waste Management & Recycling Optimizer (PS-11)

> Copy everything below this line and give it to your coding agent (Claude Code, Cursor, Devin, etc.) as the task description.

---

## ROLE

You are an autonomous full-stack + ML engineering agent. Build a complete, runnable, demo-ready web application called **"AI-Powered Waste Management & Recycling Optimizer"**. Work module by module, commit working code at each milestone, and don't stop until every module below runs end-to-end with sample data. Prefer free/open-source/local models — no paid APIs, no API keys required to run the demo.

## PROJECT SUMMARY

Cities, campuses, and residential communities generate waste that is collected on fixed schedules without regard to real bin fill levels, waste type, or route efficiency. Build a system that monitors bins, predicts when they'll overflow, classifies waste from images, prioritizes and routes collection vehicles, and visualizes everything on a dashboard.

## CURRENT STATE OF THE PROJECT FOLDER

No project structure exists yet. The working directory is empty except for these 5 files, which are already sitting directly in the **root folder** (not inside any subfolder):

```
./config.json
./inference.py
./model.py
./pytorch_model.bin
./requirements.txt
```

These are the pretrained waste-classification model and its loading code (see "MODEL SETUP" below for what each file is and how to use it). Everything else — the entire folder structure, backend, frontend, database, and all application code — must be created from scratch. As one of your first steps, create the structure in the "FOLDER STRUCTURE TO CREATE" section below and **move these 5 existing root files into `backend/models/waste_classifier/`** (don't re-download them, don't overwrite them, just relocate them and merge `requirements.txt`'s contents into `backend/requirements.txt`).

## TECH STACK (use exactly this unless a step says otherwise)

- **Backend:** Python 3.11, FastAPI, Uvicorn
- **Database:** PostgreSQL with PostGIS extension (fallback: SQLite + a `lat`/`lng` columns if PostGIS isn't available in the environment)
- **ORM:** SQLAlchemy + Alembic for migrations
- **ML / AI:** scikit-learn, Prophet (`prophet` package), PyTorch + torchvision, OR-Tools (`ortools`)
- **Frontend:** React + Vite (or Next.js), Leaflet.js (`react-leaflet`) with OpenStreetMap tiles, Recharts for charts
- **Routing engine:** OSRM public demo server for road-network distances during dev (`https://router.project-osrm.org`), with a straight-line-distance fallback if no internet
- **Realtime:** WebSockets (FastAPI's built-in) for pushing bin/vehicle updates to the dashboard
- **Containerization:** Docker + docker-compose (backend, frontend, postgres as three services)

## FOLDER STRUCTURE TO CREATE

None of this exists yet — build it from an empty root (aside from the 5 model files noted above, which get moved into `backend/models/waste_classifier/`):

```
waste-optimizer/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models/                # SQLAlchemy models: Bin, FillReading, Vehicle, Route, Alert
│   │   ├── api/                   # routers: bins.py, predict.py, classify.py, routes.py, alerts.py, analytics.py
│   │   ├── ml/
│   │   │   ├── fill_predictor.py
│   │   │   ├── waste_classifier.py
│   │   │   ├── prioritizer.py
│   │   │   ├── route_optimizer.py
│   │   │   └── anomaly_detector.py
│   │   ├── simulation/
│   │   │   └── generate_synthetic_data.py
│   │   └── db.py
│   ├── models/                    # <-- DOWNLOADED ML MODEL FILES GO HERE (see "MODEL SETUP" below)
│   │   └── waste_classifier/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/Dashboard.jsx
│   │   ├── components/BinMap.jsx, RoutePanel.jsx, AlertsPanel.jsx, StatsCharts.jsx
│   │   └── App.jsx
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## MODEL SETUP — FILES ALREADY PROVIDED (do not download anything)

The waste-classification model is **`thomasdeboer/garbage_classifier_A1`** (a small, ~1.1 MB, fully offline PyTorch CNN called "LargeNet" — no internet access or GPU needed at runtime). Its files are **already sitting in the project root folder** (see "CURRENT STATE OF THE PROJECT FOLDER" above) — do not search for it, download it, or fetch it from Hugging Face again. Simply relocate the 5 existing root files into `backend/models/waste_classifier/` when you scaffold the project:

```
backend/models/waste_classifier/
├── config.json
├── inference.py
├── model.py
├── pytorch_model.bin
└── requirements.txt
```

**Do not discard or rewrite `model.py`** — it contains the `LargeNet` class definition required to load the `pytorch_model.bin` state dict. Keep `model.py`, `inference.py`, and `pytorch_model.bin` together in the same folder, exactly as provided.

**Model details (for the agent's reference):**
- Architecture: 2 conv layers + 2 FC layers, input 128×128 RGB, output 7 classes
- Classes (alphabetical): `["battery", "biological", "cardboard", "glass", "metal", "paper", "plastic"]`
- Preprocessing: resize to 128×128, normalize with mean=[0.5,0.5,0.5], std=[0.5,0.5,0.5]

**Map the model's 7 output classes to the 6 categories required by this project** inside `backend/app/ml/waste_classifier.py`:

| Model output | Project category |
|---|---|
| plastic | Plastic |
| paper | Paper |
| metal | Metal |
| glass | Glass |
| biological | Organic |
| battery, cardboard | Other |

**No model download is needed for fill-level prediction or anomaly detection** — `fill_predictor.py` uses Prophet/statsmodels trained live on each bin's own synthetic/historical reading history at request time, and `anomaly_detector.py` uses scikit-learn's `IsolationForest`, also trained live. Do not search for a pretrained model for these two modules.

**No model download is needed for route optimization** — `route_optimizer.py` uses Google OR-Tools' `pywrapcp` VRP solver, which is an algorithmic solver, not a trained model.

## MODULE SPECIFICATIONS

### 1. Bin Monitoring
- SQLAlchemy `Bin` model: `id, name, lat, lng, capacity_liters, waste_type (enum), zone`
- `FillReading` model: `id, bin_id, timestamp, fill_percent`
- Since there's no real hardware, write `simulation/generate_synthetic_data.py` to create ~30–50 bins across a plausible city area and backfill 60 days of hourly fill readings per bin using a sawtooth pattern (fill rises ~2–8%/day with daily noise, resets to ~0–10% at random collection events).
- `POST /bins`, `GET /bins`, `POST /bins/{id}/readings`, `GET /bins/{id}/readings`

### 2. Fill-Level Prediction
- `fill_predictor.py`: for a given bin, fit Prophet (or fall back to simple linear regression on the last 14 days if Prophet isn't installed) on its `FillReading` history and predict the timestamp at which `fill_percent` crosses 100%.
- `GET /predict/{bin_id}` → `{ predicted_overflow_at, current_fill_percent, fill_rate_per_day }`

### 3. Waste Classification
- `waste_classifier.py`: load the model from `backend/models/waste_classifier/` once at startup, expose `classify_image(image_bytes) -> {category, confidence}` using the class-mapping table above.
- `POST /classify` accepts an uploaded image, returns the predicted category and confidence.

### 4. Collection Prioritization
- `prioritizer.py`: compute `priority_score = 0.45*fill_percent + 0.30*urgency + 0.15*distance_penalty + 0.10*waste_type_weight`, where `urgency = 1 / max(hours_to_predicted_overflow, 1)` (normalize each term to 0–1 before weighting). Hazardous/priority types (e.g. organic, which smells/attracts pests) get a higher `waste_type_weight`.
- `GET /priorities` returns all bins ranked by `priority_score`.

### 5. Route Optimization
- `route_optimizer.py`: given today's list of prioritized bins (above some fill threshold, e.g. >60%) and a fleet of vehicles (`Vehicle: id, capacity, depot_lat, depot_lng`), build a distance matrix (OSRM call if online, else haversine distance) and solve a Capacitated VRP with OR-Tools (`pywrapcp` + `routing_enums_pb2`), respecting vehicle capacity.
- `GET /routes/today` returns, per vehicle, an ordered list of bin stops and the total route distance.

### 6. Dashboard (frontend)
- `BinMap.jsx`: Leaflet map, bin markers colored by fill % (green <50%, yellow 50–80%, red >80%), vehicle markers, and route polylines per vehicle (different colors).
- `RoutePanel.jsx`: list of today's routes with stop order and ETA.
- `AlertsPanel.jsx`: live list of active alerts.
- `StatsCharts.jsx`: Recharts bar/line charts for waste collected by category and by day.
- Use WebSockets to refresh bin fill levels and vehicle positions every few seconds without a full page reload.

### 7. Alerts
- `anomaly_detector.py`: run `IsolationForest` over each zone's daily total waste volume to flag zones with unusually high generation; also raise a simple threshold alert whenever a bin's `fill_percent > 85`.
- `GET /alerts` (list), plus push new alerts over the WebSocket channel as they're generated.

### 8. Analytics
- `GET /analytics/patterns`: K-Means (or DBSCAN) clustering on `(lat, lng, avg_daily_fill_rate)` to identify high-generation hotspot zones; return per-zone average fill rate and a plain-language suggested collection frequency (e.g. "Zone C fills ~9%/day → recommend collection every 2 days instead of every 4").

### 9. Waste Estimation
- `GET /analytics/waste-totals?from=&to=`: sum, per category, `capacity_liters * fill_percent_at_collection` across all recorded collections in the date range; split into recyclable (Plastic, Paper, Metal, Glass) vs non-recyclable (Organic, Other) totals.

## NON-FUNCTIONAL REQUIREMENTS

- `docker-compose up` must start Postgres, backend (port 8000), and frontend (port 5173) with one command.
- On backend startup, if the `bins` table is empty, automatically run the synthetic data generator so the demo has data immediately.
- Add a root `README.md` explaining setup, where the classifier model files ended up, and how to run `docker-compose up`.
- Add basic `pytest` tests for `prioritizer.py` and `route_optimizer.py` (deterministic logic, easy to unit test).
- Handle the case where OSRM/internet is unavailable by falling back to haversine distance everywhere without crashing.

## BUILD ORDER (do these in sequence, get each working before moving on)

1. Scaffold the folder structure, `docker-compose.yml`, DB models, and `generate_synthetic_data.py`. Move the 5 root-level model files into `backend/models/waste_classifier/` as part of this step. Verify bins + readings appear in the DB.
2. Wire up the waste classifier using the relocated model files (Model Setup section above); verify `POST /classify` returns a correct category on a sample image.
3. Implement `fill_predictor.py` and `GET /predict/{bin_id}`.
4. Implement `prioritizer.py` and `GET /priorities`.
5. Implement `route_optimizer.py` and `GET /routes/today`.
6. Build the React dashboard: map first, then routes panel, then alerts, then charts.
7. Implement `anomaly_detector.py` and wire alerts to the WebSocket feed.
8. Implement `/analytics/patterns` and `/analytics/waste-totals`.
9. Write the README and confirm `docker-compose up` works from a clean clone.

## DEFINITION OF DONE

- `docker-compose up` launches the full stack with no manual setup steps at all (the model files are already relocated during scaffolding, not downloaded).
- Dashboard loads and shows ≥30 bins on a map, colored by fill level.
- Uploading a waste photo through the UI returns a classification.
- "Generate today's routes" produces at least 2 vehicle routes respecting capacity, drawn on the map.
- Alerts panel shows at least one active alert on first load (from the synthetic data).
- Analytics page shows a hotspot chart and a recyclable-vs-non-recyclable totals chart.
