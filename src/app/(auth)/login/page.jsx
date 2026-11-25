"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import "./login.css";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Hotel,
  CheckCircle,
} from "lucide-react";

import { loginUser, requestPasswordReset } from "@/services/auth.service";

const BUTTON_COLOR = "#0866ed";

const notify = (icon, title, text) =>
  Swal.fire({
    icon,
    title,
    text,
    confirmButtonColor: BUTTON_COLOR,
  });

export default function SigninPage() {
  const router = useRouter();

  const [form, setForm] = useState({ email: "", password: "" });
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleChange = (e) => {
    setForm((previous) => ({
      ...previous,
      [e.target.name]: e.target.value,
    }));
  };

  // ==========================================
  // EMAIL LOGIN
  // ==========================================

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!form.email || !form.password) {
      notify("warning", "Invalid request", "Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      // Server Action: verifies the password and sets the HTTP-only session cookie.
      const result = await loginUser({
        email: form.email.trim(),
        password: form.password,
        remember,
      });

      if (!result.ok) {
        notify("error", "Login failed", result.message);
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Login successful",
        text: "You have been logged in.",
        confirmButtonColor: BUTTON_COLOR,
        timer: 1500,
      });

      router.push("/");
      router.refresh();
    } catch (error) {
      console.error(error);
      notify("error", "Login failed", "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // GOOGLE LOGIN
  // ==========================================

  // Google sign-in needs a Google OAuth client
  // (client id/secret) and a server callback, which are not set up yet.
  const handleGoogleLogin = async () => {
    notify(
      "info",
      "Google sign-in unavailable",
      "Google sign-in is not available yet. Please sign in with your email and password."
    );
  };

  // ==========================================
  // FORGOT PASSWORD
  // ==========================================

  const handleForgotPassword = async () => {
    if (!form.email) {
      notify("warning", "Email required", "Enter your email address first.");
      return;
    }

    try {
      const result = await requestPasswordReset(form.email.trim());

      if (!result.ok) {
        notify("error", "Invalid email", result.message);
        return;
      }

      // Same message either way so account existence is not revealed.
      notify(
        "success",
        "Check your email",
        "If an account exists for this email, a reset link has been sent."
      );
    } catch (error) {
      console.error(error);
      notify("error", "Error", "Unable to send password reset email.");
    }
  };

  return (
    <main className="login-page">
      {/* Left image — desktop */}
      <section className="login-hero">
        <Image
          src="/images/gallery1.jpg"
          alt="Luxury hotel"
          fill
          priority
          sizes="(min-width: 1280px) 55vw, 50vw"
          className="login-hero__image"
        />

        <div className="login-hero__overlay" />

        <div className="login-hero__content">
          <div className="login-brand login-brand--light">
            <div className="login-brand__icon">
              <Hotel size={23} />
            </div>

            <div>
              <h1 className="login-brand__name"><Link href={"/"}>FindMyHotel</Link></h1>
              <p className="login-brand__tagline">Find your perfect stay</p>
            </div>
          </div>

          <div className="login-hero__intro">
            <p className="login-hero__eyebrow">Welcome back</p>

            <h2 className="login-hero__title">
              Your next
              <br />
              stay awaits.
            </h2>

            <p className="login-hero__description">
              Sign in to manage your bookings, discover beautiful hotels and
              keep your favorite stays in one place.
            </p>

            <div className="login-hero__features">
              <div className="login-hero__feature">
                <CheckCircle size={20} />
                <span>Manage your hotel bookings</span>
              </div>

              <div className="login-hero__feature">
                <CheckCircle size={20} />
                <span>Save your favorite hotels</span>
              </div>

              <div className="login-hero__feature">
                <CheckCircle size={20} />
                <span>Discover new destinations</span>
              </div>
            </div>
          </div>

          <p className="login-hero__copyright">
            © 2026 FindMyHotel. All rights reserved.
          </p>
        </div>
      </section>

      {/* Right side — login form */}
      <section className="login-form-section">
        <div className="login-form-container">
          <div className="login-brand login-brand--mobile">
            <div className="login-brand__icon">
              <Hotel size={22} />
            </div>

            <div>
              <h1 className="login-brand__name">FindMyHotel</h1>
              <p className="login-brand__tagline">Find your perfect stay</p>
            </div>
          </div>

          <div className="login-heading">
            <h2>Welcome back</h2>
            <p>Sign in to continue to your account.</p>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="login-google-button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M21.35 12.23c0-.79-.07-1.55-.23-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42Z"
              />
              <path
                fill="#34A853"
                d="M12 21.5c2.63 0 4.84-.87 6.45-2.35l-3.14-2.45c-.87.58-1.98.93-3.31.93-2.54 0-4.7-1.72-5.47-4.04H3.29v2.53A9.74 9.74 0 0 0 12 21.5Z"
              />
              <path
                fill="#FBBC05"
                d="M6.53 13.59a5.85 5.85 0 0 1 0-3.18V7.88H3.29a9.73 9.73 0 0 0 0 8.24l3.24-2.53Z"
              />
              <path
                fill="#EA4335"
                d="M12 6.37c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.39 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.71 5.38l3.24 2.53C7.3 8.09 9.46 6.37 12 6.37Z"
              />
            </svg>

            {googleLoading ? "Signing in..." : "Continue with Google"}
          </button>

          <div className="login-divider">
            <span />
            <p>OR</p>
            <span />
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <div className="login-field">
              <label htmlFor="login-email">Email address</label>

              <div className="login-input-wrap">
                <Mail size={18} className="login-input-icon" />

                <input
                  id="login-email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="login-input"
                />
              </div>
            </div>

            <div className="login-field">
              <div className="login-password-heading">
                <label htmlFor="login-password">Password</label>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="login-forgot-button"
                >
                  Forgot password?
                </button>
              </div>

              <div className="login-input-wrap">
                <Lock size={18} className="login-input-icon" />

                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="login-input login-input--password"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((show) => !show)}
                  className="login-password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <label className="login-remember">
              <input
                type="checkbox"
                name="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Remember me</span>
            </label>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="login-submit-button"
            >
              {loading ? (
                "Signing in..."
              ) : (
                <>
                  Sign in
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="login-register">
            Don't have an account? <Link href="/register">Create account</Link>
          </p>
        </div>
      </section>
    </main>
  );
}