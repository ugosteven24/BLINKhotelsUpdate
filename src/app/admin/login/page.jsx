"use client";

import "@/components/admin/admin.css";
import { useActionState, useEffect } from "react";
import { toastError } from "@/lib/swal";
import { loginAction } from "@/services/admin/auth";

export default function AdminLogin() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  useEffect(() => { if (state?.error) toastError(state.error); }, [state]);
  return (
    <div className="adm adm-loginwrap">
      <section className="adm-loginhero">
        <div className="adm-brand">Hotel Marketplace</div>
        <div>
          <h1>Run every booking with confidence.</h1>
          <p>Approve hotels, track payments and refunds, and keep an audit trail of every change your team makes.</p>
        </div>
        <p style={{ fontSize: 13 }}>Administrator access only.</p>
      </section>
      <div className="adm-loginform">
        <form className="adm-login" action={action}>
          <h2>Sign in</h2>
          <p className="adm-sub" style={{ marginBottom: 22 }}>Use your administrator account.</p>
          {state?.error && <div className="adm-msg err" role="alert">{state.error}</div>}
          <div className="adm-field" style={{ marginBottom: 14 }}>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" placeholder="name@company.com" autoComplete="username" required />
          </div>
          <div className="adm-field" style={{ marginBottom: 22 }}>
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button className="adm-btn" style={{ width: "100%" }} disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
        </form>
      </div>
    </div>
  );
}
