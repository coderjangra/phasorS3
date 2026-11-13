// ============================================================================
// Persistent left sidebar: brand, fleet device switcher, nav items with live
// count badges, and a global action row. Collapsible on desktop; a toggle
// drawer on narrow / phone widths (no horizontal scroll at phone width).
// ============================================================================
import { useState } from 'react';
import {
  Box,
  Drawer,
  Stack,
  Typography,
  Tooltip,
  IconButton,
  Button,
  Divider,
  Badge,
} from '@mui/material';
import {
  Activity,
  LayoutDashboard,
  Wifi,
  Bluetooth,
  Users,
  KeyRound,
  Antenna,
  ScrollText,
  Pause,
  Play,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  FileJson,
  Eraser,
} from 'lucide-react';
import { Sensor, ViewId, ConnStatus, LinkMode } from '../types';
import { AddSensorDialog } from './AddSensorDialog';
import { InfoTip } from './InfoTip';

export interface NavCounts {
  overview: number; // unacked threats
  wifi: number;
  bluetooth: number;
  clients: number;
  captures: number;
  log: number;
}

const NAV: { id: ViewId; label: string; icon: React.ReactNode; badgeKey?: keyof NavCounts; badgeColor?: string }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} />, badgeKey: 'overview', badgeColor: '#d03b3b' },
  { id: 'wifi', label: 'Wi-Fi', icon: <Wifi size={18} />, badgeKey: 'wifi' },
  { id: 'bluetooth', label: 'Bluetooth', icon: <Bluetooth size={18} />, badgeKey: 'bluetooth' },
  { id: 'clients', label: 'Clients & Probes', icon: <Users size={18} />, badgeKey: 'clients' },
  { id: 'captures', label: 'Captures', icon: <KeyRound size={18} />, badgeKey: 'captures' },
  { id: 'attacks', label: 'Attacks / Testing', icon: <Antenna size={18} /> },
  { id: 'log', label: 'Event Log', icon: <ScrollText size={18} />, badgeKey: 'log' },
];

const EXPANDED_W = 264;
const COLLAPSED_W = 76;

interface SidebarProps {
  view: ViewId;
  onView: (v: ViewId) => void;
  counts: NavCounts;
  fwVersion?: string;
  // fleet
  sensors: Sensor[];
  activeId: string;
  status: ConnStatus;
  linkMode: LinkMode;
  onSetActive: (id: string) => void;
  onAddSensor: (name: string, ip: string) => void;
  onUpdateSensor: (id: string, patch: { name?: string; ip?: string }) => void;
  onRemoveSensor: (id: string) => void;
  // global actions
  paused: boolean;
  onTogglePause: () => void;
  onExport: () => void;
  onClear: () => void;
  onHelp: () => void;
  // layout
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function SensorDot({ state }: { state: 'active-online' | 'active-connecting' | 'active-offline' | 'idle' }) {
  const map = {
    'active-online': '#0ca30c',
    'active-connecting': '#fab219',
    'active-offline': '#d03b3b',
    idle: 'rgba(255,255,255,0.3)',
  } as const;
  const c = map[state];
  return (
    <Box
      className={state === 'active-connecting' ? 'phasor-blink' : undefined}
      sx={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: c, boxShadow: state !== 'idle' ? `0 0 7px ${c}` : 'none', flexShrink: 0 }}
    />
  );
}

