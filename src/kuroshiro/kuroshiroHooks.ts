import { useEffect, useState } from "react";
import { initKuroshiro, isKuroshiroReady } from "./kuroshiroService";
import type { KuroshiroStatus } from "./kuroshiroTypes"

export function useFuriganaStatus(enableFurigana: boolean): KuroshiroStatus {

  const [furiganaStatus, setFuriganaStatus] = useState<KuroshiroStatus>(
    isKuroshiroReady() ? "ready" : "idle",
  );
  useEffect(() => {
    if (!enableFurigana) {
      setFuriganaStatus(isKuroshiroReady() ? "ready" : "idle");
      return;
    }

    if (isKuroshiroReady()) {
      setFuriganaStatus("ready");
      return;
    }

    let cancelled = false;
    setFuriganaStatus("loading");
    initKuroshiro()
      .then(() => {
        if (!cancelled) setFuriganaStatus("ready");
      })
      .catch((e) => {
        if (!cancelled) {
          console.error(e);
          setFuriganaStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enableFurigana]);

  return furiganaStatus;
}
