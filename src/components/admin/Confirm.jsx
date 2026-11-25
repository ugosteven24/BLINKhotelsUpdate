"use client";

import { useEffect } from "react";
import { confirmDialog } from "@/lib/swal";

// Mount once in the layout. Any button with data-confirm="Question?" asks first (SweetAlert2),
// then submits its form with the button's own name/value, so server actions still receive them.
// Optional: data-confirm-text="Yes, delete" and data-confirm-detail="Longer explanation".
export default function Confirm() {
  useEffect(() => {
    const onClick = async (e) => {
      const el = e.target.closest?.("[data-confirm]");
      if (!el || el.disabled) return;
      e.preventDefault();
      e.stopPropagation();

      // Don't ask about a form that would fail HTML validation anyway.
      if (el.form && !el.form.reportValidity()) return;

      const ok = await confirmDialog({
        title: el.getAttribute("data-confirm") || "Are you sure?",
        text: el.getAttribute("data-confirm-detail") || undefined,
        confirmText: el.getAttribute("data-confirm-text") || "Yes, continue",
        danger: el.classList.contains("danger"),
      });
      if (ok && el.form) el.form.requestSubmit(el);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
