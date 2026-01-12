import { useEffect, useState } from "react";
import { initKuroshiro, isKuroshiroReady } from "./kuroshiroService";

export function useFuriganaStatus(enableFurigana: boolean): "idle" | "loading" | "ready" | "error" {
  const [furiganaStatus, setFuriganaStatus] = useState<"idle" | "loading" | "ready" | "error">(
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
