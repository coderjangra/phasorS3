// ============================================================================
// Structured, human-readable log rendering. Each raw LogLine is classified
// (src/lib/logClassify.ts) into a severity dot + category chip + the raw text
// + a plain-English explanation. Shared by the Event Log view and the slim
// Overview dock.
// ============================================================================
import { Box, Stack, Typography, Button } from '@mui/material';
import { ScrollText } from 'lucide-react';
import { LogLine } from '../types';
import { clockTime } from '../lib/format';
import { classifyLog, CATEGORY_COLOR, LogCategory } from '../lib/logClassify';
import { SeverityDot } from './common';

export function CategoryChip({ category, dense }: { category: LogCategory; dense?: boolean }) {
  const c = CATEGORY_COLOR[category];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: dense ? 0.5 : 0.75,
        py: 0.1,
        borderRadius: 0.75,
        fontSize: dense ? 9 : 10,
        fontWeight: 800,
        letterSpacing: 0.4,
        color: c,
        backgroundColor: `${c}1f`,
        border: `1px solid ${c}44`,
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {category}
    </Box>
  );
}

export function LogRow({ line, compact }: { line: LogLine; compact?: boolean }) {
  const cls = classifyLog(line);
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        alignItems: 'flex-start',
        py: compact ? 0.25 : 0.5,
        borderBottom: compact ? 'none' : '1px solid rgba(179,157,219,0.06)',
      }}
    >
      <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: compact ? 10.5 : 11.5, color: 'rgba(255,255,255,0.35)', flexShrink: 0, mt: 0.15 }}>
        {clockTime(line.t)}
      </Typography>
      <Box sx={{ mt: compact ? 0.55 : 0.7, flexShrink: 0 }}>
        <SeverityDot severity={cls.severity} size={7} />
      </Box>
      <CategoryChip category={cls.category} dense={compact} />
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: compact ? 11 : 12.5, color: '#d1c4e9', wordBreak: 'break-word' }}>
          {line.msg}
        </Typography>
        {!compact && cls.humanText && (
          <Typography sx={{ fontSize: 11.5, color: 'rgba(179,157,219,0.7)', fontStyle: 'italic', mt: 0.1 }}>
            {cls.humanText}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/** Slim always-visible dock for the Overview (last N lines). */
export function LogDock({ logs, onOpenFull, lines = 6 }: { logs: LogLine[]; onOpenFull: () => void; lines?: number }) {
  const recent = logs.slice(-lines);
  return (
    <Box className="glass-panel" sx={{ p: 1.5, display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <ScrollText size={15} color="#b39ddb" />
          <Typography sx={{ fontWeight: 600, fontSize: 13 }}>Event Log</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{logs.length} lines</Typography>
        </Stack>
        <Button size="small" variant="text" onClick={onOpenFull} sx={{ fontSize: 11.5 }}>
          View full log
        </Button>
      </Stack>
      <Box
        sx={{
          backgroundColor: 'rgba(0,0,0,0.4)',
          borderRadius: 1.5,
          px: 1,
          py: 0.5,
          border: '1px solid rgba(179,157,219,0.08)',
          minHeight: 120,
        }}
      >
        {recent.length === 0 ? (
          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', py: 2, textAlign: 'center' }}>
            Waiting for events…
          </Typography>
        ) : (
          recent.map((l, i) => <LogRow key={`${l.t}-${i}`} line={l} compact />)
        )}
      </Box>
    </Box>
  );
}
