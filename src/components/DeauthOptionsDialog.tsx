// ============================================================================
// DeauthOptionsDialog — review/edit options BEFORE transmitting a deauth or
// forcing a WPA handshake capture. Modeled on CommandDialog's structure/visuals.
// The confirm action is an ActionButton so the user sees pending -> success/fail,
// and the dialog closes on a successful send.
//
//  mode 'deauth'    : AP BSSID + Client MAC (blank => broadcast DB) + Channel + Bursts
//  mode 'handshake' : AP BSSID + Channel + Seconds  (commands.forceHandshake)
// ============================================================================
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack, Typography, Box } from '@mui/material';
import { AlertTriangle } from 'lucide-react';
import { commands } from '../api/commands';
import { ActionButton, ActionResult } from './ActionButton';

export type DeauthMode = 'deauth' | 'handshake';

export interface DeauthTarget {
  ap?: string;
  sta?: string;
  chan?: number;
}

export function DeauthOptionsDialog({
  open,
  onClose,
  target,
  mode,
  send,
}: {
  open: boolean;
  onClose: () => void;
  target: DeauthTarget | null;
  mode: DeauthMode;
  send: (cmd: string) => Promise<ActionResult>;
}) {
  const [ap, setAp] = useState('');
  const [sta, setSta] = useState('');
  const [chan, setChan] = useState('');
  const [bursts, setBursts] = useState('20');
  const [seconds, setSeconds] = useState('15');

  useEffect(() => {
    if (open) {
      setAp(target?.ap ?? '');
      setSta(mode === 'deauth' ? target?.sta ?? '' : '');
      setChan(target?.chan !== undefined ? String(target.chan) : '');
      setBursts('20');
      setSeconds('15');
    }
  }, [open, target, mode]);

  const isHandshake = mode === 'handshake';
  const broadcast = mode === 'deauth' && !sta.trim();

  const cmd = useMemo(() => {
    const apv = ap.trim();
    const chv = chan.trim();
    if (isHandshake) {
      return commands.forceHandshake(apv, chv, seconds.trim() || '15');
    }
    if (broadcast) {
      return commands.deauthBroadcast(apv, chv, bursts.trim() || '20');
    }
    return commands.deauthTargeted(apv, sta.trim(), chv);
  }, [ap, sta, chan, bursts, seconds, isHandshake, broadcast]);

  const ready = ap.trim().length > 0 && chan.trim().length > 0;

  const title = isHandshake ? 'Force Handshake Capture' : broadcast ? 'Broadcast Deauth' : 'Targeted Deauth';
  const risk = isHandshake
    ? 'Deauthenticates the client and captures the WPA 4-way handshake on reconnect. Transmits real 802.11 frames.'
    : broadcast
    ? 'Disconnects ALL clients associated with this AP by flooding broadcast deauth frames. Transmits real 802.11 frames.'
    : 'Disconnects this single client from this AP. Transmits real 802.11 deauth frames.';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AlertTriangle size={18} color="#fab219" />
        {title}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {isHandshake
            ? 'Review the target before capturing. Leave nothing to chance — frames go out on confirm.'
            : 'Review and edit the target before transmitting. Clear the Client MAC to broadcast-deauth every client on this AP.'}
        </Typography>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            size="small"
            label="AP BSSID"
            placeholder="AA:BB:CC:DD:EE:FF"
            value={ap}
            onChange={(e) => setAp(e.target.value)}
            fullWidth
          />
          {!isHandshake && (
            <TextField
              size="small"
              label="Client MAC (blank = broadcast)"
              placeholder="all clients on this AP"
              value={sta}
              onChange={(e) => setSta(e.target.value)}
              fullWidth
            />
          )}
          <TextField
            size="small"
            label="Channel"
            value={chan}
            onChange={(e) => setChan(e.target.value)}
            fullWidth
          />
          {isHandshake ? (
            <TextField
              size="small"
              label="Capture window (seconds)"
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
              fullWidth
            />
          ) : (
            <TextField
              size="small"
              label="Bursts"
              value={bursts}
              onChange={(e) => setBursts(e.target.value)}
              fullWidth
            />
          )}
        </Stack>

        <Box sx={{ mt: 2, p: 1.25, borderRadius: 1.5, backgroundColor: 'rgba(250,178,25,0.08)', border: '1px solid rgba(250,178,25,0.3)' }}>
          <Stack direction="row" spacing={0.75} alignItems="flex-start">
            <AlertTriangle size={15} color="#fab219" style={{ marginTop: 2, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 12, color: 'rgba(243,229,245,0.85)', lineHeight: 1.45 }}>{risk}</Typography>
          </Stack>
        </Box>

        <Box sx={{ mt: 2, p: 1, borderRadius: 1, backgroundColor: 'rgba(0,0,0,0.35)', fontFamily: 'monospace', fontSize: 12, color: '#b39ddb', wordBreak: 'break-all' }}>
          &gt; {cmd}
        </Box>
        <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: '#fab219' }}>
          Transmits RF frames. Authorized testing within declared scope only.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <ActionButton
          variant="contained"
          color="warning"
          disabled={!ready}
          successLabel="Sent"
          action={async () => {
            const res = await send(cmd);
            if (res.ok && !res.warning) {
              // close once the frame is acknowledged
              window.setTimeout(onClose, 300);
            }
            return res;
          }}
        >
          {isHandshake ? 'Capture' : 'Transmit'}
        </ActionButton>
      </DialogActions>
    </Dialog>
  );
}
