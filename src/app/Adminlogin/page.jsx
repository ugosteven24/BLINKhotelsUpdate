"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminLogin } from "@/services/auth.service";

import Swal from "sweetalert2";

const BUTTON_COLOR = "#2563eb";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);


  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      Swal.fire({
        icon: "warning",
        title: "Invalid request",
        text: "Please enter your email and password.",
        confirmButtonColor: BUTTON_COLOR,
      });
      return;
    }

    setLoading(true);

    try {
      // Server Action: checks the password AND that the account is an admin.
      const result = await adminLogin({ email, password });

      if (!result.ok) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: result.message,
          confirmButtonColor: BUTTON_COLOR,
        });
        setLoading(false);
        return;
      }

      Swal.fire({
        icon: "success",
        title: "Login successfully",
        text: "You have been logged in.",
        confirmButtonColor: BUTTON_COLOR,
      });

      router.push("/superadmin");
      router.refresh();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Login failed.",
        confirmButtonColor: BUTTON_COLOR,
      });
    }

    setLoading(false);
  };

  return (
    <div className="login-container">


      <div className="login-card">

        <div className="login-header">
          <h1>HotelReserve</h1>
          <p>Sign in to continue</p>
        </div>

        <form
          className="login-form"
          onSubmit={handleLogin}
        >

          <div className="form-group">
            <label>Email Address</label>

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              required
            />
          </div>

          <div className="form-options">

            <label className="remember">
              <input type="checkbox" />
              Remember Me
            </label>

            <Link href="/forgot-password">
              Forgot Password?
            </Link>

          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={loading}
          >
            {loading
              ? "Signing In..."
              : "Login"}
          </button>

        </form>

      </div>
    </div>
  );
}
