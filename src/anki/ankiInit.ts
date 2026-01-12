import { useAnkiConnectStatus } from "./ankiConnect";

export function useAnkiStatus() {
  return useAnkiConnectStatus({
    enabled: true,
    onlineIntervalMs: 5000,
    offlineIntervalMs: 3000,
  });
}
