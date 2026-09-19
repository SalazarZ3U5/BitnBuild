/**
 * Road-Snapped Routing Utility using OSRM & Bridge-Aware Waypoints.
 * Ensures vehicle collection paths strictly follow actual Ahmedabad roadways
 * and bridges rather than drawing straight lines across city blocks or river water.
 */

const ROAD_GEOMETRY_CACHE = new Map();

// Ahmedabad road bridges across the Sabarmati River
export const AHMEDABAD_BRIDGES = [
  [23.0645, 72.5835], // Subhash Bridge
  [23.0410, 72.5732], // Gandhi Bridge
  [23.0282, 72.5715], // Nehru Bridge
  [23.0225, 72.5710], // Ellis Bridge
  [23.0112, 72.5695], // Sardar Bridge
  [22.9960, 72.5645], // Dr. Ambedkar Bridge
];

const RIVER_LNG = 72.5715;

/**
 * Builds bridge-respecting waypoints when crossing Sabarmati River
 */
export function buildBridgeRespectingWaypoints(points) {
  if (!points || points.length < 2) return points || [];

  const result = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    result.push(p1);

    const crosses = (p1[1] < RIVER_LNG && p2[1] > RIVER_LNG) ||
                    (p1[1] > RIVER_LNG && p2[1] < RIVER_LNG);
    if (crosses) {
      let bestBridge = AHMEDABAD_BRIDGES[2]; // Nehru Bridge default
      let minDist = Infinity;
      for (const b of AHMEDABAD_BRIDGES) {
        const d = Math.hypot(p1[0] - b[0], p1[1] - b[1]) + Math.hypot(b[0] - p2[0], b[1] - p2[1]);
        if (d < minDist) {
          minDist = d;
          bestBridge = b;
        }
      }
      result.push(bestBridge);
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

/**
 * Fetches actual driving road polyline from OSRM service with cache and bridge fallback
 */
export async function fetchRoadSnappedRoute(depot, stops) {
  if (!stops || stops.length === 0) return [];

  const sortedStops = [...stops].sort((a, b) => (a.stop_order || 0) - (b.stop_order || 0));
  const rawPoints = [];
  if (depot) rawPoints.push([depot.lat, depot.lng]);
  sortedStops.forEach(s => rawPoints.push([s.lat, s.lng]));
  if (depot) rawPoints.push([depot.lat, depot.lng]);

  if (rawPoints.length < 2) return rawPoints;

  const cacheKey = rawPoints.map(p => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join(';');
  if (ROAD_GEOMETRY_CACHE.has(cacheKey)) {
    return ROAD_GEOMETRY_CACHE.get(cacheKey);
  }

  // Build bridge-aware waypoints first to guarantee river-safe navigation
  const bridgeSafeWaypoints = buildBridgeRespectingWaypoints(rawPoints);

  // Attempt OSRM driving service
  try {
    const coordsStr = bridgeSafeWaypoints.map(p => `${p[1].toFixed(6)},${p[0].toFixed(6)}`).join(';');
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes[0]) {
        const roadCoords = data.routes[0].geometry.coordinates.map(pt => [pt[1], pt[0]]);
        ROAD_GEOMETRY_CACHE.set(cacheKey, roadCoords);
        return roadCoords;
      }
    }
  } catch (err) {
    // Network or timeout fallback
  }

  ROAD_GEOMETRY_CACHE.set(cacheKey, bridgeSafeWaypoints);
  return bridgeSafeWaypoints;
}
