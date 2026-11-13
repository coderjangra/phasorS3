import { Drawer, Box, Typography, Stack, Chip, Button, IconButton, Divider } from '@mui/material';
import { X, Zap, KeyRound, ShieldAlert } from 'lucide-react';
import { WifiNetwork, Station } from '../types';
import { RssiTimeline } from './charts/RssiSparkline';
import { RogueBadge, Mono } from './common';
import { commands } from '../api/commands';
import { fmtAge } from '../lib/format';

const FLAG_LABEL: Record<string, string> = {
  'evil-twin': 'Evil twin — SSID cloned by another BSSID',
  'auth-downgrade': 'Auth downgrade — same SSID offered open/WEP',
  'multi-channel': 'Beacons on multiple channels (abnormal for one AP)',
  'rssi-unstable': 'Unstable RSSI footprint (spatial inconsistency)',
  'randomized-bssid': 'Randomized / locally-administered MAC',
  karma: 'Karma — answers client probe requests',
};

export function DeviceDrawer({
  network,
  stations,
  onClose,
  onCommand,
}: {
  network: WifiNetwork | null;
  stations: Station[];
  onClose: () => void;
  onCommand: (cmd: string) => void;
}) {
  const now = Date.now();
  const clients = network ? stations.filter((s) => s.ap === network.bssid) : [];

  return (
    <Drawer anchor="right" open={Boolean(network)} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 420 }, p: 0 } }}>
      {network && (
        <Box sx={{ p: 2.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
                {network.ssid || '<hidden network>'}
              </Typography>
              <Mono copy>{network.bssid}</Mono>
            </Box>
            <IconButton size="small" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <RogueBadge score={network.rogueScore} flags={network.flags} />
            <Chip size="small" label={`Ch ${network.channels.join('/') || network.chan}`} />
            <Chip size="small" label={network.auth} />
            <Chip size="small" label={`${network.rssi} dBm`} />
            <Chip size="small" label={`seen ${network.seenCount}×`} />
            <Chip size="small" label={`age ${fmtAge(now - network.firstSeen)}`} />
          </Stack>

          {network.flags.length > 0 && (
            <Box sx={{ mb: 2, p: 1.25, borderRadius: 2, backgroundColor: 'rgba(208,59,59,0.08)', border: '1px solid rgba(208,59,59,0.25)' }}>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75, color: '#ec835a' }}>
                <ShieldAlert size={15} />
                <Typography sx={{ fontWeight: 700, fontSize: 12.5 }}>Why this AP is flagged</Typography>
              </Stack>
              {network.flags.map((f) => (
                <Typography key={f} sx={{ fontSize: 12, color: 'rgba(243,229,245,0.8)', pl: 0.5 }}>
                  • {FLAG_LABEL[f] ?? f}
                </Typography>
              ))}
            </Box>
          )}

          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Signal footprint
          </Typography>
          <Box sx={{ mt: 1, mb: 2 }}>
            <RssiTimeline history={network.rssiHistory} />
          </Box>

          <Divider sx={{ my: 1.5 }} />

          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Associated clients ({clients.length})
          </Typography>
          <Box sx={{ mt: 1, mb: 2, maxHeight: 140, overflow: 'auto' }}>
            {clients.length === 0 ? (
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>No clients mapped yet</Typography>
            ) : (
              clients.map((c) => (
                <Stack key={c.key} direction="row" justifyContent="space-between" sx={{ py: 0.4 }}>
                  <Mono copy>{c.sta}</Mono>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{c.rssi} dBm</Typography>
                </Stack>
              ))
            )}
          </Box>

          <Divider sx={{ my: 1.5 }} />
          <Typography variant="caption" sx={{ color: '#fab219', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Quick actions · authorized testing
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={<Zap size={15} />}
              onClick={() => onCommand(commands.deauthBroadcast(network.bssid, network.chan, 20))}
            >
              Deauth
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={<KeyRound size={15} />}
              onClick={() => onCommand(commands.forceHandshake(network.bssid, network.chan, 15))}
            >
              Force HS
            </Button>
          </Stack>
        </Box>
      )}
    </Drawer>
  );
}
