import { Box, Grid, Typography } from '@mui/material';
import { PhasorState, SYSTEM_MODES } from '../types';
import { fmtUptime, fmtBytes } from '../lib/format';
import { Wifi, Bluetooth, Users, KeyRound, ShieldAlert, Activity } from 'lucide-react';
import { ReactNode } from 'react';
import { InfoTip } from './InfoTip';

function Tile({
  icon,
  label,
  value,
  sub,
  accent,
  info,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: string;
  info?: string;
}) {
  return (
    <Box
      className="glass-panel"
      sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column', gap: 0.5, borderLeft: accent ? `3px solid ${accent}` : undefined }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
        {icon}
        <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, fontSize: 10.5 }}>
          {label}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        {info && <InfoTip k={info} size={12} />}
      </Box>
      <Typography sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: accent || '#f3e5f5' }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
          {sub}
        </Typography>
      )}
    </Box>
  );
}

export function StatCards({ state }: { state: PhasorState }) {
  const networks = Object.values(state.wifi);
  const rogue = networks.filter((n) => n.rogueScore > 0).length;
  const alerts = Object.values(state.alerts).filter((a) => !a.acknowledged);
  const critical = alerts.filter((a) => a.severity === 'critical' || a.severity === 'serious').length;
  const hs = Object.values(state.handshakes);
  const complete = hs.filter((h) => h.complete).length;
  const mode = state.status ? SYSTEM_MODES[state.status.mode] ?? `#${state.status.mode}` : '—';

  const tiles = [
    { icon: <Wifi size={15} />, label: 'Networks', value: networks.length, sub: `${rogue} flagged`, accent: rogue ? '#fab219' : undefined, info: 'stat.networks' },
    { icon: <ShieldAlert size={15} />, label: 'Active Threats', value: critical, sub: `${alerts.length} total alerts`, accent: critical ? '#d03b3b' : '#0ca30c', info: 'stat.threats' },
    { icon: <Bluetooth size={15} />, label: 'BLE Devices', value: Object.keys(state.ble).length, info: 'stat.ble' },
    { icon: <Users size={15} />, label: 'Clients Mapped', value: Object.keys(state.stations).length, sub: `${Object.keys(state.probes).length} probing`, info: 'stat.clients' },
    { icon: <KeyRound size={15} />, label: 'Handshakes', value: `${complete}/${hs.length}`, sub: `${state.pmkids.length} PMKIDs`, info: 'stat.handshakes' },
    {
      icon: <Activity size={15} />,
      label: 'Device',
      value: mode,
      sub: state.status ? `up ${fmtUptime(state.status.uptime)} · ${fmtBytes(state.status.heap)} heap` : 'awaiting status',
      info: 'stat.device',
    },
  ];

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {tiles.map((t) => (
        <Grid item xs={6} sm={4} md={2} key={t.label}>
          <Tile {...t} />
        </Grid>
      ))}
    </Grid>
  );
}
