"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithGoogle,
  signInToCloud,
  signInWithCloudAccount,
  createCloudAccount,
} from "../../lib/cloud-sync";

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleGoogle = async () => {
    setBusy(true);
    setError("");
    try {
      await signInWithGoogle();
      router.push("/");
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleAnonymous = async () => {
    setBusy(true);
    setError("");
    try {
      await signInToCloud();
      router.push("/");
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || password.length < 6) {
      setError("Masukkan email valid dan password minimal 6 karakter.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (authMode === "register") {
        await createCloudAccount(email.trim(), password);
      } else {
        await signInWithCloudAccount(email.trim(), password);
      }
      router.push("/");
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Brand */}
        <div className="login-brand">
          <div className="login-logo">S</div>
          <h1>Serenity</h1>
          <p className="login-tagline">Rencana perjalanan yang rapi, tenang, dan selalu dapat diedit.</p>
        </div>

        {/* Google Sign-In */}
        <button
          className="google-btn"
          onClick={handleGoogle}
          disabled={busy}
        >
          <svg viewBox="0 0 48 48" width="20" height="20">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
            <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
          </svg>
          {busy ? "Memproses..." : "Lanjutkan dengan Google"}
        </button>

        {/* Divider */}
        <div className="divider"><span>atau</span></div>

        {/* Toggle */}
        <div className="auth-toggle">
          <button
            className={authMode === "login" ? "active" : ""}
            onClick={() => { setAuthMode("login"); setError(""); }}
          >
            Masuk
          </button>
          <button
            className={authMode === "register" ? "active" : ""}
            onClick={() => { setAuthMode("register"); setError(""); }}
          >
            Buat Akun Baru
          </button>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit}>
          <label className="login-field">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete={authMode === "register" ? "email" : "username"}
              placeholder="nama@email.com"
              required
            />
          </label>
          <label className="login-field">
            Password
            <input
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={authMode === "register" ? "new-password" : "current-password"}
              placeholder="Minimal 6 karakter"
              required
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button className="primary wide" disabled={busy}>
            {busy
              ? "Memproses..."
              : authMode === "register"
                ? "Buat akun & sinkronkan"
                : "Masuk & sinkronkan"}
          </button>
        </form>

        {/* Anonymous */}
        <div className="guest-section">
          <p>Belum ingin daftar?</p>
          <button className="quiet" onClick={handleAnonymous} disabled={busy}>
            Coba sebagai tamu
          </button>
        </div>
      </div>
    </div>
  );
}

function authMessage(error) {
  const messages = {
    "auth/email-already-in-use": "Email sudah terdaftar. Gunakan menu Masuk.",
    "auth/invalid-credential": "Email atau password salah.",
    "auth/invalid-email": "Format email tidak valid.",
    "auth/weak-password": "Password minimal 6 karakter.",
    "auth/network-request-failed": "Jaringan bermasalah. Coba lagi setelah koneksi pulih.",
    "auth/popup-closed-by-user": "Login Google dibatalkan.",
    "auth/popup-blocked": "Popup login diblokir browser. Izinkan popup untuk situs ini.",
    "auth/cancelled-popup-request": "Login dibatalkan.",
  };
  return messages[error?.code] || error?.message || "Terjadi kesalahan. Coba lagi.";
}
