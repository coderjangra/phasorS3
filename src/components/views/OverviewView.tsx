import { useMemo } from 'react';
import { Box, Grid, Typography, Stack } from '@mui/material';
import { PhasorState, ViewId } from '../../types';
import { StatCards } from '../StatCards';
import { ThreatCards } from '../ThreatCards';
import { QuickControls } from '../QuickControls';
import { ChannelOccupancy } from '../charts/ChannelOccupancy';
import { LogDock } from '../LogFeed';
import { ViewHeader } from '../common';
import { InfoTip } from '../InfoTip';

export function OverviewView({
  state,
  send,
  onAck,
  onAckAll,
  onExportAlerts,
  onView,
}: {
  state: PhasorState;
  send: (cmd: string) => void;
  onAck: (id: string) => void;
  onAckAll: () => void;
  onExportAlerts: () => void;
  onView: (v: ViewId) => void;
}) {
  const networks = useMemo(() => Object.values(state.wifi), [state.wifi]);

  return (
    <Box>
      <ViewHeader title="Overview" infoKey="view.overview" subtitle="Rogue-hunting home — ranked threats, live stats and quick recon" />

      <StatCards state={state} />

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={5}>
          <Box sx={{ height: { xs: 420, lg: 520 } }}>
            <ThreatCards
              alerts={state.alerts}
              wifi={state.wifi}
              onAck={onAck}
              onAckAll={onAckAll}
              onExport={onExportAlerts}
              send={send}
            />
          </Box>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Stack spacing={2.5}>
            <Box className="glass-panel" sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
                <Typography variant="h6">2.4 GHz Spectrum</Typography>
                <InfoTip k="panel.spectrum" size={14} />
              </Stack>
              <ChannelOccupancy networks={networks} />
            </Box>

            <QuickControls send={send} deviceMode={state.status?.mode ?? null} />
          </Stack>
        </Grid>

        <Grid item xs={12}>
          <LogDock logs={state.logs} onOpenFull={() => onView('log')} />
        </Grid>
      </Grid>
    </Box>
  );
}
