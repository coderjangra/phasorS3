import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack, Typography, Box } from '@mui/material';
import { AlertTriangle } from 'lucide-react';
import { ActionButton, ActionResult } from './ActionButton';

export interface CmdField {
  name: string;
  label: string;
  placeholder?: string;
  default?: string;
}

export interface CommandDialogConfig {
  title: string;
  description?: string;
  warn?: boolean;
  /** A clear, specific risk/consequence line shown before confirming. */
  risk?: string;
  fields: CmdField[];
  build: (vals: Record<string, string>) => string;
  confirmLabel?: string;
}

export function CommandDialog({
  config,
  open,
  onClose,
  onSend,
}: {
  config: CommandDialogConfig | null;
  open: boolean;
  onClose: () => void;
  onSend: (cmd: string) => Promise<ActionResult> | void;
}) {
  const [vals, setVals] = useState<Record<string, string>>({});

  useEffect(() => {
    if (config) {
      const init: Record<string, string> = {};
      config.fields.forEach((f) => (init[f.name] = f.default ?? ''));
      setVals(init);
    }
  }, [config]);

  if (!config) return null;
  const cmd = config.build(vals);
  const ready = config.fields.every((f) => vals[f.name]?.trim().length);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {config.warn && <AlertTriangle size={18} color="#fab219" />}
        {config.title}
      </DialogTitle>
      <DialogContent>
        {config.description && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            {config.description}
          </Typography>
        )}
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {config.fields.map((f) => (
            <TextField
              key={f.name}
              size="small"
              label={f.label}
              placeholder={f.placeholder}
              value={vals[f.name] ?? ''}
              onChange={(e) => setVals((v) => ({ ...v, [f.name]: e.target.value }))}
              fullWidth
            />
          ))}
        </Stack>
        {config.risk && (
          <Box sx={{ mt: 2, p: 1.25, borderRadius: 1.5, backgroundColor: 'rgba(250,178,25,0.08)', border: '1px solid rgba(250,178,25,0.3)' }}>
            <Stack direction="row" spacing={0.75} alignItems="flex-start">
              <AlertTriangle size={15} color="#fab219" style={{ marginTop: 2, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12, color: 'rgba(243,229,245,0.85)', lineHeight: 1.45 }}>{config.risk}</Typography>
            </Stack>
          </Box>
        )}
        <Box sx={{ mt: 2, p: 1, borderRadius: 1, backgroundColor: 'rgba(0,0,0,0.35)', fontFamily: 'monospace', fontSize: 12, color: '#b39ddb', wordBreak: 'break-all' }}>
          &gt; {cmd}
        </Box>
        {config.warn && (
          <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: '#fab219' }}>
            Transmits RF frames. Authorized testing within declared scope only.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <ActionButton
          variant="contained"
          color={config.warn ? 'warning' : 'primary'}
          disabled={!ready}
          confirmToast={false}
          successLabel={config.confirmLabel ?? 'Send'}
          action={async () => {
            const r = await onSend(cmd);
            const res: ActionResult = r ?? { ok: true };
            if (res.ok) window.setTimeout(onClose, 450);
            return res;
          }}
        >
          {config.confirmLabel ?? 'Send'}
        </ActionButton>
      </DialogActions>
    </Dialog>
  );
}
