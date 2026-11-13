import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Box,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  TextField,
  InputAdornment,
  Tooltip,
  ToggleButton,
} from '@mui/material';
import { MoreVertical, Tag as TagIcon, Wifi, KeyRound, Copy, X, Search, Ban } from 'lucide-react';
import { ProbeDevice, Station } from '../../types';
import { GlassPanel, Mono, SignalBars, EmptyState } from '../common';
import { fmtAge, isLocallyAdministered } from '../../lib/format';
import { toast } from '../Toast';
import {
  DeviceTag,
  TagKind,
  TAG_KINDS,
  TAG_PRESETS,
  getTag,
  setTagKind,
  useTags,
} from '../../lib/tags';
import { ActionResult } from '../ActionButton';
import { DeauthOptionsDialog, DeauthMode, DeauthTarget } from '../DeauthOptionsDialog';

// --- shared helpers ----------------------------------------------------------
function copy(value: string, label: string) {
  const done = () => toast(`Copied ${label}`, 'success');
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(done).catch(() => fallbackCopy(value, done));
    } else {
      fallbackCopy(value, done);
    }
  } catch {
    /* ignore */
  }
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

// A small colored chip for a device's current tag.
function TagChip({ tag }: { tag: DeviceTag }) {
  const label = tag.kind ? TAG_PRESETS[tag.kind].label : 'Tagged';
  return (
    <Tooltip title={tag.note || label}>
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          px: 0.6,
          py: 0.1,
          borderRadius: 1,
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          color: tag.color,
          backgroundColor: `${tag.color}22`,
          border: `1px solid ${tag.color}66`,
        }}
      >
        {label}
      </Box>
    </Tooltip>
  );
}

// Left-border highlight style for a tagged row (applied to the first cell).
function rowTintSx(tag: DeviceTag | null) {
  if (!tag) return {};
  return {
    boxShadow: `inset 3px 0 0 0 ${tag.color}`,
    backgroundColor: `${tag.color}0d`,
  };
}

// A reusable tag set/clear menu triggered by a small icon button.
function TagMenuButton({ mac }: { mac: string }) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const tag = getTag(mac);
  return (
    <>
      <Tooltip title="Tag / untag">
        <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)} sx={{ color: tag ? tag.color : 'rgba(255,255,255,0.4)' }}>
          <TagIcon size={14} />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {TAG_KINDS.map((k: TagKind) => (
          <MenuItem
            key={k}
            selected={tag?.kind === k}
            onClick={() => {
              setTagKind(mac, k);
              setAnchor(null);
            }}
          >
            <ListItemIcon>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: TAG_PRESETS[k].color }} />
            </ListItemIcon>
            <ListItemText>{TAG_PRESETS[k].label}</ListItemText>
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          disabled={!tag}
          onClick={() => {
            setTagKind(mac, null);
            setAnchor(null);
          }}
        >
          <ListItemIcon>
            <X size={14} />
          </ListItemIcon>
          <ListItemText>Clear tag</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

// --- station row action menu -------------------------------------------------
function StationActions({
  station,
  canSend,
  onDeauth,
}: {
  station: Station;
  canSend: boolean;
  onDeauth: (mode: DeauthMode, target: DeauthTarget) => void;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const close = () => setAnchor(null);
  return (
    <>
      <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)}>
        <MoreVertical size={15} />
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={close}>
        <MenuItem
          disabled={!canSend}
          onClick={() => {
            onDeauth('deauth', { ap: station.ap, sta: station.sta, chan: station.chan });
            close();
          }}
        >
          <ListItemIcon>
            <Wifi size={15} color="#d03b3b" />
          </ListItemIcon>
          <ListItemText>Deauth client…</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={!canSend}
          onClick={() => {
            onDeauth('handshake', { ap: station.ap, chan: station.chan });
            close();
          }}
        >
          <ListItemIcon>
            <KeyRound size={15} color="#fab219" />
          </ListItemIcon>
          <ListItemText>Capture handshake…</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            copy(station.sta, 'client MAC');
            close();
          }}
        >
          <ListItemIcon>
            <Copy size={15} />
          </ListItemIcon>
          <ListItemText>Copy client MAC</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            copy(station.ap, 'AP BSSID');
            close();
          }}
        >
          <ListItemIcon>
            <Copy size={15} />
          </ListItemIcon>
          <ListItemText>Copy AP BSSID</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

