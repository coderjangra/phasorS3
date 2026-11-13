import { useMemo } from 'react';
import { Box, Typography, Stack } from '@mui/material';
import { PhasorState } from '../../types';
import { WifiPanel } from '../panels/WifiPanel';
import { ChannelOccupancy } from '../charts/ChannelOccupancy';
import { ViewHeader } from '../common';
import { InfoTip } from '../InfoTip';

export function WifiView({ state, onSelect }: { state: PhasorState; onSelect: (bssid: string) => void }) {
  const networks = useMemo(() => Object.values(state.wifi), [state.wifi]);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ViewHeader title="Wi-Fi" infoKey="view.wifi" subtitle={`${networks.length} access points · click a row for detail & actions`} />
      <Box className="glass-panel" sx={{ p: 2, mb: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
          <Typography variant="h6">2.4 GHz Spectrum</Typography>
          <InfoTip k="panel.spectrum" size={14} />
        </Stack>
        <ChannelOccupancy networks={networks} />
      </Box>
      <Box sx={{ flexGrow: 1, minHeight: 360, height: { md: 'calc(100vh - 430px)' } }}>
        <WifiPanel networks={networks} onSelect={onSelect} />
      </Box>
    </Box>
  );
}
