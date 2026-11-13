// ============================================================================
// AttackMonitor — a floating, glass "Attack Activity Monitor".
//
// Auto-appears (bottom-right, or a full-width bottom sheet on phones) the moment
// an attack or notable RF event goes live, streams a unified feed of what's
// happening, and quietly disappears when activity stops. The user can collapse
// it to a pill at any time, or re-open the pill while something is running.
//
// Pure derivation lives in useAttackActivity(state); this file is presentation.
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import { Box, Stack, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Radio,
  Bluetooth,
  KeyRound,
  ShieldAlert,
  X,
  ChevronUp,
  Activity,
  ScrollText,
} from 'lucide-react';
import type { PhasorState, Severity } from '../types';
import { commands } from '../api/commands';
import { fmtAge, SEVERITY_COLOR } from '../lib/format';
import { useAttackActivity, ActivityIcon, ActivityFeedItem } from '../hooks/useAttackActivity';

const MotionBox = motion(Box);

function elapsed(startedAt: number | null, now: number): string {
  if (!startedAt) return '00:00';
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function FeedIcon({ icon, color }: { icon: ActivityIcon; color: string }) {
  const p = { size: 13, color };
  switch (icon) {
    case 'deauth':
      return <Zap {...p} />;
    case 'beacon':
      return <Radio {...p} />;
    case 'ble':
      return <Bluetooth {...p} />;
    case 'pmkid':
      return <KeyRound {...p} />;
    case 'handshake':
      return <ShieldAlert {...p} />;
    default:
      return <ScrollText {...p} />;
  }
}

function SummaryChip({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <Chip
      size="small"
      icon={<Box sx={{ display: 'inline-flex', ml: 0.5 }}>{icon}</Box>}
      label={label}
      sx={{
        height: 24,
        fontWeight: 700,
        fontSize: 11,
        color,
        backgroundColor: `${color}1f`,
        border: `1px solid ${color}55`,
        '& .MuiChip-label': { px: 0.75 },
      }}
    />
  );
}

function FeedRow({ item, now }: { item: ActivityFeedItem; now: number }) {
  const color = SEVERITY_COLOR[item.severity as Severity] ?? SEVERITY_COLOR.info;
  return (
    <MotionBox
      layout
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        py: 0.5,
        borderBottom: '1px solid rgba(179,157,219,0.06)',
      }}
    >
      <Box sx={{ mt: 0.3, flexShrink: 0 }}>
        <FeedIcon icon={item.icon} color={color} />
      </Box>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography
          component="div"
          sx={{
            fontFamily: 'monospace',
            fontSize: 11.5,
            color: '#d1c4e9',
            wordBreak: 'break-word',
            lineHeight: 1.35,
          }}
        >
          {item.label}
          {item.detail && (
            <Box component="span" sx={{ color: 'rgba(179,157,219,0.65)', ml: 0.75 }}>
              {item.detail}
            </Box>
          )}
        </Typography>
      </Box>
      <Typography
        sx={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.4)',
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
          mt: 0.2,
        }}
      >
        {fmtAge(now - item.t)}
      </Typography>
    </MotionBox>
  );
}

