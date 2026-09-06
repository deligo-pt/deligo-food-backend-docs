"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SearchRecord } from "@/types";
import { SearchDialog } from "./SearchDialog";

interface SearchContextValue {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used within <SearchProvider>");
  return ctx;
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [records, setRecords] = useState<SearchRecord[] | null>(null);
  const [pending, setPending] = useState(false);
  const attempted = useRef(false);

  const loadIndex = useCallback(async () => {
    if (records || attempted.current) return;
    attempted.current = true;
    setPending(true);
    try {
      const res = await fetch("/api/search-index", { cache: "force-cache" });
      if (res.ok) setRecords((await res.json()) as SearchRecord[]);
    } catch {
      /* offline / dev — the dialog shows an unavailable state */
    } finally {
      setPending(false);
    }
  }, [records]);

  const open = useCallback(() => {
    setIsOpen(true);
    void loadIndex();
  }, [loadIndex]);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (
        (e.key === "k" && (e.metaKey || e.ctrlKey)) ||
        (e.key === "/" && !typing)
      ) {
        e.preventDefault();
        setIsOpen((v) => !v);
        void loadIndex();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loadIndex]);

  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);

  return (
    <SearchContext.Provider value={value}>
      {children}
      {isOpen && (
        <SearchDialog
          onClose={close}
          records={records}
          loading={pending && !records}
        />
      )}
    </SearchContext.Provider>
  );
}
