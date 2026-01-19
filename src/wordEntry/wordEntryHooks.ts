import { useCallback, useEffect, useMemo, useRef } from "react";
import type { WordEntries, WordEntry } from "./wordEntryTypes";
import { createEmptyWordEntry } from "../wordEntry/wordEntryStore";

export function useWordEntries(args: {
  list: WordEntry[];
  setList: React.Dispatch<React.SetStateAction<WordEntry[]>>;
  selectedId: string;
  setSelectedId: (id: string) => void;
}): WordEntries {
  const { list, setList, selectedId, setSelectedId } = args;

  // Keep a ref so async handlers can read the latest entries without stale closures.
  const listRef = useRef(list);
  useEffect(() => { listRef.current = list; }, [list]);

  const get = useCallback((id: string) => {
    return listRef.current.find((e) => e.id === id);
  }, [listRef]);

  const update = (id: string, updater: (current: WordEntry) => WordEntry) => {
    setList((prev) =>
      prev.map(entry => {
        if (entry.id !== id) return entry;
        const next = updater(entry);
        return next === entry ? entry : { ...next, updatedAt: Date.now() };
      })
    );
  };
  const updateAll = (updater: (current: WordEntry) => WordEntry) => {
    setList((prev) =>
      prev.map(entry => {
        const next = updater(entry);
        return next === entry ? entry : { ...next, updatedAt: Date.now() };
      })
    );
  };
  const create = () => {
    const wordEntry = createEmptyWordEntry();
    setList((prev) => [wordEntry, ...prev]);
    setSelectedId(wordEntry.id);
  };
  const remove = (id: string) => {
    setList((prev) => {
      const next = prev.filter((entry) => entry.id !== id);

      // ensure there is always at least one
      if (next.length === 0) {
        const created = createEmptyWordEntry();
        setSelectedId(created.id);
        return [created];
      }
      if (selectedId === id) {
        setSelectedId(next[0].id);
      }
      return next;
    });
  };

  const selected = useMemo(() => {
    return list.find((entry) => entry.id === selectedId) ?? list[0];
  }, [list, selectedId]);

  return {
    list,
    selectedId,
    selected,
    get,
    select: setSelectedId,
    create,
    remove,
    update,
    updateAll,
  };
}
