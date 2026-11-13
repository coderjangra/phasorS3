// ============================================================================
// Ranked threat cards for the Overview — the rogue-hunting home. Driven by the
// analytics `alerts`, sorted worst-first with alertSort. For alerts whose
// entity is a known AP BSSID, inline Deauth + Force-handshake buttons open a
// prefilled CommandDialog (channel looked up from state.wifi).
// ============================================================================
import { useState } from 'react';
import { Box, Typography, Stack, IconButton, Button, Collapse, Tooltip } from '@mui/material';
import { ShieldCheck, Check, ChevronDown, ChevronRight, Download, Zap, KeyRound } from 'lucide-react';
import { Alert, WifiNetwork } from '../types';
import { alertSort } from '../lib/analytics';
import { SeverityChip } from './common';
import { InfoTip } from './InfoTip';
import { fmtAge } from '../lib/format';
import { commands } from '../api/commands';
import { CommandDialog, CommandDialogConfig } from './CommandDialog';
import { help } from '../lib/help';

function ThreatRow({
  alert,
  now,
  ap,
  onAck,
  onAttack,
}: {
  alert: Alert;
  now: number;
  ap: WifiNetwork | undefined;
  onAck: (id: string) => void;
  onAttack: (cfg: CommandDialogConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const chan = ap?.chan ?? 6;

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: '1px solid rgba(179,157,219,0.12)',
        backgroundColor: alert.acknowledged ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
        opacity: alert.acknowledged ? 0.55 : 1,
        p: 1.25,
        mb: 1,
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <IconButton size="small" sx={{ p: 0.25, mt: 0.1 }} onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </IconButton>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            <SeverityChip severity={alert.severity} />
            <Typography sx={{ fontWeight: 600, fontSize: 13.5 }}>{alert.title}</Typography>
            <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: 11, color: 'text.secondary' }}>
              {alert.entity}
            </Typography>
          </Stack>
          <Typography sx={{ fontSize: 12.5, color: 'rgba(243,229,245,0.75)', mt: 0.25 }}>{alert.detail}</Typography>

          {ap && (
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button
                size="small"
                variant="outlined"
                color="warning"
                startIcon={<Zap size={14} />}
                onClick={() =>
                  onAttack({
                    title: 'Broadcast Deauth',
                    description: `Disconnect clients from ${ap.ssid || ap.bssid}.`,
                    warn: true,
                    risk: help['attack.deauth'],
                    fields: [
                      { name: 'bssid', label: 'AP BSSID', default: ap.bssid },
                      { name: 'chan', label: 'Channel', default: String(chan) },
                      { name: 'n', label: 'Bursts', default: '20' },
                    ],
                    build: (v) => commands.deauthBroadcast(v.bssid || ap.bssid, v.chan || chan, v.n || '20'),
                    confirmLabel: 'Transmit',
                  })
                }
              >
                Deauth
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="warning"
                startIcon={<KeyRound size={14} />}
                onClick={() =>
                  onAttack({
                    title: 'Force Handshake',
                    description: `Deauth + capture the WPA handshake for ${ap.ssid || ap.bssid}.`,
                    warn: true,
                    risk: help['attack.forceHs'],
                    fields: [
                      { name: 'bssid', label: 'AP BSSID', default: ap.bssid },
                      { name: 'chan', label: 'Channel', default: String(chan) },
                      { name: 'sec', label: 'Seconds', default: '15' },
                    ],
                    build: (v) => commands.forceHandshake(v.bssid || ap.bssid, v.chan || chan, v.sec || '15'),
                    confirmLabel: 'Start',
                  })
                }
              >
                Force handshake
              </Button>
            </Stack>
          )}

          <Collapse in={open}>
            <Box sx={{ mt: 0.75, pl: 0.5, borderLeft: '2px solid rgba(179,157,219,0.25)' }}>
              {alert.evidence.map((e, i) => (
                <Typography key={i} sx={{ fontSize: 11.5, fontFamily: 'monospace', color: 'text.secondary', pl: 1 }}>
                  {e}
                </Typography>
              ))}
            </Box>
          </Collapse>
        </Box>
        <Stack alignItems="flex-end" spacing={0.5}>
          <Typography sx={{ fontSize: 10.5, color: 'text.secondary', whiteSpace: 'nowrap' }}>{fmtAge(now - alert.lastSeen)} ago</Typography>
          {!alert.acknowledged && (
            <Tooltip title="Acknowledge">
              <IconButton size="small" sx={{ p: 0.25 }} onClick={() => onAck(alert.id)}>
                <Check size={15} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

export function ThreatCards({
  alerts,
  wifi,
  onAck,
  onAckAll,
  onExport,
  send,
}: {
  alerts: Record<string, Alert>;
  wifi: Record<string, WifiNetwork>;
  onAck: (id: string) => void;
  onAckAll: () => void;
  onExport: () => void;
  send: (cmd: string) => void;
}) {
  const now = Date.now();
  const list = Object.values(alerts).sort(alertSort);
  const unack = list.filter((a) => !a.acknowledged);
  const [dialog, setDialog] = useState<CommandDialogConfig | null>(null);
  const [open, setOpen] = useState(false);

  const launch = (cfg: CommandDialogConfig) => {
    setDialog(cfg);
    setOpen(true);
  };

  return (
    <Box className="glass-panel" sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          Threats
          {unack.length > 0 && (
            <Box component="span" sx={{ fontSize: 12, fontWeight: 800, color: '#d03b3b', backgroundColor: '#d03b3b22', px: 0.9, py: 0.1, borderRadius: 1 }}>
              {unack.length}
            </Box>
          )}
          <InfoTip k="panel.threats" size={14} />
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Export alerts (CSV)">
            <IconButton size="small" onClick={onExport}>
              <Download size={16} />
            </IconButton>
          </Tooltip>
          {unack.length > 0 && (
            <Button size="small" variant="text" onClick={onAckAll}>
              Ack all
            </Button>
          )}
        </Stack>
      </Stack>

      <Box sx={{ flexGrow: 1, overflow: 'auto', minHeight: 0 }}>
        {list.length === 0 ? (
          <Stack alignItems="center" spacing={1} sx={{ py: 6, color: '#0ca30c' }}>
            <ShieldCheck size={38} />
            <Typography sx={{ fontSize: 13.5, color: 'text.secondary' }}>No anomalies detected</Typography>
            <Typography sx={{ fontSize: 11.5, color: 'text.secondary', opacity: 0.7, textAlign: 'center' }}>
              Rogue-AP, evil-twin, deauth &amp; probe analytics are running. Threats will appear here, worst first.
            </Typography>
          </Stack>
        ) : (
          list.map((a) => <ThreatRow key={a.id} alert={a} now={now} ap={wifi[a.entity]} onAck={onAck} onAttack={launch} />)
        )}
      </Box>

      <CommandDialog config={dialog} open={open} onClose={() => setOpen(false)} onSend={send} />
    </Box>
  );
}
