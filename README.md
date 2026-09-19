# ♻️ AI-Powered Waste Management & Recycling Optimizer

An intelligent waste collection platform that monitors bins, predicts overflow, classifies waste from images, prioritizes collections, and optimizes vehicle routes — all visualized on a real-time dashboard.

## 🚀 Quick Start

```bash
docker-compose up --build
```

That's it! The system will:
1. Start **PostgreSQL** (PostGIS) on port 5432
2. Start the **FastAPI backend** on [http://localhost:8000](http://localhost:8000)
3. Start the **React dashboard** on [http://localhost:5173](http://localhost:5173)

On first launch, the backend automatically seeds **40 bins** across Bangalore with 60 days of synthetic fill data, 3 collection vehicles, and initial alerts.

## 🏗️ Architecture

```
waste-optimizer/
├── backend/                  # Python FastAPI backend
│   ├── app/
│   │   ├── main.py           # FastAPI app with lifespan, CORS, WebSocket
│   │   ├── db.py             # SQLAlchemy engine + session
│   │   ├── models/           # ORM models: Bin, FillReading, Vehicle, Route, Alert
│   │   ├── api/              # REST endpoints
│   │   │   ├── bins.py       # CRUD: POST/GET bins, POST/GET readings
│   │   │   ├── classify.py   # POST /classify — image classification
│   │   │   ├── predict.py    # GET /predict/{id} — overflow prediction
│   │   │   ├── priorities.py # GET /priorities — ranked collection list
│   │   │   ├── routes.py     # GET /routes/today — CVRP-optimized routes
│   │   │   ├── alerts.py     # GET /alerts, POST /alerts/detect
│   │   │   └── analytics.py  # GET /analytics/patterns, /waste-totals
│   │   ├── ml/               # Machine learning modules
│   │   │   ├── waste_classifier.py  # LargeNet CNN wrapper
│   │   │   ├── fill_predictor.py    # Prophet / linear regression
│   │   │   ├── prioritizer.py       # Weighted priority scoring
│   │   │   ├── route_optimizer.py   # OR-Tools CVRP solver
│   │   │   └── anomaly_detector.py  # IsolationForest + thresholds
│   │   └── simulation/
│   │       └── generate_synthetic_data.py
│   ├── models/
│   │   └── waste_classifier/  # Pretrained LargeNet model files
│   │       ├── config.json
│   │       ├── model.py       # LargeNet architecture (DO NOT modify)
│   │       ├── inference.py
│   │       └── pytorch_model.bin
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                 # React + Vite dashboard
│   ├── src/
│   │   ├── pages/            # Dashboard, ClassifyPage, AnalyticsPage
│   │   ├── components/       # BinMap, RoutePanel, AlertsPanel, StatsCharts
│   │   └── App.jsx
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## 🤖 ML Models

### Waste Classifier
- **Model**: `thomasdeboer/garbage_classifier_A1` (LargeNet CNN, ~1.1 MB)
- **Location**: `backend/models/waste_classifier/`
- **Input**: 128×128 RGB image
- **Output**: 7 classes → mapped to 6 project categories (Plastic, Paper, Metal, Glass, Organic, Other)
- No internet/GPU required at runtime

### Fill-Level Predictor
- Uses **Prophet** for time-series forecasting (falls back to linear regression)
- Trained live on each bin's historical fill readings

### Anomaly Detector
- **IsolationForest** on per-zone daily waste volumes
- Plus simple threshold alerts for bins > 85%

### Route Optimizer
- **Google OR-Tools** Capacitated VRP solver
- Distance matrix from OSRM (haversine fallback if offline)

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/bins` | List all bins |
| POST | `/bins` | Create a bin |
| POST | `/bins/{id}/readings` | Add fill reading |
| GET | `/bins/{id}/readings` | Get fill history |
| POST | `/classify` | Classify waste image |
| GET | `/predict/{bin_id}` | Predict overflow time |
| GET | `/priorities` | Ranked bin priority list |
| GET | `/routes/today` | Generate optimized routes |
| GET | `/alerts` | List active alerts |
| POST | `/alerts/detect` | Trigger anomaly detection |
| GET | `/analytics/patterns` | Hotspot clusters |
| GET | `/analytics/waste-totals` | Recyclable vs non-recyclable |
| WS | `/ws` | Real-time updates |

Full API docs available at [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger UI).

## 🧪 Running Tests

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

## 🛠️ Tech Stack

- **Backend**: Python 3.11, FastAPI, Uvicorn
- **Database**: PostgreSQL + PostGIS (SQLite fallback)
- **ORM**: SQLAlchemy
- **ML/AI**: PyTorch, scikit-learn, Prophet, OR-Tools
- **Frontend**: React + Vite, Leaflet.js, Recharts
- **Realtime**: WebSockets
- **Containerization**: Docker + docker-compose

## 📝 License

Built for BitnBuild 2026.