export function StationsProbesPanel({
  probes,
  stations,
  send,
}: {
  probes: ProbeDevice[];
  stations: Station[];
  send?: (cmd: string) => Promise<ActionResult>;
}) {
  const [tab, setTab] = useState(0);
  const [q, setQ] = useState('');
  const [taggedOnly, setTaggedOnly] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; mode: DeauthMode; target: DeauthTarget | null }>({
    open: false,
    mode: 'deauth',
    target: null,
  });
  const tags = useTags(); // re-render on tag changes
  const now = Date.now();
  const canSend = !!send;

  const openDeauth = (mode: DeauthMode, target: DeauthTarget) => setDialog({ open: true, mode, target });

  const stationList = useMemo(() => [...stations].sort((a, b) => b.lastSeen - a.lastSeen), [stations]);

  const probeList = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...probes]
      .filter((p) => {
        if (taggedOnly && !tags[p.mac.toUpperCase()]) return false;
        if (!s) return true;
        return p.mac.toLowerCase().includes(s) || p.ssids.some((ss) => ss.toLowerCase().includes(s));
      })
      .sort((a, b) => b.lastSeen - a.lastSeen);
  }, [probes, q, taggedOnly, tags]);

  return (
    <GlassPanel
      title={
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          textColor="primary"
          indicatorColor="primary"
          sx={{ minHeight: 0, '& .MuiTab-root': { minHeight: 0, py: 0.5, textTransform: 'none' } }}
        >
          <Tab label={`Probes (${probes.length})`} />
          <Tab label={`Client Map (${stationList.length})`} />
        </Tabs>
      }
      actions={
        tab === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Tooltip title="Show tagged only">
              <ToggleButton
                value="tagged"
                size="small"
                selected={taggedOnly}
                onChange={() => setTaggedOnly((v) => !v)}
                sx={{ px: 0.75, py: 0.25, border: '1px solid rgba(255,255,255,0.12)' }}
              >
                <TagIcon size={14} />
              </ToggleButton>
            </Tooltip>
            <TextField
              size="small"
              placeholder="filter MAC / SSID"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              sx={{ width: 170 }}
              InputProps={{ startAdornment: (<InputAdornment position="start"><Search size={14} /></InputAdornment>) }}
            />
          </Box>
        ) : undefined
      }
    >
      <Table size="small" stickyHeader>
        {tab === 0 ? (
          <>
            <TableHead>
              <TableRow>
                <TableCell>Client MAC</TableCell>
                <TableCell>Probed SSIDs</TableCell>
                <TableCell>Signal</TableCell>
                <TableCell>Seen</TableCell>
                <TableCell align="right">Tag</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {probeList.map((p) => {
                const tag = tags[p.mac.toUpperCase()] ?? null;
                return (
                  <TableRow key={p.mac} hover>
                    <TableCell sx={rowTintSx(tag)}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        <Mono copy>{p.mac}</Mono>
                        {isLocallyAdministered(p.mac) && <Chip size="small" label="rnd" sx={{ height: 15, fontSize: 9 }} />}
                        {tag && <TagChip tag={tag} />}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 160 }}>
                      {p.ssids.length ? (
                        <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                          {p.ssids.slice(0, 4).map((s) => (
                            <Chip key={s} size="small" label={s} sx={{ height: 16, fontSize: 9.5 }} />
                          ))}
                          {p.ssids.length > 4 && <Chip size="small" label={`+${p.ssids.length - 4}`} sx={{ height: 16, fontSize: 9.5 }} />}
                        </Box>
                      ) : (
                        <span style={{ opacity: 0.4 }}>broadcast</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <SignalBars rssi={p.rssi} />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: 11 }}>{fmtAge(now - p.lastSeen)}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <TagMenuButton mac={p.mac} />
                        <Tooltip title="No associated AP — deauth not applicable to a probing client">
                          <span>
                            <IconButton size="small" disabled sx={{ color: 'rgba(255,255,255,0.25)' }}>
                              <Ban size={14} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </>
        ) : (
          <>
            <TableHead>
              <TableRow>
                <TableCell>Client</TableCell>
                <TableCell>→ AP</TableCell>
                <TableCell>Ch</TableCell>
                <TableCell>Signal</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationList.map((s) => {
                const tag = tags[s.sta.toUpperCase()] ?? null;
                return (
                  <TableRow key={s.key} hover>
                    <TableCell sx={rowTintSx(tag)}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        <Mono copy>{s.sta}</Mono>
                        {tag && <TagChip tag={tag} />}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Mono copy>{s.ap}</Mono>
                    </TableCell>
                    <TableCell>{s.chan}</TableCell>
                    <TableCell>
                      <SignalBars rssi={s.rssi} />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <TagMenuButton mac={s.sta} />
                        <StationActions station={s} canSend={canSend} onDeauth={openDeauth} />
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </>
        )}
      </Table>
      {tab === 0 && probeList.length === 0 && (
        <EmptyState label={q || taggedOnly ? 'No probes match your filter' : 'No probe requests yet — enable Monitor mode to harvest them'} />
      )}
      {tab === 1 && stationList.length === 0 && <EmptyState label="No client↔AP associations yet — enable Monitor mode" />}

      <DeauthOptionsDialog
        open={dialog.open}
        mode={dialog.mode}
        target={dialog.target}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        send={send ?? (async () => ({ ok: false, warning: 'No live link' }))}
      />
    </GlassPanel>
  );
}
