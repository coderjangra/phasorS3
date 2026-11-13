// ============================================================================
// ActionButton — a drop-in wrapper around MUI <Button> that makes a click feel
// like a process that started and ended, and makes success/failure obvious.
//
//   idle --click--> pending --(await action)--> success | error --(~1.6s)--> idle
//
// Pass `action` instead of `onClick`. It may return a Promise resolving to
// { ok, warning? } (the live link's send() contract) or void (optimistic send).
// Fires a module-level toast() on resolution unless confirmToast === false.
// Theme-consistent; intended for reuse across the app.
// ============================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, ButtonProps, CircularProgress, Tooltip } from '@mui/material';
import { Check, X } from 'lucide-react';
import { toast } from './Toast';

export type ActionResult = { ok: boolean; warning?: string };

type Phase = 'idle' | 'pending' | 'success' | 'error';

export interface ActionButtonProps extends Omit<ButtonProps, 'onClick'> {
  /** Replaces onClick. Return a Promise<{ok,warning?}> for real feedback, or void for an optimistic "Sent" pulse. */
  action: () => Promise<ActionResult> | void;
  /** Label shown briefly in the success phase (default "Done" / "Sent"). */
  successLabel?: string;
  /** Set false to suppress the success/error toast. */
  confirmToast?: boolean;
}

const RESET_MS = 1600;

const TINT: Record<Exclude<Phase, 'idle' | 'pending'>, string> = {
  success: '#0ca30c',
  error: '#d03b3b',
};

export function ActionButton({
  action,
  children,
  successLabel,
  confirmToast,
  disabled,
  startIcon,
  sx,
  color,
  ...rest
}: ActionButtonProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [tip, setTip] = useState<string | undefined>(undefined);
  const timer = useRef<number | undefined>(undefined);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const scheduleReset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (mounted.current) {
        setPhase('idle');
        setTip(undefined);
      }
    }, RESET_MS);
  }, []);

  const finish = useCallback(
    (next: Phase, message: string, severity: 'success' | 'error' | 'warning', tooltip?: string) => {
      if (!mounted.current) return;
      setPhase(next);
      setTip(tooltip);
      if (confirmToast !== false) toast(message, severity);
      scheduleReset();
    },
    [confirmToast, scheduleReset]
  );

  const handleClick = useCallback(async () => {
    if (phase === 'pending') return;
    setPhase('pending');
    setTip(undefined);
    try {
      const ret = action();
      if (ret && typeof (ret as Promise<ActionResult>).then === 'function') {
        const res = await ret;
        if (res && res.ok && !res.warning) {
          finish('success', successLabel ?? 'Done', 'success');
        } else if (res && res.warning) {
          finish('error', res.warning, 'warning', res.warning);
        } else {
          finish('error', 'Failed — device offline', 'error', 'The command was not acknowledged.');
        }
      } else {
        // void return → optimistic "Sent" pulse
        finish('success', successLabel ?? 'Sent', 'success');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      finish('error', `Failed — ${msg}`, 'error', msg);
    }
  }, [action, phase, successLabel, finish]);

  const pending = phase === 'pending';

  let icon = startIcon;
  if (pending) icon = <CircularProgress size={16} color="inherit" />;
  else if (phase === 'success') icon = <Check size={16} />;
  else if (phase === 'error') icon = <X size={16} />;

  const tintColor = phase === 'success' || phase === 'error' ? TINT[phase] : undefined;

  const label =
    phase === 'success' && successLabel
      ? successLabel
      : phase === 'error'
      ? children ?? 'Failed'
      : children;

  const btn = (
    <Button
      {...rest}
      color={color}
      startIcon={icon}
      disabled={disabled || pending}
      onClick={handleClick}
      sx={{
        ...(tintColor
          ? {
              color: '#fff',
              backgroundColor: `${tintColor} !important`,
              borderColor: `${tintColor} !important`,
              '&:hover': { backgroundColor: `${tintColor} !important` },
            }
          : {}),
        transition: 'background-color 160ms, border-color 160ms',
        ...sx,
      }}
    >
      {label}
    </Button>
  );

  return tip ? (
    <Tooltip title={tip} open={phase === 'error' ? undefined : false}>
      {btn}
    </Tooltip>
  ) : (
    btn
  );
}
