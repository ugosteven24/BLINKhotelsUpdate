"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmDialog, toastSuccess, toastError } from "@/lib/swal";

// Confirms with SweetAlert, calls a server action that returns { error } or { success }, then toasts.
// Pass redirectTo when deleting from a detail page; otherwise the current list refreshes.
export default function DeleteButton({
  action, args = [], title = "Delete this item?", text, confirmText = "Yes, delete",
  redirectTo, className = "adm-btn danger sm", children = "Delete",
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const onClick = async () => {
    const ok = await confirmDialog({ title, text, confirmText, danger: true });
    if (!ok) return;
    start(async () => {
      const res = await action(...args);
      if (res?.error) return toastError(res.error);
      toastSuccess(res?.success || "Deleted.");
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  };
  return (
    <button type="button" className={className} disabled={pending} onClick={onClick}>
      {pending ? "Working…" : children}
    </button>
  );
}
