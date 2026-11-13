// ============================================================================
// Tiny custom toast/snackbar system (no extra deps). A module-level emitter
// lets any code — even outside React context — fire a toast via toast(). The
// provider renders a stack of themed MUI Alerts, bottom-right.
// ============================================================================
import { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { Snackbar, Alert, Stack } from '@mui/material';

export type ToastSeverity = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  severity: ToastSeverity;
}

type Listener = (t: ToastItem) => void;
const listeners = new Set<Listener>();
let seq = 1;

/** Fire a toast from anywhere (context not required). */
export function toast(message: string, severity: ToastSeverity = 'info'): void {
  const item: ToastItem = { id: seq++, message, severity };
  listeners.forEach((l) => l(item));
}

const ToastCtx = createContext<(message: string, severity?: ToastSeverity) => void>(() => {});

export function useToast(): (message: string, severity?: ToastSeverity) => void {
  return useContext(ToastCtx);
}

const AUTO_HIDE = 3800;
const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: Listener = (item) => {
      setItems((prev) => [...prev, item].slice(-MAX_VISIBLE));
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fire = useCallback((message: string, severity: ToastSeverity = 'info') => toast(message, severity), []);

  return (
    <ToastCtx.Provider value={fire}>
      {children}
      <Snackbar open={items.length > 0} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Stack spacing={1} sx={{ maxWidth: 360 }}>
          {items.map((t) => (
            <ToastAlert key={t.id} item={t} onClose={() => dismiss(t.id)} />
          ))}
        </Stack>
      </Snackbar>
    </ToastCtx.Provider>
  );
}

function ToastAlert({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onClose, AUTO_HIDE);
    return () => clearTimeout(id);
  }, [onClose]);
  return (
    <Alert
      severity={item.severity}
      variant="filled"
      onClose={onClose}
      sx={{
        width: '100%',
        borderRadius: 2,
        backdropFilter: 'blur(8px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        alignItems: 'center',
      }}
    >
      {item.message}
    </Alert>
  );
}
