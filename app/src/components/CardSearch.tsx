"use client";

// Search-as-you-type card picker. Debounced, cancels stale requests, full keyboard
// support (↑ ↓ Enter Esc, "/" to focus from anywhere), and prefetches the highlighted
// card so picking it feels instant.

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CardThumb } from "./CardThumb";
import type { CardSearchResult, GradeTier } from "@/types/domain";

const DEBOUNCE_MS = 120;

export function CardSearch({
  autoFocus = false,
  grade,
  size = "lg",
}: {
  autoFocus?: boolean;
  grade?: GradeTier; // carried over so the next card opens at the same grade
  size?: "lg" | "md";
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CardSearchResult[]>([]);
  const [searchedFor, setSearchedFor] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [photoStatus, setPhotoStatus] = useState<"idle" | "reading" | "error">("idle");
  const [photoError, setPhotoError] = useState("");

  const hrefFor = (id: string) => `/card/${encodeURIComponent(id)}${grade ? `?grade=${grade}` : ""}`;

  // "/" focuses the search box unless you're already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key !== "/" || target.closest("input, textarea, [contenteditable]")) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) return;
        const body = (await res.json()) as { results: CardSearchResult[] };
        setResults(body.results);
        setSearchedFor(q);
        setActive(0);
      } catch {
        // aborted or offline — keep the previous results
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const visible = query.trim().length > 0 ? results : [];
  const showList = open && (query.trim().length > 0 || photoStatus !== "idle");

  const activeHref = showList && visible[active] ? hrefFor(visible[active].id) : null;
  useEffect(() => {
    if (activeHref) router.prefetch(activeHref);
  }, [activeHref, router]);

  function go(card: CardSearchResult) {
    setOpen(false);
    router.push(hrefFor(card.id));
  }

  async function handlePhoto(file: File) {
    setPhotoStatus("reading");
    setPhotoError("");
    setOpen(true);
    try {
      const body = new FormData();
      body.append("image", file);
      const res = await fetch("/api/search/image", { method: "POST", body });
      const data = (await res.json()) as {
        reading?: { visible: boolean; name: string | null };
        query?: string | null;
        results?: CardSearchResult[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Couldn't read that photo.");
      if (!data.query || !data.results || data.results.length === 0) {
        setPhotoStatus("error");
        setPhotoError(
          data.reading?.visible === false
            ? "Couldn't spot a card in that photo — try a clearer, closer shot."
            : "Couldn't match that card to our catalog — try typing the name instead.",
        );
        return;
      }
      setResults(data.results);
      setSearchedFor(data.query);
      setQuery(data.query);
      setActive(0);
      setPhotoStatus("idle");
    } catch (err) {
      setPhotoStatus("error");
      setPhotoError(err instanceof Error ? err.message : "Couldn't read that photo.");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, visible.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const card = visible[active];
      if (card) {
        e.preventDefault();
        go(card);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const big = size === "lg";

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && visible[active] ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        aria-label="Search cards by name, set or number"
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        placeholder="Search a card — e.g. charizard 151, or 199/165"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setPhotoStatus("idle");
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={`w-full rounded-xl border border-line bg-surface text-ink placeholder:text-ink-3 outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 ${
          big ? "h-14 pl-5 pr-12 text-lg" : "h-11 pl-4 pr-11 text-base"
        }`}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handlePhoto(file);
        }}
      />
      <button
        type="button"
        aria-label="Search by photo"
        title="Search by photo"
        onMouseDown={(e) => e.preventDefault()} // keep focus so the list doesn't blur-close first
        onClick={() => fileInputRef.current?.click()}
        className={`absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink ${
          big ? "h-10 w-10" : "h-8 w-8"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 8a2 2 0 0 1 2-2h1.17a2 2 0 0 0 1.66-.9l.34-.51A2 2 0 0 1 10.83 3.5h2.34a2 2 0 0 1 1.66.9l.34.51a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"
          />
          <circle cx="12" cy="13" r="3.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {!big ? null : (
        <kbd className="pointer-events-none absolute right-12 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 text-xs text-ink-3 sm:block">
          /
        </kbd>
      )}

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-2 max-h-[70vh] w-full overflow-auto rounded-xl border border-line bg-surface p-1 shadow-lg"
        >
          {photoStatus === "reading" && (
            <li className="px-3 py-4 text-sm text-ink-2">Reading card from photo…</li>
          )}
          {photoStatus === "error" && <li className="px-3 py-4 text-sm text-ink-2">{photoError}</li>}
          {photoStatus === "idle" && visible.length === 0 && searchedFor === query.trim() && (
            <li className="px-3 py-4 text-sm text-ink-2">No cards match “{query.trim()}”.</li>
          )}
          {photoStatus === "idle" &&
            visible.map((card, i) => (
            <li
              key={card.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus; blur would close the list before click lands
                go(card);
              }}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 ${
                i === active ? "bg-surface-2" : ""
              }`}
            >
              <CardThumb src={card.imageUrl} alt="" width={36} />
              <div className="min-w-0">
                <div className="truncate font-medium">{card.name}</div>
                <div className="truncate text-sm text-ink-2">
                  {card.setName}
                  {card.number ? ` · #${card.number}` : ""} · {card.releaseDate.slice(0, 4)} · {card.rarity}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
