// Add or edit a fleet sensor (name + IP).
import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack, Typography } from '@mui/material';
import { Radio } from 'lucide-react';

export function AddSensorDialog({
  open,
  onClose,
  onSave,
  initial,
  title = 'Add sensor',
}: {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, ip: string) => void;
  initial?: { name: string; ip: string };
  title?: string;
}) {
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setIp(initial?.ip ?? '');
    }
  }, [open, initial]);

  const ready = ip.trim().length > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Radio size={18} color="#b39ddb" />
        {title}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          A sensor is one Phasor-S3 appliance. Stored in your browser.
        </Typography>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            size="small"
            label="Name"
            placeholder="Lab roof"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoFocus
          />
          <TextField
            size="small"
            label="IP address"
            placeholder="192.168.4.1"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && ready) {
                onSave(name.trim(), ip.trim());
                onClose();
              }
            }}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!ready}
          onClick={() => {
            onSave(name.trim(), ip.trim());
            onClose();
          }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
