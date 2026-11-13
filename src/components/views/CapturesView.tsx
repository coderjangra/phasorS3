import { useMemo } from 'react';
import { Box, Grid } from '@mui/material';
import { PhasorState } from '../../types';
import { HandshakesPanel } from '../panels/HandshakesPanel';
import { SensorsPanel } from '../panels/SensorsPanel';
import { ViewHeader } from '../common';

export function CapturesView({ state }: { state: PhasorState }) {
  const handshakes = useMemo(() => Object.values(state.handshakes), [state.handshakes]);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ViewHeader
        title="Captures"
        infoKey="view.captures"
        subtitle={`${handshakes.filter((h) => h.complete).length} complete handshakes · ${state.pmkids.length} PMKIDs`}
      />
      <Grid container spacing={2.5} sx={{ flexGrow: 1 }}>
        <Grid item xs={12} md={8}>
          <Box sx={{ minHeight: 420, height: { md: 'calc(100vh - 200px)' } }}>
            <HandshakesPanel handshakes={handshakes} pmkids={state.pmkids} />
          </Box>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box sx={{ minHeight: 280, height: { md: 'calc(100vh - 200px)' } }}>
            <SensorsPanel sensors={state.sensors} />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
