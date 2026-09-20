import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import { aStarOptimizeStops } from '../utils/astar';
import { AMC_FLEET, getFleetVehicleMeta } from '../data/fleetData';

const TRUCK_COLORS = ['#2563eb', '#8b5cf6', '#f59e0b', '#06b6d4'];

const FleetContext = createContext(null);

export function FleetProvider({ children }) {
  const [routes, setRoutes] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [truckStates, setTruckStates] = useState(() => {
    return AMC_FLEET.map((fleetMeta, idx) => ({
      routeIdx: idx,
      vehicleName: fleetMeta.vehicleName,
      plateNumber: fleetMeta.plateNumber,
      model: fleetMeta.model,
      capacityLiters: fleetMeta.capacityLiters,
      fuelType: fleetMeta.fuelType,
      driver: fleetMeta.driver,
      zone: fleetMeta.zone,
      color: fleetMeta.color,
      position: { lat: fleetMeta.depotCoords[0], lng: fleetMeta.depotCoords[1] },
      currentStopIdx: -1,
      totalStops: 10,
      wasteCollected: 0,
      stopsCompleted: [],
      stops: [],
      done: false,
      astarMetrics: { totalDistance: 13.5, nodesExplored: 10 },
      speed: '0 km/h (Standby)',
      status: 'Ready at Depot Hub',
    }));
  });

  const [collectionActive, setCollectionActive] = useState(false);
  const [collectionComplete, setCollectionComplete] = useState(false);
  const [totalWasteCollected, setTotalWasteCollected] = useState(0);
  const [selectedTruck, setSelectedTruck] = useState(null);

  const truckStatesRef = useRef(truckStates);
  const collectionActiveRef = useRef(collectionActive);
  const collectionCompleteRef = useRef(collectionComplete);
  const collectionIntervalRef = useRef(null);

  useEffect(() => { truckStatesRef.current = truckStates; }, [truckStates]);
  useEffect(() => { collectionActiveRef.current = collectionActive; }, [collectionActive]);
  useEffect(() => { collectionCompleteRef.current = collectionComplete; }, [collectionComplete]);

  // Load routes from backend
  const fetchFleetRoutes = useCallback(async (threshold = 50.0) => {
    setRouteLoading(true);
    try {
      const res = await api.get(`/routes/today?fill_threshold=${threshold}`);
      const fetchedRoutes = res.data?.routes || [];
      setRoutes(fetchedRoutes);

      // Only update truck stops/positions if collection is not actively running
      if (!collectionActiveRef.current) {
        setTruckStates(prev => {
          return AMC_FLEET.map((fleetMeta, idx) => {
            const matchingRoute = fetchedRoutes[idx] || null;
            const stops = matchingRoute ? matchingRoute.stops : [];
            const existing = prev[idx] || {};

            return {
              routeIdx: idx,
              vehicleName: fleetMeta.vehicleName,
              plateNumber: fleetMeta.plateNumber,
              model: fleetMeta.model,
              capacityLiters: fleetMeta.capacityLiters,
              fuelType: fleetMeta.fuelType,
              driver: fleetMeta.driver,
              zone: fleetMeta.zone,
              color: fleetMeta.color,
              position: matchingRoute?.depot
                ? { lat: matchingRoute.depot.lat, lng: matchingRoute.depot.lng }
                : (existing.position || { lat: fleetMeta.depotCoords[0], lng: fleetMeta.depotCoords[1] }),
              currentStopIdx: -1,
              totalStops: stops.length || 10,
              wasteCollected: 0,
              stopsCompleted: [],
              stops: stops.length > 0 ? stops : (existing.stops || []),
              done: false,
              astarMetrics: matchingRoute?.astarMetrics || existing.astarMetrics || { totalDistance: matchingRoute?.total_distance_km || 13.5, nodesExplored: 10 },
              speed: '0 km/h (Standby)',
              status: 'Ready at Depot Hub',
            };
          });
        });
      }
      return fetchedRoutes;
    } catch (err) {
      console.error('Failed to load fleet routes:', err);
      return [];
    } finally {
      setRouteLoading(false);
    }
  }, []);

  // Fetch initial routes on mount
  useEffect(() => {
    fetchFleetRoutes();
  }, [fetchFleetRoutes]);

  // Start collection
  const startCollection = useCallback(async (customRoutes) => {
    let routesToUse = customRoutes || routes;
    if (!routesToUse || routesToUse.length === 0) {
      routesToUse = await fetchFleetRoutes();
    }
    if (!routesToUse || routesToUse.length === 0) {
      return;
    }

    const activeRoutes = routesToUse.slice(0, 4);
    const optimizedRoutes = activeRoutes.map(route => {
      if (!route.depot || route.stops.length <= 1) {
        return {
          ...route,
          astarMetrics: { algorithm: 'A* (direct)', nodesExplored: 1, totalDistance: route.total_distance_km || 0 },
        };
      }
      const sorted = [...route.stops].sort((a, b) => a.stop_order - b.stop_order);
      const result = aStarOptimizeStops(sorted, route.depot);
      return {
        ...route,
        stops: result.stops.map((s, i) => ({ ...s, stop_order: i })),
        astarMetrics: result,
      };
    });

    const states = optimizedRoutes.map((route, idx) => {
      const fleetMeta = AMC_FLEET[idx] || getFleetVehicleMeta(idx);
      return {
        routeIdx: idx,
        vehicleName: route.vehicle_name || fleetMeta.vehicleName,
        plateNumber: fleetMeta.plateNumber,
        model: fleetMeta.model,
        capacityLiters: fleetMeta.capacityLiters,
        fuelType: fleetMeta.fuelType,
        driver: fleetMeta.driver,
        zone: fleetMeta.zone,
        color: TRUCK_COLORS[idx % TRUCK_COLORS.length],
        position: route.depot
          ? { lat: route.depot.lat, lng: route.depot.lng }
          : { lat: fleetMeta.depotCoords[0], lng: fleetMeta.depotCoords[1] },
        currentStopIdx: -1,
        totalStops: route.stops.length,
        wasteCollected: 0,
        stopsCompleted: [],
        stops: [...route.stops].sort((a, b) => a.stop_order - b.stop_order),
        done: false,
        astarMetrics: route.astarMetrics,
        speed: '28 km/h (Active)',
        status: 'En Route',
      };
    });

    truckStatesRef.current = states;
    setTruckStates(states);
    setCollectionActive(true);
    setCollectionComplete(false);
    setTotalWasteCollected(0);
  }, [routes, fetchFleetRoutes]);

  // Reset fleet collection
  const resetFleet = useCallback(() => {
    if (collectionIntervalRef.current) {
      clearInterval(collectionIntervalRef.current);
      collectionIntervalRef.current = null;
    }
    setCollectionActive(false);
    setCollectionComplete(false);
    setTotalWasteCollected(0);

    setTruckStates(prev => {
      return AMC_FLEET.map((fleetMeta, idx) => {
        const matchingRoute = routes[idx] || null;
        const stops = matchingRoute ? matchingRoute.stops : [];
        return {
          routeIdx: idx,
          vehicleName: fleetMeta.vehicleName,
          plateNumber: fleetMeta.plateNumber,
          model: fleetMeta.model,
          capacityLiters: fleetMeta.capacityLiters,
          fuelType: fleetMeta.fuelType,
          driver: fleetMeta.driver,
          zone: fleetMeta.zone,
          color: fleetMeta.color,
          position: matchingRoute?.depot
            ? { lat: matchingRoute.depot.lat, lng: matchingRoute.depot.lng }
            : { lat: fleetMeta.depotCoords[0], lng: fleetMeta.depotCoords[1] },
          currentStopIdx: -1,
          totalStops: stops.length || 10,
          wasteCollected: 0,
          stopsCompleted: [],
          stops: stops,
          done: false,
          astarMetrics: matchingRoute?.astarMetrics || { totalDistance: matchingRoute?.total_distance_km || 13.5, nodesExplored: 10 },
          speed: '0 km/h (Standby)',
          status: 'Ready at Depot Hub',
        };
      });
    });
  }, [routes]);

  // Global collection advancement interval (survives page navigation)
  useEffect(() => {
    if (!collectionActive || collectionComplete) return;

    const initialDelay = setTimeout(() => {
      const interval = setInterval(() => {
        const current = truckStatesRef.current;
        if (!current.length) return;

        const binsToReset = [];

        const updated = current.map(truck => {
          if (truck.done) return truck;
          const nextIdx = truck.currentStopIdx + 1;

          if (nextIdx >= truck.stops.length) {
            return {
              ...truck,
              done: true,
              speed: '0 km/h (Docked)',
              status: 'Completed Route — Returned to Depot',
            };
          }

          const stop = truck.stops[nextIdx];
          const waste = Math.round(((stop.fill_percent || 70) / 100) * 240);
          binsToReset.push(stop.bin_name);
          const currentSpeed = 22 + Math.floor(Math.random() * 14);

          return {
            ...truck,
            currentStopIdx: nextIdx,
            position: { lat: stop.lat, lng: stop.lng },
            speed: `${currentSpeed} km/h (Navigating)`,
            status: `Servicing Stop #${nextIdx + 1} (${stop.bin_name})`,
            wasteCollected: truck.wasteCollected + waste,
            stopsCompleted: [
              ...truck.stopsCompleted,
              {
                binName: stop.bin_name,
                wasteCollected: waste,
                vehicleName: truck.vehicleName,
                fillPercent: stop.fill_percent || 70,
              },
            ],
          };
        });

        truckStatesRef.current = updated;
        setTruckStates([...updated]);

        // Empty collected bins down to residual 5%
        if (binsToReset.length > 0) {
          window.dispatchEvent(
            new CustomEvent('amc:bins-emptied', {
              detail: { binNames: binsToReset },
            })
          );
          api.post('/simulation/empty-bins', { bin_names: binsToReset }).catch(err => {
            console.warn('Backend empty-bins sync failed', err);
          });
        }

        const total = updated.reduce((sum, t) => sum + t.wasteCollected, 0);
        setTotalWasteCollected(total);

        if (updated.every(t => t.done)) {
          clearInterval(interval);
          collectionIntervalRef.current = null;
          setTimeout(() => {
            setCollectionComplete(true);
            setCollectionActive(false);
            window.dispatchEvent(
              new CustomEvent('amc:route-complete', {
                detail: {
                  message: `All ${updated.length} AMC trucks completed their collection routes successfully.`,
                },
              })
            );
          }, 800);
        }
      }, 1800);

      collectionIntervalRef.current = interval;
      return () => {
        clearInterval(interval);
        collectionIntervalRef.current = null;
      };
    }, 1000);

    return () => clearTimeout(initialDelay);
  }, [collectionActive, collectionComplete]);

  // Derived metrics
  const activeTrucks = truckStates.filter(t => !t.done).length;
  const totalStopsDone = truckStates.reduce((s, t) => s + t.stopsCompleted.length, 0);
  const totalPlannedStops = truckStates.reduce((s, t) => s + (t.stops?.length || t.totalStops || 0), 0);

  return (
    <FleetContext.Provider
      value={{
        routes,
        setRoutes,
        routeLoading,
        setRouteLoading,
        truckStates,
        setTruckStates,
        collectionActive,
        collectionComplete,
        totalWasteCollected,
        startCollection,
        resetFleet,
        fetchFleetRoutes,
        selectedTruck,
        setSelectedTruck,
        activeTrucks,
        totalStopsDone,
        totalPlannedStops,
      }}
    >
      {children}
    </FleetContext.Provider>
  );
}

export function useFleet() {
  const ctx = useContext(FleetContext);
  if (!ctx) {
    throw new Error('useFleet must be used within a FleetProvider');
  }
  return ctx;
}
