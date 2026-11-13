import { useEffect, useRef, useState, useMemo } from 'react';
import { Box, Typography, Button, Stack, TextField, InputAdornment, IconButton, Tooltip } from '@mui/material';
import { Download, Search, ArrowDownToLine } from 'lucide-react';
import { LogLine } from '../../types';
import { downloadText, ts } from '../../lib/export';
import { clockTime, SEVERITY_COLOR } from '../../lib/format';

function lineColor(l: LogLine): string {
  if (l.level && l.level !== 'info') return SEVERITY_COLOR[l.level];
  const m = l.msg;
  if (/\[DEAUTH|\bEAPOL\b.*COMPLETE|CRITICAL|error|fail/i.test(m)) return '#ec835a';
  if (/\[EAPOL|\[PMKID|\[BEACON|\[BLE/i.test(m)) return '#fab219';
  if (/\[PROBE|\[NETMAP|\[AUTH|\[ASSOC/i.test(m)) return '#8aa0c0';
  return '#d1c4e9';
}

export function LogConsole({ logs }: { logs: LogLine[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [autoscroll, setAutoscroll] = useState(true);

  const filtered = useMemo(() => (q ? logs.filter((l) => l.msg.toLowerCase().includes(q.toLowerCase())) : logs), [logs, q]);

  useEffect(() => {
    if (autoscroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filtered, autoscroll]);

  return (
    <Box className="glass-panel" sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1, gap: 1 }}>
        <Typography variant="h6">Event Log</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <TextField
            size="small"
            placeholder="filter"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            sx={{ width: 130 }}
            InputProps={{ startAdornment: (<InputAdornment position="start"><Search size={14} /></InputAdornment>) }}
          />
          <Tooltip title={autoscroll ? 'Autoscroll on' : 'Autoscroll off'}>
            <IconButton size="small" color={autoscroll ? 'primary' : 'default'} onClick={() => setAutoscroll((v) => !v)}>
              <ArrowDownToLine size={16} />
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            startIcon={<Download size={14} />}
            variant="text"
            onClick={() => downloadText(`phasor-log-${ts()}.txt`, logs.map((l) => `${clockTime(l.t)} ${l.msg}`).join('\n'))}
          >
            Save
          </Button>
        </Stack>
      </Stack>
      <Box
        sx={{
          flexGrow: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          borderRadius: '8px',
          p: 1.5,
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: 12.5,
          border: '1px solid rgba(179,157,219,0.1)',
          minHeight: 0,
        }}
      >
        {filtered.length === 0 ? (
          <Typography variant="body2" sx={{ opacity: 0.5 }}>
            {q ? 'no matching lines' : 'Waiting for events…'}
          </Typography>
        ) : (
          filtered.map((l, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, lineHeight: 1.5 }}>
              <Box component="span" sx={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                {clockTime(l.t)}
              </Box>
              <Box component="span" sx={{ color: lineColor(l), wordBreak: 'break-word' }}>
                {l.msg}
              </Box>
            </Box>
          ))
        )}
        <div ref={bottomRef} />
      </Box>
    </Box>
  );
}
