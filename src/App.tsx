import { useState, useMemo, useCallback, useEffect } from 'react';
import { Box, IconButton, Typography, Stack, ToggleButton, ToggleButtonGroup, TextField } from '@mui/material';
import { Menu, Activity, Radio, FlaskConical } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePhasorLink, PhasorLink } from './hooks/usePhasorLink';
import { InfoTip } from './components/InfoTip';
import { useToast } from './components/Toast';
import { Sidebar, NavCounts } from './components/Sidebar';
import { ModeStrip } from './components/ModeStrip';
import { DeviceDrawer } from './components/DeviceDrawer';
import { HelpDialog, helpWasSeen } from './components/HelpDialog';
import { OverviewView } from './components/views/OverviewView';
import { WifiView } from './components/views/WifiView';
import { BluetoothView } from './components/views/BluetoothView';
import { ClientsView } from './components/views/ClientsView';
import { CapturesView } from './components/views/CapturesView';
import { AttacksView } from './components/views/AttacksView';
import { EventLogView } from './components/views/EventLogView';
import { AttackMonitor } from './components/AttackMonitor';
import { ViewId } from './types';
import { commandLabel } from './lib/commandLabel';
import { downloadText, sessionJson, alertsCsv, ts } from './lib/export';

const VIEW_KEY = 'phasor_view';
const COLLAPSE_KEY = 'phasor_sidebar_collapsed';

function loadView(): ViewId {
  try {
    const v = localStorage.getItem(VIEW_KEY) as ViewId | null;
    if (v && ['overview', 'wifi', 'bluetooth', 'clients', 'captures', 'attacks', 'log'].includes(v)) return v;
  } catch {
    /* ignore */
  }
  return 'overview';
}

