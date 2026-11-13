import { Table, TableBody, TableCell, TableHead, TableRow, Button, Stack, Box, Tooltip } from '@mui/material';
import { Download } from 'lucide-react';
import { Handshake, Pmkid } from '../../types';
import { GlassPanel, Mono, EmptyState } from '../common';
import { downloadText, handshakesExport, ts } from '../../lib/export';

function MsgDots({ hs }: { hs: Handshake }) {
  const msgs: [string, boolean][] = [
    ['M1', hs.m1],
    ['M2', hs.m2],
    ['M3', hs.m3],
    ['M4', hs.m4],
  ];
  return (
    <Stack direction="row" spacing={0.4}>
      {msgs.map(([m, on]) => (
        <Box
          key={m}
          sx={{
            px: 0.5,
            py: 0.1,
            borderRadius: 0.75,
            fontSize: 9.5,
            fontWeight: 700,
            color: on ? '#0ca30c' : 'rgba(255,255,255,0.25)',
            backgroundColor: on ? 'rgba(12,163,12,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${on ? 'rgba(12,163,12,0.4)' : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          {m}
        </Box>
      ))}
    </Stack>
  );
}

export function HandshakesPanel({ handshakes, pmkids }: { handshakes: Handshake[]; pmkids: Pmkid[] }) {
  const complete = handshakes.filter((h) => h.complete);

  const exportHashlines = () => {
    const txt = handshakesExport(handshakes);
    if (!txt.trim()) return;
    downloadText(`phasor-handshakes-${ts()}.hc22000`, txt);
  };
  const exportPmkids = () => {
    const txt = pmkids.map((p) => `${p.pmkid}*${p.ap.replace(/:/g, '')}*${p.ssid || ''}`).join('\n');
    if (!txt.trim()) return;
    downloadText(`phasor-pmkids-${ts()}.16800`, txt);
  };

  return (
    <GlassPanel
      title="Captured Material"
      count={handshakes.length + pmkids.length}
      actions={
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Export complete handshakes (hashcat format)">
            <span>
              <Button size="small" startIcon={<Download size={14} />} onClick={exportHashlines} disabled={!complete.length} variant="outlined">
                HS
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Export PMKIDs">
            <span>
              <Button size="small" startIcon={<Download size={14} />} onClick={exportPmkids} disabled={!pmkids.length} variant="outlined">
                PMKID
              </Button>
            </span>
          </Tooltip>
        </Stack>
      }
    >
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Type</TableCell>
            <TableCell>AP</TableCell>
            <TableCell>Client</TableCell>
            <TableCell>Progress</TableCell>
            <TableCell>Ch</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {handshakes.map((h) => (
            <TableRow key={h.key} hover sx={{ backgroundColor: h.complete ? 'rgba(12,163,12,0.06)' : undefined }}>
              <TableCell sx={{ fontWeight: 700, color: h.complete ? '#0ca30c' : '#fab219' }}>{h.complete ? 'WPA ✓' : 'WPA'}</TableCell>
              <TableCell>
                <Mono copy>{h.ap}</Mono>
              </TableCell>
              <TableCell>
                <Mono copy>{h.sta}</Mono>
              </TableCell>
              <TableCell>
                <MsgDots hs={h} />
              </TableCell>
              <TableCell>{h.chan}</TableCell>
            </TableRow>
          ))}
          {pmkids.map((p, i) => (
            <TableRow key={`pmk-${i}`} hover>
              <TableCell sx={{ fontWeight: 700, color: '#3987e5' }}>PMKID</TableCell>
              <TableCell>
                <Mono copy>{p.ap}</Mono>
              </TableCell>
              <TableCell colSpan={2} sx={{ fontFamily: 'monospace', fontSize: 11, color: 'text.secondary' }}>
                {p.pmkid || '—'}
              </TableCell>
              <TableCell>{p.chan}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {handshakes.length === 0 && pmkids.length === 0 && <EmptyState label="No handshakes or PMKIDs yet — use Force Handshake or PMKID in Attacks" />}
    </GlassPanel>
  );
}
