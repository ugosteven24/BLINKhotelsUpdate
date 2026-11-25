"use client";

import { useActionState, useEffect } from "react";
import { toastSuccess, toastError } from "@/lib/swal";

// <form> for server actions shaped (formData) -> { success | error }. Shows the result as a toast.
// Buttons inside can carry data-confirm="Question?" (handled globally by <Confirm />).
export default function QuickForm({ action, children, className = "adm-inline" }) {
  const [state, formAction] = useActionState(async (_prev, fd) => action(fd), undefined);
  useEffect(() => {
    if (state?.success) toastSuccess(state.success);
    else if (state?.error) toastError(state.error);
  }, [state]);
  return <form action={formAction} className={className}>{children}</form>;
}
