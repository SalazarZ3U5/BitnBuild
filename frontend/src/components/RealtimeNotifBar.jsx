import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, X, Wifi, WifiOff, Bell } from 'lucide-react';

/**
 * RealtimeNotifBar — mounts globally in App.jsx shell.
 * Connects to the backend WebSocket (/ws) and shows ephemeral toasts for:
 *  - Bins crossing 80% fill (critical)
 *  - Bins crossing 60% fill (warning, batched)
 *  - Route completion events (dispatched via customEvent from Dashboard)
 */
export default function RealtimeNotifBar() {
  const [toasts, setToasts] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const prevBinsRef = useRef({});   // { binId: fill_percent }
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const toastIdRef = useRef(0);

  const addToast = useCallback((toast) => {
    const id = ++toastIdRef.current;
    setToasts(prev => {
      // Max 5 toasts visible
      const next = [{ ...toast, id }, ...prev].slice(0, 5);
      return next;
    });
    // Auto-dismiss
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, toast.duration || 6000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const processWsMessage = useCallback((data) => {
    if (data.type !== 'bin_update' || !data.bins) return;

    const prev = prevBinsRef.current;
    const newCritical = [];
    const newWarnings = [];

    data.bins.forEach(bin => {
      const prevFill = prev[bin.id];
      const curFill = bin.current_fill_percent || 0;

      if (prevFill !== undefined) {
        // Just crossed 80% — critical alert
        if (prevFill < 80 && curFill >= 80) {
          newCritical.push(bin);
        }
        // Just crossed 60% — warning
        else if (prevFill < 60 && curFill >= 60 && curFill < 80) {
          newWarnings.push(bin);
        }
      }
      // Update tracking
      prev[bin.id] = curFill;
    });

    // Show individual critical toasts
    newCritical.forEach(bin => {
      addToast({
        type: 'critical',
        title: '🔴 Bin Critical',
        message: `${bin.name} (Zone ${bin.zone}) reached ${Math.round(bin.current_fill_percent)}% capacity`,
        duration: 8000,
      });
    });

    // Batch warnings into one toast
    if (newWarnings.length > 0) {
      const names = newWarnings.map(b => b.name).join(', ');
      addToast({
        type: 'warning',
        title: `🟡 ${newWarnings.length} Bin${newWarnings.length > 1 ? 's' : ''} Filling`,
        message: newWarnings.length === 1
          ? `${newWarnings[0].name} crossed 60% fill in Zone ${newWarnings[0].zone}`
          : `${names} — approaching capacity`,
        duration: 5000,
      });
    }

    // Update ref
    prevBinsRef.current = { ...prev };
  }, [addToast]);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // In docker dev, backend is on port 8000
    const wsHost = host.includes(':5') ? host.replace(/:\d+$/, ':8000') : host;
    const url = `${protocol}//${wsHost}/ws`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        if (reconnectTimer.current) {
          clearTimeout(reconnectTimer.current);
          reconnectTimer.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          processWsMessage(data);
        } catch (e) {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        wsRef.current = null;
        // Reconnect after 5 seconds
        reconnectTimer.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      // WebSocket not available
    }
  }, [processWsMessage]);

  // Listen for route-complete custom events from Dashboard
  useEffect(() => {
    const handler = (e) => {
      addToast({
        type: 'success',
        title: '✅ Route Complete',
        message: e.detail?.message || 'All trucks have completed their collection routes',
        duration: 8000,
      });
    };
    window.addEventListener('amc:route-complete', handler);
    return () => window.removeEventListener('amc:route-complete', handler);
  }, [addToast]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  return (
    <div className="rt-notif-stack" aria-live="polite">
      {/* WS status indicator — subtle, bottom of stack */}
      <div className={`rt-ws-indicator ${wsConnected ? 'connected' : 'disconnected'}`} title={wsConnected ? 'Live telemetry connected' : 'Reconnecting...'}>
        {wsConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
        <span>{wsConnected ? 'Live' : 'Reconnecting'}</span>
      </div>

      {toasts.map(toast => (
        <div key={toast.id} className={`rt-toast rt-toast-${toast.type}`}>
          <div className="rt-toast-icon">
            {toast.type === 'critical' && <AlertTriangle size={15} />}
            {toast.type === 'warning' && <Bell size={15} />}
            {toast.type === 'success' && <CheckCircle2 size={15} />}
          </div>
          <div className="rt-toast-body">
            <div className="rt-toast-title">{toast.title}</div>
            <div className="rt-toast-msg">{toast.message}</div>
          </div>
          <button className="rt-toast-close" onClick={() => dismissToast(toast.id)}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
