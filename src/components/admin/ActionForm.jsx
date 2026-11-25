"use client";

import { useActionState, useEffect } from "react";
import { toastSuccess, toastError } from "@/lib/swal";

export default function ActionForm({ action, children, submit = "Save changes", className = "adm-form" }) {
  const [state, formAction, pending] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.success) toastSuccess(state.success);
    else if (state?.error) toastError(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      {/* Kept for screen readers; the visible feedback is the SweetAlert toast. */}
      <div className="sr-only" role="status" aria-live="polite">{state?.success || state?.error || ""}</div>
      <div className={className}>{children}</div>
      <p>
        <button className="adm-btn" type="submit" disabled={pending}>{pending ? "Saving…" : submit}</button>
      </p>
    </form>
  );
}

export const Field = ({ name, labelText, hint, full, ...rest }) => (
  <div className={`adm-field${full ? " full" : ""}`}>
    <label htmlFor={name}>{labelText}</label>
    {rest.as === "textarea" ? (
      <textarea id={name} name={name} rows={3} {...rest} as={undefined} />
    ) : (
      <input id={name} name={name} {...rest} />
    )}
    {hint && <small>{hint}</small>}
  </div>
);
