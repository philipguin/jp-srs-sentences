import { useEffect, useRef, useState } from "react";

export type AnkiConnectNote = {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags: string[];
};

type AnkiConnectResponse<T> = {
  result: T;
  error: string | null;
};

const ANKI_CONNECT_URL = "http://127.0.0.1:8765";
export const ANKI_CONNECT_VERSION = 5;

async function invokeAnkiConnect<T>(action: string, params?: Record<string, unknown>): Promise<T> {
  const response = await fetch(ANKI_CONNECT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, version: ANKI_CONNECT_VERSION, params }),
  });

  if (!response.ok) {
    throw new Error(`AnkiConnect HTTP ${response.status}: ${response.statusText}`);
  }

  const payload = (await response.json()) as AnkiConnectResponse<T>;

  if (payload.error) {
    throw new Error(payload.error);
  }

  return payload.result;
}

export async function fetchAnkiVersion(): Promise<number> {
  return invokeAnkiConnect<number>("version");
}

export async function fetchAnkiDeckNames(): Promise<string[]> {
  return invokeAnkiConnect<string[]>("deckNames");
}

export async function fetchAnkiModelNames(): Promise<string[]> {
  return invokeAnkiConnect<string[]>("modelNames");
}

export async function fetchAnkiModelFieldNames(modelName: string): Promise<string[]> {
  return invokeAnkiConnect<string[]>("modelFieldNames", { modelName });
}

export async function addAnkiNotes(notes: AnkiConnectNote[]): Promise<Array<number | null>> {
  return invokeAnkiConnect<Array<number | null>>("addNotes", { notes });
}

////////////////

type AnkiStatus =
  | { kind: "checking" }
  | { kind: "online"; version: number }
  | { kind: "outdated"; version: number }
  | { kind: "offline" };

export function useAnkiConnectStatus(opts?: {
  enabled?: boolean;
  onlineIntervalMs?: number;   // e.g. 5000
  offlineIntervalMs?: number;  // e.g. 3000
}) {
  const enabled = opts?.enabled ?? true;
  const onlineIntervalMs = opts?.onlineIntervalMs ?? 5000;
  const offlineIntervalMs = opts?.offlineIntervalMs ?? 3000;

  const [status, setStatus] = useState<AnkiStatus>({ kind: "checking" });
  
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const aliveRef = useRef(true);

  async function checkOnce() {
    if (!enabled) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const version = await fetchAnkiVersion();

      if (!aliveRef.current) return;

      if (version < ANKI_CONNECT_VERSION) {
        setStatus({ kind: "outdated", version });
      } else {
        setStatus({ kind: "online", version });
      }
    } catch {
      if (!aliveRef.current) return;
      setStatus({ kind: "offline" });

    } finally {
      inFlightRef.current = false;
    }
  }

  useEffect(() => {
    aliveRef.current = true;

    function clearTimer() {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    async function loop() {
      await checkOnce();

      if (!aliveRef.current || !enabled) return;

      const nextMs =
        status.kind === "online" || status.kind === "outdated"
          ? onlineIntervalMs
          : offlineIntervalMs;

      clearTimer();
      timerRef.current = window.setTimeout(loop, nextMs);
    }

    if (enabled) {
      // start loop immediately
      loop();

      const onVisibilityOrFocus = () => {
        // re-check quickly when user returns
        checkOnce();
      };

      document.addEventListener("visibilitychange", onVisibilityOrFocus);
      window.addEventListener("focus", onVisibilityOrFocus);

      return () => {
        aliveRef.current = false;
        clearTimer();
        document.removeEventListener("visibilitychange", onVisibilityOrFocus);
        window.removeEventListener("focus", onVisibilityOrFocus);
      };
    }

    return () => {
      aliveRef.current = false;
      clearTimer();
    };
    // IMPORTANT: status in deps will cause loop interval to adjust as status changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, onlineIntervalMs, offlineIntervalMs, status.kind]);

  return status;
}
