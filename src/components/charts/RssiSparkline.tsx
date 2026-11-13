import { useRef, useState } from 'react';
import { Box } from '@mui/material';
import { RssiSample } from '../../types';

const SERIES = '#3987e5'; // validated dataviz blue (dark)
const MUTED = '#898781';
const GRID = 'rgba(255,255,255,0.08)';

// Fixed RSSI domain keeps sparklines comparable across devices.
const RSSI_MIN = -100;
const RSSI_MAX = -30;

function yOf(rssi: number, h: number, pad: number) {
  const clamped = Math.max(RSSI_MIN, Math.min(RSSI_MAX, rssi));
  const frac = (clamped - RSSI_MIN) / (RSSI_MAX - RSSI_MIN);
  return h - pad - frac * (h - 2 * pad);
}

/** Tiny inline sparkline for table rows — no axes, no interaction. */
export function MiniSparkline({ history, width = 72, height = 20 }: { history: RssiSample[]; width?: number; height?: number }) {
  if (history.length < 2) {
    return <Box sx={{ width, height, opacity: 0.25, fontSize: 10, textAlign: 'center' }}>—</Box>;
  }
  const pad = 2;
  const n = history.length;
  const pts = history
    .map((s, i) => `${pad + (i / (n - 1)) * (width - 2 * pad)},${yOf(s.rssi, height, pad).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={SERIES} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Full RSSI timeline with crosshair + tooltip, used in the device drawer. */
export function RssiTimeline({ history, height = 160 }: { history: RssiSample[]; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ x: number; i: number } | null>(null);
  const VBW = 600; // internal coordinate width; scales to container
  const pad = 28;

  if (history.length < 2) {
    return <Box sx={{ height, display: 'grid', placeItems: 'center', color: MUTED, fontSize: 13 }}>Collecting signal samples…</Box>;
  }

  const n = history.length;
  const xOf = (i: number) => pad + (i / (n - 1)) * (VBW - 2 * pad);
  const pts = history.map((s, i) => `${xOf(i)},${yOf(s.rssi, height, pad).toFixed(1)}`).join(' ');
  const areaPts = `${pad},${height - pad} ${pts} ${VBW - pad},${height - pad}`;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = ref.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const fx = ((e.clientX - rect.left) / rect.width) * VBW;
    const frac = (fx - pad) / (VBW - 2 * pad);
    const i = Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1))));
    setHover({ x: xOf(i), i });
  };

  const gridLevels = [-40, -55, -70, -85, -100];

  return (
    <Box sx={{ position: 'relative' }}>
      <svg
        ref={ref}
        viewBox={`0 0 ${VBW} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id="rssiFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES} stopOpacity={0.28} />
            <stop offset="100%" stopColor={SERIES} stopOpacity={0} />
          </linearGradient>
        </defs>
        {gridLevels.map((lvl) => {
          const y = yOf(lvl, height, pad);
          return (
            <g key={lvl}>
              <line x1={pad} y1={y} x2={VBW - pad} y2={y} stroke={GRID} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <text x={2} y={y + 3} fontSize={9} fill={MUTED} vectorEffect="non-scaling-stroke">
                {lvl}
              </text>
            </g>
          );
        })}
        <polygon points={areaPts} fill="url(#rssiFill)" />
        <polyline points={pts} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hover && (
          <>
            <line x1={hover.x} y1={pad - 6} x2={hover.x} y2={height - pad} stroke={MUTED} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <circle cx={hover.x} cy={yOf(history[hover.i].rssi, height, pad)} r={3.5} fill={SERIES} stroke="#0d0d0d" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      {hover && (
        <Box
          sx={{
            position: 'absolute',
            top: 4,
            left: `${(hover.x / VBW) * 100}%`,
            transform: 'translateX(-50%)',
            px: 1,
            py: 0.4,
            borderRadius: 1,
            fontSize: 11,
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            backgroundColor: 'rgba(10,8,16,0.92)',
            border: '1px solid rgba(179,157,219,0.3)',
          }}
        >
          {history[hover.i].rssi} dBm · {new Date(history[hover.i].t).toLocaleTimeString([], { hour12: false })}
        </Box>
      )}
    </Box>
  );
}
