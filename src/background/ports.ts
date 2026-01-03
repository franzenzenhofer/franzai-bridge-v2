import type { BgEvent } from "../shared/messages";

export type PortHub = {
  broadcast: (evt: BgEvent) => void;
  register: (port: chrome.runtime.Port) => void;
};

export function createPortHub(): PortHub {
  const ports = new Set<chrome.runtime.Port>();

  return {
    broadcast(evt) {
      for (const port of ports) {
        try {
          port.postMessage(evt);
        } catch {
          // Ignore dead ports.
        }
      }
    },
    register(port) {
      ports.add(port);
      port.onDisconnect.addListener(() => ports.delete(port));
    }
  };
}
