import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableRow, TextField, InputAdornment, Box, Chip } from '@mui/material';
import { Search } from 'lucide-react';
import { BleDevice } from '../../types';
import { GlassPanel, SignalBars, Mono, EmptyState } from '../common';
import { MiniSparkline } from '../charts/RssiSparkline';
import { fmtAge } from '../../lib/format';

export function BlePanel({ devices, scanning }: { devices: BleDevice[]; scanning?: boolean }) {
  const [q, setQ] = useState('');
  const now = Date.now();

  const rows = useMemo(() => {
    const f = devices.filter((d) => {
      if (!q) return true;
      const s = q.toLowerCase();
      return (d.name || '').toLowerCase().includes(s) || d.addr.toLowerCase().includes(s) || (d.company || '').toLowerCase().includes(s);
    });
    return f.sort((a, b) => b.rssi - a.rssi);
  }, [devices, q]);

  return (
    <GlassPanel
      title="BLE Devices"
      count={devices.length}
      actions={
        <TextField
          size="small"
          placeholder="filter"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ width: 140 }}
          InputProps={{ startAdornment: (<InputAdornment position="start"><Search size={14} /></InputAdornment>) }}
        />
      }
    >
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Address</TableCell>
            <TableCell>Signal</TableCell>
            <TableCell>Seen</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((d) => (
            <TableRow key={d.addr} hover>
              <TableCell sx={{ maxWidth: 150 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <span>{d.name || <span style={{ opacity: 0.4 }}>Unknown</span>}</span>
                  {d.company && <Chip size="small" label={d.company} sx={{ height: 16, fontSize: 9.5, mt: 0.25, alignSelf: 'flex-start' }} />}
                </Box>
              </TableCell>
              <TableCell>
                <Mono copy>{d.addr}</Mono>
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <SignalBars rssi={d.rssi} />
                  <MiniSparkline history={d.rssiHistory} />
                </Box>
              </TableCell>
              <TableCell sx={{ color: 'text.secondary', fontSize: 11 }}>{fmtAge(now - d.lastSeen)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length === 0 && (
        <EmptyState
          label={
            q
              ? 'No matches for your filter'
              : scanning
                ? 'Scanning…'
                : 'No devices found. BLE shares the radio with Wi-Fi — if Monitor/Continuous mode is on, stop it and rescan.'
          }
        />
      )}
    </GlassPanel>
  );
}
