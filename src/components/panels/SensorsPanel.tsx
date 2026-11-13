import { Box, Typography, Stack } from '@mui/material';
import { Sensors } from '../../types';
import { Radio, CreditCard, KeyRound, RadioTower } from 'lucide-react';
import { ReactNode } from 'react';

function SensorTile({ icon, name, value }: { icon: ReactNode; name: string; value: string | null }) {
  const has = value !== null && value !== undefined;
  return (
    <Box
      sx={{
        p: 1.25,
        borderRadius: 2,
        backgroundColor: 'rgba(0,0,0,0.3)',
        border: `1px solid ${has ? 'rgba(179,157,219,0.3)' : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: has ? 'primary.light' : 'text.secondary', mb: 0.5 }}>
        {icon}
        <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 700, fontSize: 10 }}>
          {name}
        </Typography>
      </Stack>
      <Typography sx={{ fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all', color: has ? '#f3e5f5' : 'rgba(255,255,255,0.3)' }}>
        {has ? value : 'no data'}
      </Typography>
    </Box>
  );
}

export function SensorsPanel({ sensors }: { sensors: Sensors }) {
  return (
    <Box className="glass-panel" sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Sensors
      </Typography>
      <Stack spacing={1}>
        <SensorTile icon={<Radio size={14} />} name="Infrared" value={sensors.ir} />
        <SensorTile icon={<CreditCard size={14} />} name="RFID" value={sensors.rfid} />
        <SensorTile icon={<KeyRound size={14} />} name="iButton" value={sensors.ibutton} />
        <SensorTile icon={<RadioTower size={14} />} name="Sub-GHz" value={sensors.subghz} />
      </Stack>
    </Box>
  );
}
