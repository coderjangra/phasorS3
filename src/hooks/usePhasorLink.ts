// ============================================================================
// usePhasorLink — the single data source for the UI.
//  * live mode: WebSocket to ws://<active-sensor-ip>/ws, auto-reconnect, sender
//  * demo mode: synthetic simulator feeding the identical pipeline; commands are
//    simulated (simulateCommand) so testing features are visible with no hardware
// Incoming events are micro-batched (250ms) into the reducer; the analytics
// engine runs on a slower cadence (1.5s). State is persisted per active sensor
// to localStorage and rehydrated on mount / sensor switch.
// ============================================================================
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PhasorState, initialState, ConnStatus, LinkMode, Sensor } from '../types';
import { applyBatch, DecodedEvent } from '../lib/store';
import { decode } from '../lib/protocol';
import { analyze } from '../lib/analytics';
import { createSimulator, simulateCommand, SimCommandResult } from '../lib/simulator';
import {
  loadSensors,
  saveSensors,
  loadActiveSensorId,
  saveActiveSensorId,
  syncLegacyIp,
  newSensorId,
} from '../lib/sensors';
import { loadState, saveState, clearState } from '../lib/persist';

const FLUSH_MS = 250;
const ANALYZE_MS = 1500;
const RECONNECT_MS = 3000;
const PERSIST_MS = 2500;
const MAX_BUFFER = 4000;

export interface SendResult extends SimCommandResult {}