function App() {
  const link = usePhasorLink();
  const { state } = link;
  const toast = useToast();

  const [view, setView] = useState<ViewId>(loadView);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(() => !helpWasSeen());

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  const onView = useCallback((v: ViewId) => {
    setView(v);
    setMobileOpen(false);
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Every command fires a human-readable toast (success / warning / offline) and
  // resolves to the send result so buttons (ActionButton) can show pending →
  // success/failure feedback for the exact same click.
  const runCommand = useCallback(
    async (cmd: string) => {
      const r = await link.send(cmd);
      if (r.warning) toast(r.warning, 'warning');
      else if (r.ok) toast(`${commandLabel(cmd)} — sent`, 'success');
      else toast('Device offline — command not sent', 'error');
      return r;
    },
    [link, toast],
  );

  const onExportSession = useCallback(() => {
    downloadText(`phasor-session-${ts()}.json`, sessionJson(state), 'application/json');
    toast('Session exported', 'success');
  }, [state, toast]);

  const onExportAlerts = useCallback(() => {
    downloadText(`phasor-alerts-${ts()}.csv`, alertsCsv(Object.values(state.alerts)), 'text/csv');
    toast('Alerts exported', 'success');
  }, [state.alerts, toast]);

  const onClearCaptures = useCallback(() => {
    link.clearCaches();
    toast('Captures cleared for this sensor', 'info');
  }, [link, toast]);

  const counts: NavCounts = useMemo(
    () => ({
      overview: Object.values(state.alerts).filter((a) => !a.acknowledged).length,
      wifi: Object.keys(state.wifi).length,
      bluetooth: Object.keys(state.ble).length,
      clients: Object.keys(state.stations).length + Object.keys(state.probes).length,
      captures: Object.keys(state.handshakes).length + state.pmkids.length,
      log: state.logs.length,
    }),
    [state],
  );

  const stations = useMemo(() => Object.values(state.stations), [state.stations]);
  const selectedNet = selected ? state.wifi[selected] ?? null : null;

  const renderView = () => {
    switch (view) {
      case 'overview':
        return (
          <OverviewView
            state={state}
            send={runCommand}
            onAck={link.ackAlert}
            onAckAll={link.ackAll}
            onExportAlerts={onExportAlerts}
            onView={onView}
          />
        );
      case 'wifi':
        return <WifiView state={state} onSelect={setSelected} />;
      case 'bluetooth':
        return <BluetoothView state={state} send={runCommand} />;
      case 'clients':
        return <ClientsView state={state} send={link.send} />;
      case 'captures':
        return <CapturesView state={state} />;
      case 'attacks':
        return <AttacksView send={runCommand} />;
      case 'log':
        return <EventLogView logs={state.logs} onDeviceClear={() => runCommand('C')} />;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="animated-bg" />
      <Box sx={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        <Sidebar
          view={view}
          onView={onView}
          counts={counts}
          fwVersion={state.status?.fwVersion}
          sensors={link.sensors}
          activeId={link.activeId}
          status={link.status}
          linkMode={link.linkMode}
          onSetActive={link.setActiveSensor}
          onAddSensor={link.addSensor}
          onUpdateSensor={link.updateSensor}
          onRemoveSensor={link.removeSensor}
          paused={link.paused}
          onTogglePause={() => link.setPaused(!link.paused)}
          onExport={onExportSession}
          onClear={onClearCaptures}
          onHelp={() => setHelpOpen(true)}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        <Box component="main" sx={{ flexGrow: 1, minWidth: 0, px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 } }}>
          {/* Mobile top bar */}
          <Stack direction="row" alignItems="center" spacing={1} sx={{ display: { xs: 'flex', md: 'none' }, mb: 1.5 }}>
            <IconButton onClick={() => setMobileOpen(true)} sx={{ border: '1px solid rgba(179,157,219,0.2)' }}>
              <Menu size={20} />
            </IconButton>
            <Activity size={20} color="#b39ddb" />
            <Typography variant="h6" sx={{ color: 'primary.light' }}>
              Phasor-S3
            </Typography>
          </Stack>

          <ModeStrip
            status={link.status}
            linkMode={link.linkMode}
            deviceStatus={state.status}
            paused={link.paused}
            lastEventAt={state.lastEventAt}
            sensorName={link.activeSensor?.name ?? 'sensor'}
            ip={link.ipAddress}
          />

          {/* Live/Demo toggle lives in the mode strip area via a small control row */}
          <LinkModeRow link={link} />

          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </Box>
      </Box>

      <DeviceDrawer network={selectedNet} stations={stations} onClose={() => setSelected(null)} onCommand={runCommand} />
      <AttackMonitor state={state} send={runCommand} />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}

// Compact Live/Demo toggle + IP edit row, sits under the mode strip.
function LinkModeRow({ link }: { link: PhasorLink }) {
  const [ip, setIp] = useState(link.ipAddress);
  useEffect(() => setIp(link.ipAddress), [link.ipAddress]);
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5, flexWrap: 'wrap', gap: 1 }}>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={link.linkMode}
        onChange={(_, v) => v && link.setLinkMode(v)}
        sx={{ '& .MuiToggleButton-root': { px: 1.5, py: 0.5, textTransform: 'none', color: 'text.secondary' } }}
      >
        <ToggleButton value="live">
          <Radio size={15} style={{ marginRight: 6 }} /> Live
        </ToggleButton>
        <ToggleButton value="demo">
          <FlaskConical size={15} style={{ marginRight: 6 }} /> Demo
        </ToggleButton>
      </ToggleButtonGroup>
      <InfoTip k="link.mode" size={14} />
      {link.linkMode === 'live' && (
        <TextField
          size="small"
          label="Active sensor IP"
          variant="outlined"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          onBlur={() => ip !== link.ipAddress && link.setIpAddress(ip)}
          onKeyDown={(e) => e.key === 'Enter' && link.setIpAddress(ip)}
          sx={{ width: 180 }}
        />
      )}
    </Stack>
  );
}

export default App;
