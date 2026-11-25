"use client";

import { useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

const WAIT_MS = 400;
// Inputs where the admin is typing: wait for a pause. Everything else (selects, dates) applies at once.
const isTyping = (el) => el.tagName === "INPUT" && !["date", "checkbox", "radio", "range", "color", "file"].includes(el.type);

// The filter bar's <form>. It stays a normal GET form (so it still works without JavaScript), but with JavaScript it
// updates the results by itself: after a short pause while typing, and immediately on a dropdown or date change.
export default function LiveForm({ children, className = "adm-filters" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const timer = useRef(null);
  const composing = useRef(false); // true while an IME (e.g. Chinese/Japanese keyboard) is mid-word

  useEffect(() => () => clearTimeout(timer.current), []);

  function go(form) {
    clearTimeout(timer.current);
    const next = new URLSearchParams();
    for (const [k, v] of new FormData(form)) {
      const val = typeof v === "string" ? v.trim() : "";
      if (val) next.set(k, val);
    }
    // Keep the chosen page size; any filter change goes back to page 1 (so `page` is deliberately not carried over).
    const size = new URLSearchParams(window.location.search).get("pageSize");
    if (size) next.set("pageSize", size);
    const qs = next.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    if (url === window.location.pathname + window.location.search) return; // nothing actually changed
    start(() => router.replace(url, { scroll: false }));
  }

  function later(form) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => go(form), WAIT_MS);
  }

  return (
    <form
      className={className}
      method="get"
      aria-busy={pending}
      onChange={(e) => {
        const form = e.currentTarget;
        if (!isTyping(e.target)) return go(form);
        if (!composing.current) later(form);
      }}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={(e) => { composing.current = false; later(e.currentTarget); }}
      onSubmit={(e) => { e.preventDefault(); go(e.currentTarget); }}
    >
      {children}
    </form>
  );
}