export function Sidebar(props: SidebarProps) {
  const { collapsed } = props;
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Sensor | null>(null);

  const content = (
    <Box
      sx={{
        width: collapsed ? COLLAPSED_W : EXPANDED_W,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 180ms ease',
        overflow: 'hidden',
      }}
    >
      {/* Brand */}
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ p: 2, pb: 1.5 }}>
        <Activity color="#b39ddb" size={26} />
        {!collapsed && (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ lineHeight: 1, color: 'primary.light' }}>
              Phasor-S3
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 0.4 }}>
              {props.fwVersion ? `fw ${props.fwVersion}` : 'wireless intelligence'}
            </Typography>
          </Box>
        )}
        <Box sx={{ flexGrow: 1 }} />
        {!collapsed && (
          <Tooltip title="Collapse sidebar">
            <IconButton size="small" onClick={props.onToggleCollapse} sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
              <ChevronLeft size={18} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {collapsed && (
        <Box sx={{ px: 1, pb: 1, display: { xs: 'none', md: 'block' } }}>
          <Tooltip title="Expand sidebar" placement="right">
            <IconButton size="small" onClick={props.onToggleCollapse} sx={{ width: '100%' }}>
              <ChevronRight size={18} />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Device switcher */}
      <Box sx={{ px: collapsed ? 0.75 : 1.5 }}>
        {!collapsed && (
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.75, px: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 10 }}>
              Sensors
            </Typography>
            <InfoTip k="fleet.switcher" size={12} />
          </Stack>
        )}
        <Stack spacing={0.5}>
          {props.sensors.map((s) => {
            const isActive = s.id === props.activeId;
            const dot = isActive
              ? props.status === 'connected'
                ? 'active-online'
                : props.status === 'connecting'
                  ? 'active-connecting'
                  : 'active-offline'
              : 'idle';
            if (collapsed) {
              return (
                <Tooltip key={s.id} title={`${s.name} · ${s.ip}`} placement="right">
                  <IconButton size="small" onClick={() => props.onSetActive(s.id)} sx={{ borderRadius: 2, backgroundColor: isActive ? 'rgba(179,157,219,0.14)' : 'transparent' }}>
                    <SensorDot state={dot} />
                  </IconButton>
                </Tooltip>
              );
            }
            return (
              <Box
                key={s.id}
                onClick={() => props.onSetActive(s.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1,
                  py: 0.75,
                  borderRadius: 2,
                  cursor: 'pointer',
                  border: isActive ? '1px solid rgba(179,157,219,0.4)' : '1px solid transparent',
                  backgroundColor: isActive ? 'rgba(179,157,219,0.12)' : 'transparent',
                  '&:hover': { backgroundColor: 'rgba(179,157,219,0.08)', '& .sensor-actions': { opacity: 1 } },
                }}
              >
                <SensorDot state={dot} />
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.name}
                  </Typography>
                  <Typography sx={{ fontSize: 10.5, color: 'text.secondary', fontFamily: 'monospace' }}>{s.ip}</Typography>
                </Box>
                <Stack direction="row" className="sensor-actions" sx={{ opacity: 0, transition: 'opacity 120ms' }}>
                  <Tooltip title="Edit">
                    <IconButton size="small" sx={{ p: 0.3 }} onClick={(e) => { e.stopPropagation(); setEditing(s); }}>
                      <Pencil size={13} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={props.sensors.length <= 1 ? 'Keep at least one sensor' : 'Remove'}>
                    <span>
                      <IconButton
                        size="small"
                        sx={{ p: 0.3 }}
                        disabled={props.sensors.length <= 1}
                        onClick={(e) => { e.stopPropagation(); props.onRemoveSensor(s.id); }}
                      >
                        <Trash2 size={13} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Box>
            );
          })}
        </Stack>
        <Button
          size="small"
          startIcon={collapsed ? undefined : <Plus size={15} />}
          onClick={() => setAddOpen(true)}
          fullWidth
          sx={{ mt: 0.75, justifyContent: collapsed ? 'center' : 'flex-start', color: 'text.secondary', minWidth: 0 }}
        >
          {collapsed ? <Plus size={16} /> : 'Add sensor'}
        </Button>
      </Box>

      <Divider sx={{ my: 1.5, mx: collapsed ? 1 : 2 }} />

      {/* Nav */}
      <Stack spacing={0.4} sx={{ px: collapsed ? 0.75 : 1.5, flexGrow: 1, overflowY: 'auto', minHeight: 0 }}>
        {NAV.map((n) => {
          const active = props.view === n.id;
          const badge = n.badgeKey ? props.counts[n.badgeKey] : 0;
          const btn = (
            <Box
              onClick={() => props.onView(n.id)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: collapsed ? 0 : 1.25,
                py: 1,
                borderRadius: 2,
                cursor: 'pointer',
                justifyContent: collapsed ? 'center' : 'flex-start',
                color: active ? '#f3e5f5' : 'text.secondary',
                backgroundColor: active ? 'rgba(126,87,194,0.28)' : 'transparent',
                borderLeft: active ? '2px solid #b39ddb' : '2px solid transparent',
                '&:hover': { backgroundColor: active ? 'rgba(126,87,194,0.32)' : 'rgba(179,157,219,0.08)' },
              }}
            >
              <Badge
                badgeContent={badge > 0 ? badge : undefined}
                max={999}
                sx={{ '& .MuiBadge-badge': { backgroundColor: n.badgeColor ?? '#7e57c2', color: '#fff', fontWeight: 700, fontSize: 9.5, minWidth: 16, height: 16 } }}
              >
                {n.icon}
              </Badge>
              {!collapsed && (
                <Typography sx={{ fontSize: 13.5, fontWeight: active ? 700 : 500 }}>{n.label}</Typography>
              )}
            </Box>
          );
          return collapsed ? (
            <Tooltip key={n.id} title={n.label} placement="right">
              <Box>{btn}</Box>
            </Tooltip>
          ) : (
            <Box key={n.id}>{btn}</Box>
          );
        })}
      </Stack>

      <Divider sx={{ my: 1, mx: collapsed ? 1 : 2 }} />

      {/* Global actions */}
      <Stack spacing={0.4} sx={{ px: collapsed ? 0.75 : 1.5, pb: 2 }}>
        <ActionRow collapsed={collapsed} icon={props.paused ? <Play size={17} /> : <Pause size={17} />} label={props.paused ? 'Resume ingest' : 'Pause ingest'} onClick={props.onTogglePause} color={props.paused ? '#fab219' : undefined} />
        <ActionRow collapsed={collapsed} icon={<FileJson size={17} />} label="Export session" onClick={props.onExport} />
        <ActionRow collapsed={collapsed} icon={<Eraser size={17} />} label="Clear captures" onClick={props.onClear} />
        <ActionRow collapsed={collapsed} icon={<HelpCircle size={17} />} label="Help & onboarding" onClick={props.onHelp} />
      </Stack>

      <AddSensorDialog open={addOpen} onClose={() => setAddOpen(false)} onSave={props.onAddSensor} title="Add sensor" />
      <AddSensorDialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        initial={editing ? { name: editing.name, ip: editing.ip } : undefined}
        title="Edit sensor"
        onSave={(name, ip) => editing && props.onUpdateSensor(editing.id, { name, ip })}
      />
    </Box>
  );

  return (
    <>
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={props.mobileOpen}
        onClose={props.onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: EXPANDED_W, boxSizing: 'border-box' } }}
      >
        {/* On mobile always expanded */}
        <Box sx={{ height: '100%' }}>{content}</Box>
      </Drawer>

      {/* Desktop permanent */}
      <Box
        component="nav"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: collapsed ? COLLAPSED_W : EXPANDED_W,
          flexShrink: 0,
          transition: 'width 180ms ease',
          borderRight: '1px solid rgba(179,157,219,0.12)',
          backgroundColor: 'rgba(15,10,25,0.5)',
          backdropFilter: 'blur(16px)',
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        {content}
      </Box>
    </>
  );
}

function ActionRow({ collapsed, icon, label, onClick, color }: { collapsed: boolean; icon: React.ReactNode; label: string; onClick: () => void; color?: string }) {
  const btn = (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        px: collapsed ? 0 : 1.25,
        py: 0.85,
        borderRadius: 2,
        cursor: 'pointer',
        justifyContent: collapsed ? 'center' : 'flex-start',
        color: color ?? 'text.secondary',
        '&:hover': { backgroundColor: 'rgba(179,157,219,0.08)', color: color ?? '#f3e5f5' },
      }}
    >
      {icon}
      {!collapsed && <Typography sx={{ fontSize: 13 }}>{label}</Typography>}
    </Box>
  );
  return collapsed ? (
    <Tooltip title={label} placement="right">
      <Box>{btn}</Box>
    </Tooltip>
  ) : (
    btn
  );
}
