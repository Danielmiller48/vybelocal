"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function EventSearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(-1);
  const router = useRouter();
  const containerRef = useRef(null);

  // debounce fetch
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/events?q=${encodeURIComponent(query.trim())}`);
        const json = await res.json();
        setResults(Array.isArray(json) ? json : []);
      } catch (err) {
        console.error("search error", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  // keyboard nav
  useEffect(() => {
    function onKey(e) {
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex(i => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex(i => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && index >= 0) {
        e.preventDefault();
        go(results[index].id);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, results]);

  // click outside close
  useEffect(() => {
    function handleClick(e) {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const go = id => {
    setOpen(false);
    setQuery("");
    router.push(`/vybes/${id}`);
  };

  return (
    <div className="relative w-full max-w-xs" ref={containerRef}>
      <input
        type="text"
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
          setIndex(-1);
        }}
        placeholder="Search events or hosts…"
        className="w-full px-3 py-1.5 border rounded focus:ring-2 focus:ring-violet-500 text-sm"
      />
      {open && (results.length > 0 || loading) && (
        <div className="absolute z-20 mt-1 w-full bg-white shadow-lg rounded border max-h-60 overflow-auto text-sm">
          {loading && <div className="p-3 text-gray-500">Searching…</div>}
          {!loading && results.map((r, i) => (
            <button
              key={r.id}
              onClick={() => go(r.id)}
              className={`flex flex-col items-start w-full text-left px-3 py-2 hover:bg-violet-50 ${i===index ? 'bg-violet-100' : ''}`}
            >
              <span className="font-medium">{r.title}</span>
              <span className="text-xs text-gray-500">{new Date(r.starts_at).toLocaleDateString()} • {r.host.name}</span>
            </button>
          ))}
          {!loading && results.length === 0 && (
            <div className="p-3 text-gray-500">No results</div>
          )}
        </div>
      )}
    </div>
  );
} 