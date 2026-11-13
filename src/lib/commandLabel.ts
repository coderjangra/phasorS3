// ============================================================================
// Map a raw single-line command to a human-readable toast label.
// Keeps the wire grammar untouched — this is purely for user feedback.
// ============================================================================

export function commandLabel(cmd: string): string {
  const c = cmd.trim();
  const parts = c.split(/\s+/);
  const head = parts[0];

  switch (head) {
    case '1':
      return 'Wi-Fi scan requested';
    case '2':
      return 'BLE scan requested';
    case '3':
      return 'Full sweep requested';
    case '4':
      return 'Continuous mode toggled';
    case '5':
      return 'Monitor mode toggled';
    case '6':
      return 'Passive BLE toggled';
    case '7':
      return 'Status requested';
    case 'C':
      return 'Device caches cleared';
    case 'E':
      return 'Handshake export requested';
    case 'DB':
      return `Broadcast deauth → ${parts[1] ?? '?'}${parts[2] ? ` (ch ${parts[2]})` : ''}`;
    case 'DS':
      return `Targeted deauth → ${parts[2] ?? '?'} on ${parts[1] ?? '?'}`;
    case 'DF':
      return `Force handshake → ${parts[1] ?? '?'}${parts[2] ? ` (ch ${parts[2]})` : ''}`;
    case 'PM':
      return `PMKID attempt → ${parts[1] ?? '?'}`;
    case 'PS':
      return `PMKID attempt → ${parts[2] ?? parts[1] ?? '?'}`;
    case 'BR':
      return 'Beacon list loaded (defaults)';
    case 'BA':
      return parts.length > 1 ? `Beacon SSID added: ${parts.slice(1).join(' ')}` : 'Beacon flood started';
    case 'BS':
      return 'Beacon flood stopped';
    case 'BC':
      return 'Beacon list cleared';
    case 'F1':
      return `BLE target flood → ${parts[1] ?? '?'}`;
    case 'F2':
      return 'BLE mass flood started';
    case 'FS':
      return 'BLE flood stopped';
    default:
      return `Command sent: ${c}`;
  }
}
