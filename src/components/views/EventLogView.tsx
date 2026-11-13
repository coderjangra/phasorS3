// ============================================================================
// Full-height Event Log view. Parses each line (logClassify), with category +
// severity filters, text search, pause/resume autoscroll, view-only vs device
// clear, export to .txt, and a legend. Rendered rows are capped for speed.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Tooltip,
  Popover,
  Divider,
} from '@mui/material';
import { Search, ArrowDownToLine, Download, Eraser, Trash2, Info } from 'lucide-react';
import { LogLine, Severity } from '../../types';
import { downloadText, ts } from '../../lib/export';
import { clockTime, SEVERITY_COLOR } from '../../lib/format';
import { ALL_CATEGORIES, CATEGORY_COLOR, LogCategory, classifyLog } from '../../lib/logClassify';
import { LogRow, CategoryChip } from '../LogFeed';
import { ViewHeader } from '../common';
import { InfoTip } from '../InfoTip';

const RENDER_CAP = 500;
const SEVERITIES: Severity[] = ['critical', 'serious', 'warning', 'info', 'good'];

export function EventLogView({ logs, onDeviceClear }: { logs: LogLine[]; onDeviceClear: () => void }) {
  const [q, setQ] = useState('');
  const [cats, setCats] = useState<Set<LogCategory>>(new Set());
  const [sevs, setSevs] = useState<Set<Severity>>(new Set());
  const [autoscroll, setAutoscroll] = useState(true);
  const [viewCutoff, setViewCutoff] = useState(0);
  const [legendEl, setLegendEl] = useState<HTMLElement | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return logs.filter((l) => {
      if (l.t <= viewCutoff) return false;
      if (ql && !l.msg.toLowerCase().includes(ql)) return false;
      if (cats.size || sevs.size) {
        const c = classifyLog(l);
        if (cats.size && !cats.has(c.category)) return false;
        if (sevs.size && !sevs.has(c.severity)) return false;
      }
      return true;
    });
  }, [logs, q, cats, sevs, viewCutoff]);

  const shown = filtered.length > RENDER_CAP ? filtered.slice(-RENDER_CAP) : filtered;

  useEffect(() => {
    if (autoscroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [shown.length, autoscroll]);

  const toggleCat = (c: LogCategory) =>
    setCats((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });
  const toggleSev = (s: Severity) =>
    setSevs((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ViewHeader
        title="Event Log"
        infoKey="view.log"
        subtitle={`${logs.length} lines · parsed & explained`}
        actions={
          <>
            <Tooltip title="Legend">
              <IconButton size="small" onClick={(e) => setLegendEl(e.currentTarget)}>
                <Info size={17} />
              </IconButton>
            </Tooltip>
            <Tooltip title={autoscroll ? 'Autoscroll on' : 'Autoscroll off'}>
              <IconButton size="small" color={autoscroll ? 'primary' : 'default'} onClick={() => setAutoscroll((v) => !v)}>
                <ArrowDownToLine size={17} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export to .txt">
              <IconButton
                size="small"
                onClick={() => downloadText(`phasor-log-${ts()}.txt`, logs.map((l) => `${clockTime(l.t)} ${l.msg}`).join('\n'))}
              >
                <Download size={17} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Clear this view only (device keeps its log)">
              <Button size="small" variant="outlined" startIcon={<Eraser size={14} />} onClick={() => setViewCutoff(Date.now())}>
                Clear view
              </Button>
            </Tooltip>
            <Tooltip title="Tell the device to clear its caches">
              <Button size="small" variant="outlined" color="error" startIcon={<Trash2 size={14} />} onClick={onDeviceClear}>
                Clear device
              </Button>
            </Tooltip>
          </>
        }
      />

      {/* Filters */}
      <Stack spacing={1} sx={{ mb: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
          <TextField
            size="small"
            placeholder="search log…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            sx={{ width: 220 }}
            InputProps={{ startAdornment: (<InputAdornment position="start"><Search size={15} /></InputAdornment>) }}
          />
          <Stack direction="row" spacing={0.5}>
            {SEVERITIES.map((s) => {
              const on = sevs.has(s);
              return (
                <Box
                  key={s}
                  onClick={() => toggleSev(s)}
                  sx={{
                    px: 0.9,
                    py: 0.35,
                    borderRadius: 1,
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    color: SEVERITY_COLOR[s],
                    backgroundColor: on ? `${SEVERITY_COLOR[s]}2e` : 'transparent',
                    border: `1px solid ${SEVERITY_COLOR[s]}${on ? '88' : '33'}`,
                  }}
                >
                  {s}
                </Box>
              );
            })}
          </Stack>
        </Stack>
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          {ALL_CATEGORIES.map((c) => {
            const on = cats.has(c);
            return (
              <Box
                key={c}
                onClick={() => toggleCat(c)}
                sx={{
                  px: 0.75,
                  py: 0.3,
                  borderRadius: 0.75,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 0.4,
                  cursor: 'pointer',
                  color: CATEGORY_COLOR[c],
                  backgroundColor: on ? `${CATEGORY_COLOR[c]}30` : `${CATEGORY_COLOR[c]}10`,
                  border: `1px solid ${CATEGORY_COLOR[c]}${on ? '88' : '33'}`,
                  opacity: on || cats.size === 0 ? 1 : 0.55,
                }}
              >
                {c}
              </Box>
            );
          })}
        </Stack>
      </Stack>

      {/* Log body */}
      <Box
        className="glass-panel"
        sx={{
          flexGrow: 1,
          minHeight: 300,
          height: { md: 'calc(100vh - 330px)' },
          p: 1.5,
          overflowY: 'auto',
          backgroundColor: 'rgba(0,0,0,0.4)',
        }}
      >
        {filtered.length > RENDER_CAP && (
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5, fontStyle: 'italic' }}>
            Showing the last {RENDER_CAP} of {filtered.length} matching lines.
          </Typography>
        )}
        {shown.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', py: 4, textAlign: 'center' }}>
            {logs.length === 0 ? 'Waiting for events…' : 'No lines match the current filters.'}
          </Typography>
        ) : (
          shown.map((l, i) => <LogRow key={`${l.t}-${i}`} line={l} />)
        )}
        <div ref={bottomRef} />
      </Box>

      {/* Legend */}
      <Popover open={Boolean(legendEl)} anchorEl={legendEl} onClose={() => setLegendEl(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Box sx={{ p: 2, maxWidth: 320 }}>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>Legend</Typography>
            <InfoTip text="Colours and chips map log lines to meaning. Click chips above to filter." size={13} />
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>Severity</Typography>
          <Stack spacing={0.5} sx={{ mt: 0.5, mb: 1.5 }}>
            {SEVERITIES.map((s) => (
              <Stack key={s} direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: SEVERITY_COLOR[s] }} />
                <Typography sx={{ fontSize: 12, textTransform: 'capitalize' }}>{s}</Typography>
              </Stack>
            ))}
          </Stack>
          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>Categories</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
            {ALL_CATEGORIES.map((c) => (
              <CategoryChip key={c} category={c} />
            ))}
          </Box>
        </Box>
      </Popover>
    </Box>
  );
}
