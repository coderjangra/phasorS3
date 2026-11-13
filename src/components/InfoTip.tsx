// ============================================================================
// Reusable info affordance. A small ⓘ that reveals an explanation. Short copy
// uses a hover/focus Tooltip; longer copy uses a click Popover so it is
// readable and mobile-friendly. Content comes from src/lib/help.ts by key.
// ============================================================================
import { useState } from 'react';
import { Box, Tooltip, Popover, Typography, IconButton } from '@mui/material';
import { Info } from 'lucide-react';
import { helpText } from '../lib/help';

interface InfoTipProps {
  /** Key into src/lib/help.ts, or raw text via `text`. */
  k?: string;
  text?: string;
  size?: number;
  /** Force click-popover even for short text. */
  click?: boolean;
}

const LONG = 90;

export function InfoTip({ k, text, size = 14, click }: InfoTipProps) {
  const content = text ?? (k ? helpText(k) : '');
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!content) return null;

  const usePopover = click || content.length > LONG;

  if (!usePopover) {
    return (
      <Tooltip title={content} arrow enterTouchDelay={0} leaveTouchDelay={4000}>
        <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', cursor: 'help', verticalAlign: 'middle', opacity: 0.7, '&:hover': { opacity: 1 } }}>
          <Info size={size} />
        </Box>
      </Tooltip>
    );
  }

  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ p: 0.25, color: 'text.secondary', verticalAlign: 'middle', opacity: 0.7, '&:hover': { opacity: 1 } }}
        aria-label="More info"
      >
        <Info size={size} />
      </IconButton>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Typography sx={{ p: 1.5, maxWidth: 300, fontSize: 12.5, lineHeight: 1.5, color: 'rgba(243,229,245,0.9)' }}>
          {content}
        </Typography>
      </Popover>
    </>
  );
}
