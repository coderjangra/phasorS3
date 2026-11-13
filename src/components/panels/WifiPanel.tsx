import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableRow, TextField, InputAdornment, TableSortLabel, Box } from '@mui/material';
import { Search } from 'lucide-react';
import { WifiNetwork } from '../../types';
import { GlassPanel, SignalBars, RogueBadge, Mono, EmptyState } from '../common';
import { MiniSparkline } from '../charts/RssiSparkline';

type SortKey = 'rogueScore' | 'rssi' | 'ssid' | 'chan';

const AUTH_COLOR: Record<string, string> = {
  OPEN: '#d03b3b',
  WEP: '#ec835a',
  WPA: '#fab219',
};

export function WifiPanel({ networks, onSelect }: { networks: WifiNetwork[]; onSelect: (bssid: string) => void }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('rogueScore');
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    const filtered = networks.filter((n) => {
      if (!q) return true;
      const s = q.toLowerCase();
      return n.ssid.toLowerCase().includes(s) || n.bssid.toLowerCase().includes(s);
    });
    const dir = asc ? 1 : -1;
    return filtered.sort((a, b) => {
      if (sort === 'ssid') return dir * a.ssid.localeCompare(b.ssid);
      return dir * ((a[sort] as number) - (b[sort] as number));
    });
  }, [networks, q, sort, asc]);

  const onSort = (key: SortKey) => {
    if (sort === key) setAsc((v) => !v);
    else {
      setSort(key);
      setAsc(false);
    }
  };

  return (
    <GlassPanel
      title="Wi-Fi Networks"
      count={networks.length}
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
            <TableCell sortDirection={sort === 'ssid' ? (asc ? 'asc' : 'desc') : false}>
              <TableSortLabel active={sort === 'ssid'} direction={asc ? 'asc' : 'desc'} onClick={() => onSort('ssid')}>
                SSID
              </TableSortLabel>
            </TableCell>
            <TableCell>BSSID</TableCell>
            <TableCell>
              <TableSortLabel active={sort === 'rssi'} direction={asc ? 'asc' : 'desc'} onClick={() => onSort('rssi')}>
                Signal
              </TableSortLabel>
            </TableCell>
            <TableCell>
              <TableSortLabel active={sort === 'chan'} direction={asc ? 'asc' : 'desc'} onClick={() => onSort('chan')}>
                Ch
              </TableSortLabel>
            </TableCell>
            <TableCell>Auth</TableCell>
            <TableCell>
              <TableSortLabel active={sort === 'rogueScore'} direction={asc ? 'asc' : 'desc'} onClick={() => onSort('rogueScore')}>
                Risk
              </TableSortLabel>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((n) => (
            <TableRow
              key={n.bssid}
              hover
              onClick={() => onSelect(n.bssid)}
              sx={{ cursor: 'pointer', backgroundColor: n.rogueScore >= 60 ? 'rgba(208,59,59,0.08)' : n.rogueScore >= 30 ? 'rgba(250,178,25,0.06)' : undefined }}
            >
              <TableCell sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {n.ssid || <span style={{ opacity: 0.4 }}>&lt;hidden&gt;</span>}
              </TableCell>
              <TableCell>
                <Mono copy>{n.bssid}</Mono>
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <SignalBars rssi={n.rssi} />
                  <MiniSparkline history={n.rssiHistory} />
                </Box>
              </TableCell>
              <TableCell>{n.channels.length > 1 ? n.channels.join('/') : n.chan}</TableCell>
              <TableCell sx={{ color: AUTH_COLOR[n.auth] || 'inherit', fontWeight: AUTH_COLOR[n.auth] ? 700 : 400 }}>{n.auth}</TableCell>
              <TableCell>
                <RogueBadge score={n.rogueScore} flags={n.flags} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length === 0 && <EmptyState label={q ? 'No matches for your filter' : 'No networks yet — run Scan Wi-Fi or Full Sweep'} />}
    </GlassPanel>
  );
}
