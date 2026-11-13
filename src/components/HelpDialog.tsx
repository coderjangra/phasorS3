// ============================================================================
// First-run onboarding / help. Explains what Phasor-S3 is, Live vs Demo,
// Monitor mode, and the authorized-testing caveat. Gated behind a localStorage
// "seen" flag; always reachable again from the sidebar Help button.
// ============================================================================
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Stack } from '@mui/material';
import { Activity, FlaskConical, Radio, Eye, ShieldAlert } from 'lucide-react';

const SEEN_KEY = 'phasor_help_seen';

export function helpWasSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true; // if storage is blocked, don't nag
  }
}
export function markHelpSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* ignore */
  }
}

function Row({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box sx={{ mt: 0.25, color: '#b39ddb', flexShrink: 0 }}>{icon}</Box>
      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{title}</Typography>
        <Typography sx={{ fontSize: 12.5, color: 'rgba(243,229,245,0.75)', lineHeight: 1.5 }}>{children}</Typography>
      </Box>
    </Stack>
  );
}

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const close = () => {
    markHelpSeen();
    onClose();
  };
  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Activity size={20} color="#b39ddb" />
        Welcome to Phasor-S3
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 13, color: 'rgba(243,229,245,0.8)', mb: 2, lineHeight: 1.55 }}>
          Phasor-S3 is a wireless-audit appliance. This dashboard shows the Wi-Fi and Bluetooth airspace it
          observes, scores access points for rogue / evil-twin behaviour, and lets you run authorized RF tests.
        </Typography>
        <Stack spacing={1.75}>
          <Row icon={<Radio size={17} />} title="Live mode">
            Connects to a real Phasor-S3 over Wi-Fi (WebSocket). Add your device's IP in the sidebar switcher.
          </Row>
          <Row icon={<FlaskConical size={17} />} title="Demo mode">
            Runs a synthetic airspace — every panel, the detection engine and the testing tools work with no
            hardware. Commands you run are simulated so you can see their effect.
          </Row>
          <Row icon={<Eye size={17} />} title="Monitor mode">
            Promiscuous channel-hopping capture that harvests clients, probes, handshakes and deauth frames. The
            dashboard link may stutter while the radio hops; it auto-reconnects. Use Continuous for steady telemetry.
          </Row>
          <Row icon={<ShieldAlert size={17} />} title="Authorized testing only">
            Deauth, handshake forcing, PMKID and beacon / BLE floods transmit real RF frames. Use them only
            against networks and devices you own or are explicitly permitted to test. You are responsible for
            staying within your legal scope.
          </Row>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={close}>
          Get started
        </Button>
      </DialogActions>
    </Dialog>
  );
}
