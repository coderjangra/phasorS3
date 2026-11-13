// Quick recon controls row (Overview). Each button carries an info tooltip.
import { Box, Tooltip, Stack, Typography } from '@mui/material';
import { Radio, Bluetooth, Zap, RefreshCw, Eye, Terminal } from 'lucide-react';
import { commands } from '../api/commands';
import { SYSTEM_MODES } from '../types';
import { InfoTip } from './InfoTip';
import { ActionButton, ActionResult } from './ActionButton';
import { helpText } from '../lib/help';

interface Ctl {
  label: string;
  icon: React.ReactNode;
  cmd: () => string;
  helpKey: string;
  active?: boolean;
  variant?: 'contained' | 'outlined';
}

export function QuickControls({ send, deviceMode }: { send: (cmd: string) => Promise<ActionResult> | void; deviceMode: number | null }) {
  const modeName = deviceMode !== null ? SYSTEM_MODES[deviceMode] : null;
  const ctls: Ctl[] = [
    { label: 'Scan Wi-Fi', icon: <Radio size={16} />, cmd: commands.scanWifi, helpKey: 'cmd.scanWifi', variant: 'contained' },
    { label: 'Scan BLE', icon: <Bluetooth size={16} />, cmd: commands.scanBle, helpKey: 'cmd.scanBle', variant: 'contained' },
    { label: 'Full Sweep', icon: <Zap size={16} />, cmd: commands.fullSweep, helpKey: 'cmd.fullSweep', variant: 'contained' },
    { label: 'Continuous', icon: <RefreshCw size={16} />, cmd: commands.toggleContinuous, helpKey: 'mode.continuous', active: modeName === 'Continuous' },
    { label: 'Monitor', icon: <Eye size={16} />, cmd: commands.toggleMonitor, helpKey: 'mode.monitor', active: modeName === 'Monitor' },
    { label: 'Status', icon: <Terminal size={16} />, cmd: commands.status, helpKey: 'cmd.status' },
  ];

  return (
    <Box className="glass-panel" sx={{ p: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Quick controls
        </Typography>
        <InfoTip text="One-shot recon and mode toggles. Hover any control for what it does." size={13} />
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' }, gap: 1 }}>
        {ctls.map((b) => (
          <Tooltip key={b.label} title={helpText(b.helpKey)} arrow>
            <Box component="span" sx={{ display: 'block', width: '100%' }}>
              <ActionButton
                fullWidth
                size="small"
                variant={b.active ? 'contained' : b.variant ?? 'outlined'}
                color={b.active ? 'secondary' : 'primary'}
                startIcon={b.icon}
                confirmToast={false}
                successLabel="Sent"
                action={() => send(b.cmd())}
                sx={{ justifyContent: 'center' }}
              >
                {b.label}
              </ActionButton>
            </Box>
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
}
