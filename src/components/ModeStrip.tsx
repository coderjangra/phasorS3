// ============================================================================
// Persistent top strip in the main pane. Always visible from every view:
//  * the device operating mode (SYSTEM_MODES), styled by mode
//  * a live "sniffing / hopping" indicator while Monitor is active
//  * connection status with a reconnect feel + a liveness ("last event") readout
// ============================================================================
import { useEffect, useState } from 'react';
import { Box, Stack, Typography, Chip, Tooltip } from '@mui/material';
import { Wifi, WifiOff, Radio, FlaskConical, Eye, Pause } from 'lucide-react';
import { ConnStatus, LinkMode, DeviceStatus, SYSTEM_MODES } from '../types';
import { fmtAge } from '../lib/format';
import { InfoTip } from './InfoTip';

interface ModeStyle {
  color: string;
  bg: string;
  label: string;
}

function modeStyle(mode: number | null): ModeStyle {
  const name = mode !== null ? SYSTEM_MODES[mode] ?? `Mode ${mode}` : 'Awaiting status';
  switch (name) {
    case 'Monitor':
    case 'Continuous':
      return { color: '#3987e5', bg: 'rgba(57,135,229,0.14)', label: name };
    case 'Beacon Flood':
    case 'BLE Flood':
      return { color: '#fab219', bg: 'rgba(250,178,25,0.16)', label: name };
    case 'Idle':
      return { color: '#8aa0c0', bg: 'rgba(138,160,192,0.12)', label: name };
    default:
      return { color: '#9a93a8', bg: 'rgba(154,147,168,0.12)', label: name };
  }
}

function HopBars({ color }: { color: string }) {
  return (
    <Stack direction="row" spacing={0.4} alignItems="flex-end" sx={{ height: 14 }}>
      {[0, 1, 2, 3].map((i) => (
        <Box
          key={i}
          sx={{
            width: 3,
            height: 14,
            borderRadius: 0.5,
            backgroundColor: color,
            transformOrigin: 'bottom',
            animation: 'phasor-hop 0.9s ease-in-out infinite',
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </Stack>
  );
}

export function ModeStrip({
  status,
  linkMode,
  deviceStatus,
  paused,
  lastEventAt,
  sensorName,
  ip,
}: {
  status: ConnStatus;
  linkMode: LinkMode;
  deviceStatus: DeviceStatus | null;
  paused: boolean;
  lastEventAt: number | null;
  sensorName: string;
  ip: string;
}) {
  const mode = deviceStatus?.mode ?? null;
  const ms = modeStyle(mode);
  const isMonitor = mode !== null && SYSTEM_MODES[mode] === 'Monitor';

  // Tick so "last event Ns ago" stays fresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const connColor = status === 'connected' ? '#0ca30c' : status === 'connecting' ? '#fab219' : '#d03b3b';
  const connLabel =
    linkMode === 'demo'
      ? 'DEMO'
      : status === 'connected'
        ? 'CONNECTED'
        : status === 'connecting'
          ? 'CONNECTING…'
          : 'OFFLINE · reconnecting';

  const lastEvt = lastEventAt ? `${fmtAge(Date.now() - lastEventAt)} ago` : 'none yet';

  return (
    <Box
      className="glass-panel"
      sx={{
        px: 2,
        py: 1,
        mb: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1.5,
        borderLeft: `3px solid ${ms.color}`,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.25,
            py: 0.5,
            borderRadius: 2,
            backgroundColor: ms.bg,
            border: `1px solid ${ms.color}55`,
          }}
        >
          {isMonitor ? <HopBars color={ms.color} /> : <Radio size={15} color={ms.color} />}
          <Typography sx={{ fontWeight: 800, fontSize: 13, color: ms.color, letterSpacing: 0.3 }}>
            {ms.label}
          </Typography>
          <InfoTip k="mode.strip" size={13} />
        </Box>

        {isMonitor && (
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Eye size={14} color="#3987e5" />
            <Typography sx={{ fontSize: 12, color: '#8aa0c0' }}>
              sniffing — hopping channels
            </Typography>
            <InfoTip k="mode.monitor" size={13} />
          </Stack>
        )}

        {paused && (
          <Chip
            size="small"
            icon={<Pause size={13} />}
            label="INGEST PAUSED"
            sx={{ fontWeight: 700, color: '#fab219', backgroundColor: 'rgba(250,178,25,0.14)', border: '1px solid rgba(250,178,25,0.4)' }}
          />
        )}
      </Stack>

      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Tooltip title={`Last event received: ${lastEvt}`}>
          <Typography sx={{ fontSize: 11.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
            last event {lastEvt}
          </Typography>
        </Tooltip>

        <Tooltip title={linkMode === 'demo' ? 'Synthetic demo feed' : `${sensorName} · ${ip}`}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            {linkMode === 'demo' ? (
              <FlaskConical size={15} color={connColor} />
            ) : status === 'connected' ? (
              <Wifi size={15} color={connColor} />
            ) : (
              <WifiOff size={15} color={connColor} />
            )}
            <Box
              className={status === 'connecting' || (linkMode === 'live' && status === 'offline') ? 'phasor-blink' : undefined}
              sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: connColor, boxShadow: `0 0 8px ${connColor}` }}
            />
            <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: connColor, letterSpacing: 0.3 }}>
              {connLabel}
            </Typography>
          </Box>
        </Tooltip>
        <InfoTip k="link.status" size={13} />
      </Stack>
    </Box>
  );
}