export function AttackMonitor({
  state,
  send,
}: {
  state: PhasorState;
  send: (cmd: string) => void;
}) {
  const act = useAttackActivity(state);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Manual collapse: the user can fold the panel to a pill. Re-expand on a
  // fresh activity window so a new attack is never missed silently.
  const [collapsed, setCollapsed] = useState(false);
  const prevStart = useRef<number | null>(null);
  useEffect(() => {
    if (act.startedAt && act.startedAt !== prevStart.current) {
      setCollapsed(false);
      prevStart.current = act.startedAt;
    }
    if (!act.startedAt) prevStart.current = null;
  }, [act.startedAt]);

  const accent = act.deauthRate > 0 ? '#d03b3b' : '#fab219';

  // Nothing live and not forced open → render nothing (stay out of the way).
  if (!act.active && collapsed) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        zIndex: 1300,
        bottom: { xs: 0, sm: 16 },
        right: { xs: 0, sm: 16 },
        left: { xs: 0, sm: 'auto' },
        width: { xs: '100%', sm: 380 },
        maxWidth: '100vw',
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence mode="wait">
        {!act.active ? null : collapsed ? (
          // ---- Collapsed pill ----
          <MotionBox
            key="pill"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            onClick={() => setCollapsed(false)}
            className="glass-panel"
            sx={{
              pointerEvents: 'auto',
              cursor: 'pointer',
              m: { xs: 1.5, sm: 0 },
              px: 1.5,
              py: 0.75,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              borderRadius: 999,
              float: { xs: 'none', sm: 'right' },
            }}
          >
            <Box
              className="phasor-blink"
              sx={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                backgroundColor: accent,
                boxShadow: `0 0 8px ${accent}`,
              }}
            />
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: accent }}>
              Attack live · {elapsed(act.startedAt, now)}
            </Typography>
            <ChevronUp size={15} color={accent} />
          </MotionBox>
        ) : (
          // ---- Full panel ----
          <MotionBox
            key="panel"
            layout
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="glass-panel"
            sx={{
              pointerEvents: 'auto',
              m: { xs: 0, sm: 0 },
              display: 'flex',
              flexDirection: 'column',
              maxHeight: { xs: '70vh', sm: '66vh' },
              borderTop: { xs: `3px solid ${accent}`, sm: 'none' },
              borderLeft: { xs: 'none', sm: `3px solid ${accent}` },
              borderRadius: { xs: '14px 14px 0 0', sm: 2 },
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{
                px: 1.75,
                py: 1.25,
                borderBottom: '1px solid rgba(179,157,219,0.1)',
                flexShrink: 0,
              }}
            >
              <Box
                className="phasor-blink"
                sx={{
                  width: 11,
                  height: 11,
                  borderRadius: '50%',
                  backgroundColor: accent,
                  boxShadow: `0 0 10px ${accent}`,
                  flexShrink: 0,
                }}
              />
              <Stack spacing={0} sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 13.5, color: accent, lineHeight: 1.2 }}>
                  Attack in progress
                </Typography>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Activity size={11} color="rgba(255,255,255,0.45)" />
                  <Typography
                    sx={{
                      fontSize: 11,
                      color: 'text.secondary',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {elapsed(act.startedAt, now)} elapsed
                  </Typography>
                </Stack>
              </Stack>
              <Tooltip title="Hide monitor">
                <IconButton size="small" onClick={() => setCollapsed(true)} sx={{ color: 'text.secondary' }}>
                  <X size={16} />
                </IconButton>
              </Tooltip>
            </Stack>

            {/* Summary chips */}
            <Box
              sx={{
                px: 1.75,
                py: 1,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.75,
                flexShrink: 0,
              }}
            >
              {act.deauthRate > 0 && (
                <SummaryChip
                  icon={<Zap size={13} color="#d03b3b" />}
                  label={`Deauth ×${act.deauthRate}/5s`}
                  color="#d03b3b"
                />
              )}
              {act.beaconFlood && (
                <SummaryChip icon={<Radio size={13} color="#fab219" />} label="Beacon Flood" color="#fab219" />
              )}
              {act.bleFlood && (
                <SummaryChip
                  icon={<Bluetooth size={13} color="#651fff" />}
                  label="BLE Flood"
                  color="#651fff"
                />
              )}
              {act.handshakeInProgress && (
                <SummaryChip
                  icon={<ShieldAlert size={13} color="#fab219" />}
                  label={act.handshakeInProgress.complete ? 'Handshake ✓' : 'Capturing handshake'}
                  color={act.handshakeInProgress.complete ? '#0ca30c' : '#fab219'}
                />
              )}
              {act.recentPmkid && (
                <SummaryChip icon={<KeyRound size={13} color="#3987e5" />} label="PMKID" color="#3987e5" />
              )}
            </Box>

            {/* Live feed */}
            <Box
              sx={{
                px: 1.75,
                pb: 1,
                flexGrow: 1,
                overflowY: 'auto',
                minHeight: 80,
                backgroundColor: 'rgba(0,0,0,0.25)',
              }}
            >
              {act.feed.length === 0 ? (
                <Typography
                  sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', py: 3, textAlign: 'center' }}
                >
                  Activity detected — waiting for frames…
                </Typography>
              ) : (
                <AnimatePresence initial={false}>
                  {act.feed.map((item) => (
                    <FeedRow key={item.id} item={item} now={now} />
                  ))}
                </AnimatePresence>
              )}
            </Box>

            {/* Actions */}
            {(act.beaconFlood || act.bleFlood) && (
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  px: 1.75,
                  py: 1.25,
                  borderTop: '1px solid rgba(179,157,219,0.1)',
                  flexShrink: 0,
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                {act.beaconFlood && (
                  <Chip
                    size="small"
                    clickable
                    onClick={() => send(commands.beaconStop())}
                    icon={<X size={14} />}
                    label="Stop beacon flood"
                    sx={{
                      fontWeight: 700,
                      color: '#fab219',
                      backgroundColor: 'rgba(250,178,25,0.14)',
                      border: '1px solid rgba(250,178,25,0.45)',
                    }}
                  />
                )}
                {act.bleFlood && (
                  <Chip
                    size="small"
                    clickable
                    onClick={() => send(commands.bleFloodStop())}
                    icon={<X size={14} />}
                    label="Stop BLE flood"
                    sx={{
                      fontWeight: 700,
                      color: '#651fff',
                      backgroundColor: 'rgba(101,31,255,0.16)',
                      border: '1px solid rgba(101,31,255,0.5)',
                    }}
                  />
                )}
              </Stack>
            )}
          </MotionBox>
        )}
      </AnimatePresence>
    </Box>
  );
}
