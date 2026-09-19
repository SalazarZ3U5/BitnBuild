"""
FastAPI application — AI-Powered Waste Management & Recycling Optimizer.
"""
import json
import asyncio
from contextlib import asynccontextmanager
import sys
from pathlib import Path

# Add backend directory to sys.path for direct script execution
backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from typing import Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.db import engine, Base, SessionLocal
from app.models import Bin

# Import routers
from app.api.bins import router as bins_router
from app.api.classify import router as classify_router
from app.api.predict import router as predict_router
from app.api.priorities import router as priorities_router
from app.api.routes import router as routes_router
from app.api.alerts import router as alerts_router
from app.api.analytics import router as analytics_router
from app.api.simulation import router as simulation_router, set_broadcast_callback
from app.api.recycling import router as recycling_router



# ── WebSocket connection manager ─────────────────────────────────────────────

class ConnectionManager:
    """Manages active WebSocket connections for real-time updates."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        dead = set()
        for conn in self.active_connections:
            try:
                await conn.send_json(message)
            except Exception:
                dead.add(conn)
        self.active_connections -= dead


manager = ConnectionManager()


# ── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables and seed data on startup."""
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("[Startup] Database tables created")

    # Seed if empty
    db = SessionLocal()
    try:
        bin_count = db.query(Bin).count()
        if bin_count == 0:
            print("[Startup] No bins found — seeding synthetic data...")
            from app.simulation.generate_synthetic_data import seed_database
            seed_database(db)
            print("[Startup] Synthetic data seeded!")
        else:
            print(f"[Startup] Syncing accurate landmark locations for {bin_count} bins...")
            from app.simulation.generate_synthetic_data import sync_accurate_landmark_bins
            sync_accurate_landmark_bins(db)
            print("[Startup] Landmark locations synchronized accurately!")
    finally:
        db.close()

    # Configure simulation broadcast
    set_broadcast_callback(broadcast_bin_update)

    # Start background broadcast task
    broadcast_task = asyncio.create_task(_broadcast_updates())

    yield

    broadcast_task.cancel()



async def broadcast_bin_update():
    """Broadcasts bin status updates to connected WebSocket clients."""
    if manager.active_connections:
        db = SessionLocal()
        try:
            bins = db.query(Bin).all()
            from app.models import Alert
            from app.api.simulation import _sim_running, _sim_step_count
            alerts = db.query(Alert).filter(Alert.is_active == True).order_by(Alert.created_at.desc()).limit(20).all()
            all_critical = all((b.current_fill_percent or 0) >= 80.0 for b in bins) if bins else False
            data = {
                "type": "bin_update",
                "bins": [
                    {
                        "id": b.id,
                        "name": b.name,
                        "lat": b.lat,
                        "lng": b.lng,
                        "capacity_liters": b.capacity_liters,
                        "current_fill_percent": b.current_fill_percent,
                        "waste_type": b.waste_type.value if hasattr(b.waste_type, 'value') else b.waste_type,
                        "zone": b.zone,
                    }
                    for b in bins
                ],
                "alerts": [
                    {
                        "id": a.id,
                        "bin_id": a.bin_id,
                        "zone": a.zone,
                        "alert_type": a.alert_type,
                        "message": a.message,
                        "severity": a.severity,
                        "is_active": a.is_active,
                        "created_at": a.created_at.isoformat() if a.created_at else None,
                    }
                    for a in alerts
                ],
                "sim_status": {
                    "is_running": _sim_running,
                    "step_count": _sim_step_count,
                    "all_critical": all_critical,
                }
            }
            await manager.broadcast(data)
        finally:
            db.close()


async def _broadcast_updates():
    """Periodically broadcast bin status updates to connected WebSocket clients."""
    while True:
        await asyncio.sleep(8)  # Every 8 seconds
        await broadcast_bin_update()


# ── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="AI-Powered Waste Management & Recycling Optimizer",
    description="Smart waste collection with ML-powered prediction, classification, and route optimization",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(bins_router)
app.include_router(classify_router)
app.include_router(predict_router)
app.include_router(priorities_router)
app.include_router(routes_router)
app.include_router(alerts_router)
app.include_router(analytics_router)
app.include_router(simulation_router)
app.include_router(recycling_router)



@app.get("/")
def root():
    return {
        "name": "AI-Powered Waste Management & Recycling Optimizer",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time dashboard updates."""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Client can send commands if needed
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
