import { useMemo } from 'react';
import { Box } from '@mui/material';
import { PhasorState } from '../../types';
import { StationsProbesPanel } from '../panels/StationsProbesPanel';
import { ViewHeader } from '../common';
import { ActionResult } from '../ActionButton';

export function ClientsView({
  state,
  send,
}: {
  state: PhasorState;
  send?: (cmd: string) => Promise<ActionResult>;
}) {
  const probes = useMemo(() => Object.values(state.probes), [state.probes]);
  const stations = useMemo(() => Object.values(state.stations), [state.stations]);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ViewHeader
        title="Clients & Probes"
        infoKey="view.clients"
        subtitle={`${stations.length} associations · ${probes.length} probing clients`}
      />
      <Box sx={{ flexGrow: 1, minHeight: 420, height: { md: 'calc(100vh - 200px)' } }}>
        <StationsProbesPanel probes={probes} stations={stations} send={send} />
      </Box>
    </Box>
  );
}