export function usePhasorLink() {
  const [sensors, setSensors] = useState<Sensor[]>(() => loadSensors());
  const [activeId, setActiveId] = useState<string>(() => loadActiveSensorId(loadSensors()));
  const [status, setStatus] = useState<ConnStatus>('offline');
  const [linkMode, setLinkMode] = useState<LinkMode>('live');
  const [paused, setPaused] = useState(false);
  const [state, setState] = useState<PhasorState>(() => loadState(loadActiveSensorId(loadSensors())) ?? initialState());

  const activeSensor = useMemo(
    () => sensors.find((s) => s.id === activeId) ?? sensors[0],
    [sensors, activeId],
  );
  const ipAddress = activeSensor?.ip ?? '192.168.4.1';

  const wsRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef<DecodedEvent[]>([]);
  const pausedRef = useRef(paused);
  const wantLiveRef = useRef(true);
  const reconnectTimer = useRef<number | null>(null);
  const stateRef = useRef(state);
  const activeIdRef = useRef(activeId);
  const sensorIdForStamp = useRef(activeId);

  // Demo command/simulation state.
  const simModeRef = useRef(1);
  const beaconLoadedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    activeIdRef.current = activeId;
    sensorIdForStamp.current = activeId;
    saveActiveSensorId(activeId);
    if (activeSensor) syncLegacyIp(activeSensor.ip);
  }, [activeId, activeSensor]);

  const pushEvents = useCallback((events: DecodedEvent[]) => {
    if (pausedRef.current) return;
    const buf = bufferRef.current;
    for (const e of events) buf.push(e);
    if (buf.length > MAX_BUFFER) buf.splice(0, buf.length - MAX_BUFFER);
  }, []);

  // --- Rehydrate persisted snapshot on mount and whenever the active sensor changes ---
  useEffect(() => {
    bufferRef.current = [];
    setState(loadState(activeId) ?? initialState());
  }, [activeId]);

  // --- Flush buffered events into state on a fixed cadence ---
  useEffect(() => {
    const id = window.setInterval(() => {
      const buf = bufferRef.current;
      if (!buf.length) return;
      const drained = buf.splice(0, buf.length);
      setState((prev) => applyBatch(prev, drained, sensorIdForStamp.current));
    }, FLUSH_MS);
    return () => clearInterval(id);
  }, []);

  // --- Run analytics on a slower cadence ---
  useEffect(() => {
    const id = window.setInterval(() => {
      setState((prev) => {
        if (!Object.keys(prev.wifi).length && !prev.deauths.length && !Object.keys(prev.probes).length) {
          return prev;
        }
        const { alerts, wifi } = analyze(prev);
        return { ...prev, alerts, wifi };
      });
    }, ANALYZE_MS);
    return () => clearInterval(id);
  }, []);

  // --- Persist the snapshot on a debounce + on tab hide / unload ---
  useEffect(() => {
    const id = window.setInterval(() => {
      saveState(activeIdRef.current, stateRef.current);
    }, PERSIST_MS);
    const flush = () => saveState(activeIdRef.current, stateRef.current);
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', flush);
    return () => {
      clearInterval(id);
      window.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, []);

  // --- Live WebSocket connection (only when linkMode === 'live') ---
  useEffect(() => {
    if (linkMode !== 'live') return;
    wantLiveRef.current = true;

    const connect = () => {
      if (!ipAddress) return;
      setStatus('connecting');
      try {
        const ws = new WebSocket(`ws://${ipAddress}/ws`);
        wsRef.current = ws;
        ws.onopen = () => setStatus('connected');
        ws.onmessage = (ev) => pushEvents(decode(typeof ev.data === 'string' ? ev.data : ''));
        ws.onclose = () => {
          setStatus('offline');
          if (wantLiveRef.current) {
            reconnectTimer.current = window.setTimeout(connect, RECONNECT_MS);
          }
        };
        ws.onerror = () => ws.close();
      } catch {
        setStatus('offline');
        reconnectTimer.current = window.setTimeout(connect, RECONNECT_MS);
      }
    };

    connect();
    return () => {
      wantLiveRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [linkMode, ipAddress, pushEvents]);

  // --- Demo simulator (only when linkMode === 'demo') ---
  useEffect(() => {
    if (linkMode !== 'demo') return;
    setStatus('connected');
    simModeRef.current = 1;
    const sim = createSimulator((ev) => pushEvents([ev]), () => simModeRef.current);
    sim.start();
    return () => {
      sim.stop();
      setStatus('offline');
    };
  }, [linkMode, pushEvents]);

  // --- Command sender ---
  const send = useCallback(
    async (cmd: string): Promise<SendResult> => {
      if (linkMode === 'demo') {
        return simulateCommand(cmd, (ev) => pushEvents([ev]), {
          getMode: () => simModeRef.current,
          setMode: (m) => {
            simModeRef.current = m;
          },
          beaconLoaded: () => beaconLoadedRef.current,
          setBeaconLoaded: (b) => {
            beaconLoadedRef.current = b;
          },
        });
      }
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(cmd);
          return { ok: true };
        } catch {
          return { ok: false };
        }
      }
      try {
        const res = await fetch(`http://${ipAddress}/cmd?c=${encodeURIComponent(cmd)}`, { method: 'POST' });
        return { ok: res.ok };
      } catch {
        return { ok: false };
      }
    },
    [ipAddress, linkMode, pushEvents],
  );

  const clearCaches = useCallback(() => {
    bufferRef.current = [];
    clearState(activeIdRef.current);
    setState(initialState());
  }, []);

  const ackAlert = useCallback((id: string) => {
    setState((prev) =>
      prev.alerts[id]
        ? { ...prev, alerts: { ...prev.alerts, [id]: { ...prev.alerts[id], acknowledged: true } } }
        : prev,
    );
  }, []);

  const ackAll = useCallback(() => {
    setState((prev) => {
      const alerts = { ...prev.alerts };
      for (const k of Object.keys(alerts)) alerts[k] = { ...alerts[k], acknowledged: true };
      return { ...prev, alerts };
    });
  }, []);

  // --- Sensor / fleet management ---
  const persistSensors = useCallback((next: Sensor[]) => {
    setSensors(next);
    saveSensors(next);
  }, []);

  const addSensor = useCallback(
    (name: string, ip: string): string => {
      const id = newSensorId();
      const sensor: Sensor = { id, name: name.trim() || ip.trim(), ip: ip.trim() };
      setSensors((prev) => {
        const next = [...prev, sensor];
        saveSensors(next);
        return next;
      });
      setActiveId(id);
      return id;
    },
    [],
  );

  const updateSensor = useCallback(
    (id: string, patch: Partial<Pick<Sensor, 'name' | 'ip'>>) => {
      setSensors((prev) => {
        const next = prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
        saveSensors(next);
        return next;
      });
    },
    [],
  );

  const removeSensor = useCallback(
    (id: string) => {
      setSensors((prev) => {
        if (prev.length <= 1) return prev; // never remove the last sensor
        const next = prev.filter((s) => s.id !== id);
        saveSensors(next);
        clearState(id);
        if (activeIdRef.current === id) setActiveId(next[0].id);
        return next;
      });
    },
    [],
  );

  const setActiveSensor = useCallback((id: string) => {
    if (id === activeIdRef.current) return;
    // Persist the outgoing sensor's latest snapshot before we swap state out.
    saveState(activeIdRef.current, stateRef.current);
    setActiveId(id);
  }, []);

  // Back-compat: edit the active sensor's IP.
  const setIpAddress = useCallback(
    (ip: string) => updateSensor(activeIdRef.current, { ip }),
    [updateSensor],
  );

  void persistSensors; // reserved helper

  return {
    // connection
    ipAddress,
    setIpAddress,
    status,
    linkMode,
    setLinkMode,
    paused,
    setPaused,
    state,
    send,
    clearCaches,
    ackAlert,
    ackAll,
    // fleet
    sensors,
    activeId,
    activeSensor,
    addSensor,
    updateSensor,
    removeSensor,
    setActiveSensor,
  };
}

export type PhasorLink = ReturnType<typeof usePhasorLink>;
