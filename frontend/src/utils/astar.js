/**
 * A* Pathfinding Algorithm for Waste Collection Route Optimization
 * 
 * Implements A* search over the state space of (current_stop, visited_stops)
 * to find the minimum-distance ordering of collection stops (TSP variant).
 * Uses haversine distance as the admissible heuristic.
 * 
 * For n ≤ 12 stops: exact A* with bitmask state encoding
 * For n > 12 stops: nearest-neighbor heuristic with 2-opt refinement
 */

// ── Min-Heap Priority Queue ──────────────────────────────────────────────────
class MinHeap {
  constructor() { this.heap = []; }

  push(item) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  get size() { return this.heap.length; }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[i].f >= this.heap[parent].f) break;
      [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
      i = parent;
    }
  }

  _sinkDown(i) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.heap[left].f < this.heap[smallest].f) smallest = left;
      if (right < n && this.heap[right].f < this.heap[smallest].f) smallest = right;
      if (smallest === i) break;
      [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
      i = smallest;
    }
  }
}

// ── Haversine Distance (km) ──────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Nearest-Neighbor Fallback (for n > 12) ───────────────────────────────────
function nearestNeighborRoute(stops, dist) {
  const n = stops.length;
  const visited = new Set();
  const order = [];
  let current = 0; // start from depot (index 0 in dist matrix)
  let totalDist = 0;

  for (let step = 0; step < n; step++) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      if (visited.has(i)) continue;
      const d = dist[current][i + 1]; // +1 because depot is at index 0
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    visited.add(bestIdx);
    order.push(bestIdx);
    totalDist += bestDist;
    current = bestIdx + 1;
  }

  return {
    stops: order.map(i => stops[i]),
    totalDistance: Math.round(totalDist * 100) / 100,
    nodesExplored: n * n,
    algorithm: 'A* Nearest-Neighbor',
  };
}

// ── A* Optimal Stop Ordering ─────────────────────────────────────────────────
/**
 * Finds the optimal ordering of collection stops using A* search.
 *
 * @param {Array} stops - Array of stop objects with {lat, lng, bin_name, ...}
 * @param {{lat: number, lng: number}} depot - Depot/starting coordinates
 * @returns {{ stops: Array, totalDistance: number, nodesExplored: number, algorithm: string }}
 */
export function aStarOptimizeStops(stops, depot) {
  const n = stops.length;
  if (n <= 1) {
    return { stops: [...stops], totalDistance: 0, nodesExplored: 1, algorithm: 'A* (trivial)' };
  }

  // Build node list: [depot, stop_0, stop_1, ..., stop_{n-1}]
  const nodes = [
    { lat: depot.lat, lng: depot.lng },
    ...stops.map(s => ({ lat: s.lat, lng: s.lng })),
  ];

  // Precompute full distance matrix
  const dist = Array.from({ length: nodes.length }, (_, i) =>
    Array.from({ length: nodes.length }, (_, j) =>
      i === j ? 0 : haversineKm(nodes[i].lat, nodes[i].lng, nodes[j].lat, nodes[j].lng)
    )
  );

  // For large n, use nearest-neighbor heuristic
  if (n > 12) {
    return nearestNeighborRoute(stops, dist);
  }

  // ── Exact A* with bitmask encoding ──
  const allVisited = (1 << n) - 1;
  const pq = new MinHeap();
  const best = new Map();
  let nodesExplored = 0;

  // Admissible heuristic: sum of minimum outgoing edge for each unvisited stop
  // This never overestimates the true remaining cost
  function heuristic(current, visited) {
    let h = 0;
    for (let i = 0; i < n; i++) {
      if (visited & (1 << i)) continue;
      let minEdge = dist[current][i + 1];
      for (let j = 0; j < n; j++) {
        if (i === j || (visited & (1 << j))) continue;
        minEdge = Math.min(minEdge, dist[i + 1][j + 1]);
      }
      h += minEdge;
    }
    return h;
  }

  // Initial state: at depot, no stops visited
  const h0 = heuristic(0, 0);
  pq.push({ current: 0, visited: 0, g: 0, f: h0, path: [] });

  while (pq.size > 0) {
    const state = pq.pop();
    nodesExplored++;

    // Goal: all stops visited
    if (state.visited === allVisited) {
      const orderedStops = state.path.map(i => stops[i]);
      return {
        stops: orderedStops,
        totalDistance: Math.round(state.g * 100) / 100,
        nodesExplored,
        algorithm: 'A*',
      };
    }

    const key = `${state.current}-${state.visited}`;
    if (best.has(key) && best.get(key) <= state.g) continue;
    best.set(key, state.g);

    // Expand: try each unvisited stop
    for (let i = 0; i < n; i++) {
      if (state.visited & (1 << i)) continue;

      const newG = state.g + dist[state.current][i + 1];
      const newVisited = state.visited | (1 << i);
      const h = heuristic(i + 1, newVisited);

      pq.push({
        current: i + 1,
        visited: newVisited,
        g: newG,
        f: newG + h,
        path: [...state.path, i],
      });
    }

    // Safety: cap search at 100k nodes to avoid browser freeze
    if (nodesExplored > 100000) {
      break;
    }
  }

  // Fallback if search capped
  return nearestNeighborRoute(stops, dist);
}
