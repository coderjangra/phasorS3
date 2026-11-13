// Single-line command grammar. These strings are what the firmware's web
// command handler (webCommand) parses, and they double as serial-CLI input.
// Commands are sent via usePhasorLink.send() (WebSocket text frame, HTTP fallback).

export const commands = {
  // Recon
  scanWifi: () => '1',
  scanBle: () => '2',
  fullSweep: () => '3',
  toggleContinuous: () => '4',
  toggleMonitor: () => '5',
  passiveBle: () => '6',
  status: () => '7',
  clearBuffers: () => 'C',
  exportHandshakes: () => 'E',

  // Deauth / handshake forcing
  deauthBroadcast: (bssid: string, chan: number | string, n: number | string = 20) =>
    `DB ${bssid} ${chan} ${n}`,
  deauthTargeted: (ap: string, sta: string, chan: number | string) => `DS ${ap} ${sta} ${chan}`,
  forceHandshake: (bssid: string, chan: number | string, sec: number | string = 15) =>
    `DF ${bssid} ${chan} ${sec}`,

  // PMKID
  pmkid: (bssid: string, ssid: string, chan: number | string) => `PS ${bssid} ${ssid} ${chan}`,
  pmkidNoSsid: (bssid: string, chan: number | string) => `PM ${bssid} ${chan}`,

  // Beacon flood
  beaconLoadDefaults: () => 'BR',
  beaconAdd: (ssid: string) => `BA ${ssid}`,
  beaconStart: () => 'BA',
  beaconStop: () => 'BS',
  beaconClear: () => 'BC',
  beaconList: () => 'BL',

  // BLE flood
  bleFloodTarget: (mac: string, n: number | string = 80) => `F1 ${mac} ${n}`,
  bleMassFlood: (n: number | string = 30) => `F2 ${n}`,
  bleFloodStop: () => 'FS',

  // USB-HID
  hidReverseShell: () => 'K1',
  hidMimikatz: () => 'K2',
  hidText: () => 'K3',
};

/** Legacy direct HTTP sender kept for callers that don't have the link's send(). */
export const sendCommand = async (ip: string, command: string): Promise<boolean> => {
  try {
    const res = await fetch(`http://${ip}/cmd?c=${encodeURIComponent(command)}`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
};
