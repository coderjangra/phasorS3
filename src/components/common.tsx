import { ReactNode } from 'react';
import { Box, Typography, Tooltip, Stack } from '@mui/material';
import { Severity } from '../types';
import { SEVERITY_COLOR, rssiBars } from '../lib/format';
import { toast } from './Toast';
import { InfoTip } from './InfoTip';

// ---- View header (title + info + actions) ----
export function ViewHeader({
  title,
  infoKey,
  actions,
  subtitle,
}: {
  title: string;
  infoKey?: string;
  actions?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, gap: 1, flexWrap: 'wrap' }}>
      <Box>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {infoKey && <InfoTip k={infoKey} size={16} />}
        </Stack>
        {subtitle && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>{actions}</Stack>}
    </Stack>
  );
}

// ---- Glass panel shell ----
export function GlassPanel({
  title,
  count,
  actions,
  children,
  dense,
  info,
}: {
  title: ReactNode;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
  dense?: boolean;
  info?: ReactNode;
}) {
  return (
    <Box
      className="glass-panel"
      sx={{ p: dense ? 1.5 : 2, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25, gap: 1 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, lineHeight: 1 }}>
          {title}
          {count !== undefined && (
            <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
              {count}
            </Typography>
          )}
          {info}
        </Typography>
        {actions}
      </Stack>
      <Box sx={{ flexGrow: 1, overflow: 'auto', minHeight: 0 }}>{children}</Box>
    </Box>
  );
}

// ---- Signal strength bars ----
export function SignalBars({ rssi }: { rssi?: number }) {
  const bars = rssiBars(rssi);
  const color = bars >= 3 ? '#0ca30c' : bars === 2 ? '#fab219' : '#d03b3b';
  return (
    <Tooltip title={rssi !== undefined ? `${rssi} dBm` : 'no signal'}>
      <Stack direction="row" spacing={0.3} alignItems="flex-end" sx={{ height: 16 }}>
        {[0, 1, 2, 3].map((i) => (
          <Box
            key={i}
            sx={{
              width: 3,
              height: 4 + i * 4,
              borderRadius: 0.5,
              backgroundColor: i < bars ? color : 'rgba(255,255,255,0.14)',
            }}
          />
        ))}
      </Stack>
    </Tooltip>
  );
}

// ---- Severity dot + chip ----
export function SeverityDot({ severity, size = 8 }: { severity: Severity; size?: number }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        backgroundColor: SEVERITY_COLOR[severity],
        boxShadow: `0 0 8px ${SEVERITY_COLOR[severity]}`,
      }}
    />
  );
}

export function SeverityChip({ severity, label }: { severity: Severity; label?: string }) {
  const c = SEVERITY_COLOR[severity];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.75,
        py: 0.2,
        borderRadius: 1,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        color: c,
        backgroundColor: `${c}22`,
        border: `1px solid ${c}55`,
      }}
    >
      {label ?? severity}
    </Box>
  );
}

// ---- Rogue score badge (0..100) ----
export function RogueBadge({ score, flags }: { score: number; flags: string[] }) {
  if (score <= 0) {
    return (
      <Box component="span" sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
        clean
      </Box>
    );
  }
  const color = score >= 60 ? '#d03b3b' : score >= 30 ? '#fab219' : '#ec835a';
  return (
    <Tooltip title={flags.join(', ') || 'anomalies detected'}>
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 0.75,
          py: 0.2,
          borderRadius: 1,
          fontSize: 11,
          fontWeight: 800,
          color,
          backgroundColor: `${color}1f`,
          border: `1px solid ${color}55`,
        }}
      >
        ⚠ {score}
      </Box>
    </Tooltip>
  );
}

export function Mono({ children, copy }: { children: ReactNode; copy?: boolean }) {
  if (!copy) {
    return (
      <Box component="span" sx={{ fontFamily: 'monospace', fontSize: 12.5 }}>
        {children}
      </Box>
    );
  }
  const value = typeof children === 'string' ? children : String(children ?? '');
  const onCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const done = () => toast(`Copied ${value}`, 'success');
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(value).then(done).catch(() => fallbackCopy(value, done));
      } else {
        fallbackCopy(value, done);
      }
    } catch {
      /* ignore */
    }
  };
  return (
    <Tooltip title="Click to copy" enterDelay={400}>
      <Box
        component="span"
        onClick={onCopy}
        sx={{
          fontFamily: 'monospace',
          fontSize: 12.5,
          cursor: 'pointer',
          borderRadius: 0.5,
          px: 0.25,
          transition: 'background-color 120ms',
          '&:hover': { backgroundColor: 'rgba(179,157,219,0.14)' },
        }}
      >
        {children}
      </Box>
    </Tooltip>
  );
}

function fallbackCopy(value: string, done: () => void) {
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    done();
  } catch {
    /* ignore */
  }
}

export function EmptyState({ label }: { label: string }) {
  return (
    <Box sx={{ textAlign: 'center', py: 4, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{label}</Box>
  );
}
