// ============================================================================
// Attacks / Testing view. All active-RF controls, grouped, with clear warnings
// and info tips on every button. The beacon flow is explicit and ordered to
// mirror the firmware (load SSIDs before starting).
// ============================================================================
import { useState } from 'react';
import { Box, Typography, Stack, Button, Grid, TextField, Tooltip, Chip } from '@mui/material';
import { Zap, KeyRound, Antenna, Bluetooth, AlertTriangle, Megaphone, Play, Square, Eraser, Plus } from 'lucide-react';
import { commands } from '../../api/commands';
import { CommandDialog, CommandDialogConfig } from '../CommandDialog';
import { ViewHeader } from '../common';
import { InfoTip } from '../InfoTip';
import { help } from '../../lib/help';

function SectionCard({
  title,
  icon,
  infoKey,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  infoKey?: string;
  children: React.ReactNode;
}) {
  return (
    <Box className="glass-panel" sx={{ p: 2, height: '100%', border: '1px solid rgba(250,178,25,0.22)' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Box sx={{ color: '#fab219', display: 'inline-flex' }}>{icon}</Box>
        <Typography variant="h6" sx={{ fontSize: 15.5 }}>
          {title}
        </Typography>
        {infoKey && <InfoTip k={infoKey} size={14} />}
      </Stack>
      {children}
    </Box>
  );
}

export function AttacksView({ send }: { send: (cmd: string) => void }) {
  const [dialog, setDialog] = useState<CommandDialogConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [beaconLoaded, setBeaconLoaded] = useState(false);
  const [customSsid, setCustomSsid] = useState('');

  const launch = (cfg: CommandDialogConfig) => {
    setDialog(cfg);
    setOpen(true);
  };

  const deauthBroadcast: CommandDialogConfig = {
    title: 'Broadcast Deauth',
    description: 'Disconnect all clients from a target AP (reason 7).',
    warn: true,
    risk: help['attack.deauth'],
    fields: [
      { name: 'bssid', label: 'AP BSSID', placeholder: 'AA:BB:CC:DD:EE:FF' },
      { name: 'chan', label: 'Channel', default: '6' },
      { name: 'n', label: 'Bursts', default: '20' },
    ],
    build: (v) => commands.deauthBroadcast(v.bssid || '', v.chan || '6', v.n || '20'),
    confirmLabel: 'Transmit',
  };

  const deauthTargeted: CommandDialogConfig = {
    title: 'Targeted Deauth',
    description: 'Disconnect one specific client from one AP.',
    warn: true,
    risk: help['attack.deauthTargeted'],
    fields: [
      { name: 'ap', label: 'AP BSSID', placeholder: 'AA:BB:CC:DD:EE:FF' },
      { name: 'sta', label: 'Client MAC', placeholder: '11:22:33:44:55:66' },
      { name: 'chan', label: 'Channel', default: '6' },
    ],
    build: (v) => commands.deauthTargeted(v.ap || '', v.sta || '', v.chan || '6'),
    confirmLabel: 'Transmit',
  };

  const forceHs: CommandDialogConfig = {
    title: 'Force Handshake',
    description: 'Deauth + listen to capture a WPA 4-way handshake.',
    warn: true,
    risk: help['attack.forceHs'],
    fields: [
      { name: 'bssid', label: 'AP BSSID', placeholder: 'AA:BB:CC:DD:EE:FF' },
      { name: 'chan', label: 'Channel', default: '6' },
      { name: 'sec', label: 'Seconds', default: '15' },
    ],
    build: (v) => commands.forceHandshake(v.bssid || '', v.chan || '6', v.sec || '15'),
    confirmLabel: 'Start',
  };

  const pmkid: CommandDialogConfig = {
    title: 'PMKID Capture',
    description: 'Clientless PMKID capture against a WPA2 AP. SSID optional.',
    warn: true,
    risk: help['attack.pmkid'],
    fields: [
      { name: 'bssid', label: 'AP BSSID', placeholder: 'AA:BB:CC:DD:EE:FF' },
      { name: 'ssid', label: 'SSID (optional)' },
      { name: 'chan', label: 'Channel', default: '6' },
    ],
    build: (v) => (v.ssid ? commands.pmkid(v.bssid || '', v.ssid, v.chan || '6') : commands.pmkidNoSsid(v.bssid || '', v.chan || '6')),
    confirmLabel: 'Capture',
  };

  const bleTarget: CommandDialogConfig = {
    title: 'BLE Target Flood',
    description: 'Flood advertisement packets at one BLE address.',
    warn: true,
    risk: help['attack.bleFloodTarget'],
    fields: [
      { name: 'mac', label: 'Target MAC', placeholder: 'AA:BB:CC:DD:EE:FF' },
      { name: 'n', label: 'Bursts', default: '80' },
    ],
    build: (v) => commands.bleFloodTarget(v.mac || '', v.n || '80'),
    confirmLabel: 'Transmit',
  };

  const bleMass: CommandDialogConfig = {
    title: 'BLE Mass Flood',
    description: 'Broadcast many spoofed BLE advertisements.',
    warn: true,
    risk: help['attack.bleMassFlood'],
    fields: [{ name: 'n', label: 'Advertisements', default: '30' }],
    build: (v) => commands.bleMassFlood(v.n || '30'),
    confirmLabel: 'Start',
  };

  const attackBtn = (label: string, helpKey: string, icon: React.ReactNode, cfg: CommandDialogConfig) => (
    <Tooltip title={help[helpKey]} arrow>
      <Button fullWidth variant="outlined" color="warning" startIcon={icon} onClick={() => launch(cfg)}>
        {label}
      </Button>
    </Tooltip>
  );

  return (
    <Box>
      <ViewHeader
        title="Attacks / Testing"
        infoKey="view.attacks"
        subtitle="Active-RF tools — authorized testing only"
      />

      <Box
        sx={{
          mb: 2.5,
          p: 1.5,
          borderRadius: 2,
          backgroundColor: 'rgba(208,59,59,0.08)',
          border: '1px solid rgba(208,59,59,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <AlertTriangle size={18} color="#ec835a" />
        <Typography sx={{ fontSize: 13, color: 'rgba(243,229,245,0.85)' }}>
          These tools transmit real RF frames and will commandeer the radio — the dashboard link may drop until they finish, then auto-reconnect.
          Use only against networks and devices you own or are explicitly authorized to test.
        </Typography>
      </Box>

      <Grid container spacing={2.5}>
        {/* Deauth */}
        <Grid item xs={12} md={6}>
          <SectionCard title="Deauthentication" icon={<Zap size={18} />} infoKey="attack.deauth">
            <Grid container spacing={1.5}>
              <Grid item xs={6}>{attackBtn('Broadcast', 'attack.deauth', <Zap size={15} />, deauthBroadcast)}</Grid>
              <Grid item xs={6}>{attackBtn('Targeted', 'attack.deauthTargeted', <Zap size={15} />, deauthTargeted)}</Grid>
            </Grid>
          </SectionCard>
        </Grid>

        {/* Handshake / PMKID */}
        <Grid item xs={12} md={6}>
          <SectionCard title="Handshake & PMKID Capture" icon={<KeyRound size={18} />} infoKey="attack.forceHs">
            <Grid container spacing={1.5}>
              <Grid item xs={6}>{attackBtn('Force HS', 'attack.forceHs', <KeyRound size={15} />, forceHs)}</Grid>
              <Grid item xs={6}>{attackBtn('PMKID', 'attack.pmkid', <KeyRound size={15} />, pmkid)}</Grid>
            </Grid>
          </SectionCard>
        </Grid>

        {/* Beacon flood — explicit ordered flow */}
        <Grid item xs={12} md={6}>
          <SectionCard title="Beacon Flood" icon={<Megaphone size={18} />} infoKey="beacon.flow">
            <Stack spacing={1.5}>
              <Box>
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                  <Chip size="small" label="1" sx={{ height: 18, fontWeight: 700 }} />
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>Load SSIDs</Typography>
                  <InfoTip k="beacon.load" size={13} />
                </Stack>
                <Button
                  fullWidth
                  size="small"
                  variant="outlined"
                  color="warning"
                  onClick={() => {
                    send(commands.beaconLoadDefaults());
                    setBeaconLoaded(true);
                  }}
                >
                  Beacon Load (5 defaults)
                </Button>
              </Box>

              <Box>
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                  <Chip size="small" label="2" sx={{ height: 18, fontWeight: 700 }} />
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>Add custom SSID (optional)</Typography>
                  <InfoTip k="beacon.add" size={13} />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    placeholder="FakeNet"
                    value={customSsid}
                    onChange={(e) => setCustomSsid(e.target.value)}
                    fullWidth
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Plus size={14} />}
                    disabled={!customSsid.trim()}
                    onClick={() => {
                      send(commands.beaconAdd(customSsid.trim()));
                      setBeaconLoaded(true);
                      setCustomSsid('');
                    }}
                  >
                    Add
                  </Button>
                </Stack>
              </Box>

              <Box>
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
                  <Chip size="small" label="3" sx={{ height: 18, fontWeight: 700 }} />
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>Start / Stop</Typography>
                  <InfoTip k="beacon.start" size={13} />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Tooltip title={beaconLoaded ? help['beacon.start'] : 'Load at least one SSID first — the device refuses to start with an empty list.'}>
                    <span style={{ flex: 1 }}>
                      <Button
                        fullWidth
                        size="small"
                        variant="contained"
                        color="warning"
                        startIcon={<Play size={14} />}
                        disabled={!beaconLoaded}
                        onClick={() => send(commands.beaconStart())}
                      >
                        Start flood
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title={help['beacon.stop']}>
                    <Button size="small" variant="outlined" startIcon={<Square size={13} />} onClick={() => send(commands.beaconStop())}>
                      Stop
                    </Button>
                  </Tooltip>
                  <Tooltip title={help['beacon.clear']}>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<Eraser size={13} />}
                      onClick={() => {
                        send(commands.beaconClear());
                        setBeaconLoaded(false);
                      }}
                    >
                      Clear
                    </Button>
                  </Tooltip>
                </Stack>
                {!beaconLoaded && (
                  <Typography sx={{ fontSize: 11, color: '#fab219', mt: 0.75 }}>
                    No SSIDs loaded yet — run step 1 or 2 before starting.
                  </Typography>
                )}
              </Box>
            </Stack>
          </SectionCard>
        </Grid>

        {/* BLE flood */}
        <Grid item xs={12} md={6}>
          <SectionCard title="BLE Flood" icon={<Bluetooth size={18} />} infoKey="attack.bleMassFlood">
            <Grid container spacing={1.5}>
              <Grid item xs={6}>{attackBtn('Target flood', 'attack.bleFloodTarget', <Bluetooth size={15} />, bleTarget)}</Grid>
              <Grid item xs={6}>{attackBtn('Mass flood', 'attack.bleMassFlood', <Bluetooth size={15} />, bleMass)}</Grid>
              <Grid item xs={12}>
                <Tooltip title={help['attack.bleStop']}>
                  <Button fullWidth variant="outlined" startIcon={<Square size={14} />} onClick={() => send(commands.bleFloodStop())}>
                    Stop BLE flood
                  </Button>
                </Tooltip>
              </Grid>
            </Grid>
          </SectionCard>
        </Grid>

        {/* Device maintenance */}
        <Grid item xs={12}>
          <Box className="glass-panel" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <Antenna size={18} color="#b39ddb" />
              <Typography variant="h6" sx={{ fontSize: 15.5 }}>
                Device
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
              <Tooltip title={help['cmd.clear']}>
                <Button variant="outlined" color="error" startIcon={<Eraser size={15} />} onClick={() => send(commands.clearBuffers())}>
                  Clear device caches
                </Button>
              </Tooltip>
              <Tooltip title={help['cmd.export']}>
                <Button variant="outlined" onClick={() => send(commands.exportHandshakes())}>
                  Export handshakes (device)
                </Button>
              </Tooltip>
            </Stack>
          </Box>
        </Grid>
      </Grid>

      <CommandDialog config={dialog} open={open} onClose={() => setOpen(false)} onSend={send} />
    </Box>
  );
}
