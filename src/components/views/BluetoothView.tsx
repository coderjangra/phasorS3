import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { RefreshCw } from 'lucide-react';
import { PhasorState } from '../../types';
import { BlePanel } from '../panels/BlePanel';
import { ViewHeader } from '../common';

// Firmware BLE scan blocks ~5s and emits no explicit "done" event, so we hold
// the scanning affordance a touch longer than the device scan window.
const SCAN_MS = 5500;

export function BluetoothView({ state, send }: { state: PhasorState; send: (cmd: string) => void }) {
  const devices = useMemo(() => Object.values(state.ble), [state.ble]);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  // Keep the "scanned Ns ago" readout fresh once we have a completed scan.
  useEffect(() => {
    if (lastScan == null) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [lastScan]);

  const onScan = useCallback(() => {
    if (scanning) return;
    send('2'); // BLE_SCAN command
    setScanning(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setScanning(false);
      setLastScan(Date.now());
    }, SCAN_MS);
  }, [scanning, send]);

  const agoSec = lastScan != null ? Math.max(0, Math.round((Date.now() - lastScan) / 1000)) : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ViewHeader
        title="Bluetooth"
        infoKey="view.bluetooth"
        subtitle={`${devices.length} BLE devices in range`}
        actions={
          <>
            {!scanning && agoSec != null && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                scanned {agoSec}s ago
              </Typography>
            )}
            <Button
              variant="outlined"
              size="small"
              onClick={onScan}
              disabled={scanning}
              startIcon={
                scanning ? (
                  <CircularProgress size={14} sx={{ color: '#b39ddb' }} />
                ) : (
                  <RefreshCw size={14} />
                )
              }
              sx={{
                color: '#b39ddb',
                borderColor: 'rgba(179,157,219,0.4)',
                '&:hover': { borderColor: '#b39ddb', background: 'rgba(179,157,219,0.08)' },
              }}
            >
              {scanning ? 'Scanning…' : 'Scan BLE'}
            </Button>
          </>
        }
      />
      <Box sx={{ flexGrow: 1, minHeight: 420, height: { md: 'calc(100vh - 200px)' } }}>
        <BlePanel devices={devices} scanning={scanning} />
      </Box>
    </Box>
  );
}
