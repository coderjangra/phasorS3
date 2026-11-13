import { useState } from 'react';
import { Box, Typography, Stack } from '@mui/material';
import { WifiNetwork } from '../../types';

const SERIES = '#3987e5'; // validated dataviz blue (dark)
const MUTED = '#898781';
const CRITICAL = '#d03b3b';

const CHANNELS = Array.from({ length: 13 }, (_, i) => i + 1);

interface ChannelInfo {
  count: number;
  rogue: number;
  ssids: string[];
}

/**
 * 2.4 GHz channel-occupancy spectrum. Single-hue magnitude bars (AP count per
 * channel); a channel hosting a flagged AP carries a reserved-status red tick +
 * label, so hue never doubles as state.
 */
export function ChannelOccupancy({ networks }: { networks: WifiNetwork[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const byChan = new Map<number, ChannelInfo>();
  for (const ch of CHANNELS) byChan.set(ch, { count: 0, rogue: 0, ssids: [] });
  for (const n of networks) {
    for (const ch of n.channels.length ? n.channels : [n.chan]) {
      const info = byChan.get(ch);
      if (!info) continue;
      info.count += 1;
      if (n.rogueScore >= 60) info.rogue += 1;
      if (n.ssid) info.ssids.push(n.ssid);
    }
  }
  const max = Math.max(1, ...[...byChan.values()].map((v) => v.count));
  const H = 120;
  const anyRogue = [...byChan.values()].some((v) => v.rogue > 0);

  return (
    <Box>
      <Stack direction="row" alignItems="flex-end" justifyContent="space-between" sx={{ height: H, gap: 0.75 }}>
        {CHANNELS.map((ch) => {
          const info = byChan.get(ch)!;
          const h = (info.count / max) * (H - 22);
          const isHover = hover === ch;
          return (
            <Box
              key={ch}
              onMouseEnter={() => setHover(ch)}
              onMouseLeave={() => setHover(null)}
              sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', cursor: 'default', position: 'relative' }}
            >
              {info.count > 0 && (
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: isHover ? '#f0efec' : MUTED, mb: 0.25 }}>
                  {info.count}
                </Typography>
              )}
              <Box
                sx={{
                  width: '78%',
                  height: Math.max(info.count ? 3 : 0, h),
                  borderRadius: '4px 4px 0 0',
                  backgroundColor: SERIES,
                  opacity: isHover ? 1 : 0.82,
                  transition: 'opacity 120ms, height 300ms',
                }}
              />
              {info.rogue > 0 && (
                <Box sx={{ position: 'absolute', bottom: -2, width: '78%', height: 3, backgroundColor: CRITICAL, borderRadius: 1 }} />
              )}
              {isHover && info.count > 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: '100%',
                    mb: 0.5,
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: 11,
                    whiteSpace: 'nowrap',
                    zIndex: 5,
                    pointerEvents: 'none',
                    backgroundColor: 'rgba(10,8,16,0.95)',
                    border: '1px solid rgba(179,157,219,0.3)',
                  }}
                >
                  <b>Ch {ch}</b> · {info.count} AP{info.count !== 1 ? 's' : ''}
                  {info.rogue > 0 && <span style={{ color: CRITICAL }}> · {info.rogue} flagged</span>}
                  <br />
                  <span style={{ color: MUTED }}>{[...new Set(info.ssids)].slice(0, 4).join(', ') || '—'}</span>
                </Box>
              )}
            </Box>
          );
        })}
      </Stack>
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5, borderTop: '1px solid rgba(195,194,183,0.2)', pt: 0.5 }}>
        {CHANNELS.map((ch) => (
          <Typography key={ch} sx={{ flex: 1, textAlign: 'center', fontSize: 10, color: MUTED }}>
            {ch}
          </Typography>
        ))}
      </Stack>
      <Typography sx={{ fontSize: 10.5, color: MUTED, mt: 0.75 }}>
        APs per 2.4 GHz channel{anyRogue && <Box component="span" sx={{ color: CRITICAL, ml: 1 }}>▬ contains flagged AP</Box>}
      </Typography>
    </Box>
  );
}
