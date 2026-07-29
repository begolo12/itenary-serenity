"use client";
import { useState, useEffect, useCallback } from "react";
import {
  signInToCloud, signOutFromCloud, signInWithGoogle,
  signInWithCloudAccount, createCloudAccount,
  createWorkspace, joinWorkspaceByCode, inviteUserToWorkspace,
  deleteWorkspace, leaveWorkspace, resetPersonalWorkspace,
} from "../../lib/cloud-sync";
import { cloudMessage, SUPER_ADMIN_EMAIL } from "../../lib/cloud-sync";
import { getAiProviderStatus, generateWithAi } from "../../lib/ai-client";
import { CURRENCY_KEY, CURRENCY_LIST } from "../../lib/trips";
import { syncLabel } from "../layout/Sidebar";
const AI_PROVIDERS = {
  deepseek: { label: "DeepSeek", model: "deepseek-v4-flash" },
  openai: { label: "OpenAI", model: "gpt-4o-mini" },
  gemini: { label: "Gemini", model: "gemini-2.0-flash" },
};

export function authMessage(error) {
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
  return messages[error?.code] || cloudMessage(error);
}

function Settings({ provider, setProvider, user, memberCode, cloudState, cloudReady, toast, workspaces, activeWorkspaceId, switchWorkspace, activateWorkspace }) {
  const [testing, setTesting] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const [loadingAi, setLoadingAi] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceCode, setWorkspaceCode] = useState("");
  const [inviteMemberCode, setInviteMemberCode] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState(null);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [currency, setCurrency] = useState("IDR");
  const [language] = useState("id");
  const step = ["01", "02", "03"];
  useEffect(() => { try { const saved = localStorage.getItem(CURRENCY_KEY); if (saved) setCurrency(saved); } catch {} }, []);
  useEffect(() => {
    let active = true;
    setLoadingAi(true);
    getAiProviderStatus().then((result) => { if (active) setAiStatus(result.providers || {}); }).catch(() => { if (active) setAiStatus({}); }).finally(() => { if (active) setLoadingAi(false); });
    return () => { active = false; };
  }, [provider]);
  const isSuperAdmin = user && user.email && user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [actionUid, setActionUid] = useState(null);
  const fetchPending = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoadingPending(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/pending", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const body = await res.json(); setPendingUsers(body.users ?? []); }
    } catch {} finally { setLoadingPending(false); }
  }, [isSuperAdmin, user]);
  useEffect(() => { if (isSuperAdmin) fetchPending(); }, [isSuperAdmin, fetchPending]);
  const handleAdminAction = async (uid, action) => {
    setActionUid(uid);
    try {
      const token = await user.getIdToken();
      await fetch("/api/admin/approve", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ uid, action }) });
      setPendingUsers((prev) => prev.filter((u) => u.uid !== uid));
    } catch {} finally { setActionUid(null); }
  };
  const changeCurrency = (value) => { setCurrency(value); try { localStorage.setItem(CURRENCY_KEY, value); } catch {} };
  const connect = async () => { try { await signInToCloud(); toast("Mode tamu aktif. Menyiapkan workspace cloud..."); } catch (error) { toast(authMessage(error), "error"); } };
  const disconnect = async () => { try { await signOutFromCloud(); toast("Keluar dari cloud. Data lokal tetap tersedia."); } catch (error) { toast(cloudMessage(error), "error"); } };
  const submitAccount = async (event) => {
    event.preventDefault();
    if (!email.trim() || password.length < 6) { toast("Masukkan email valid dan password minimal 6 karakter.", "error"); return; }
    setAuthBusy(true);
    try {
      if (authMode === "register") await createCloudAccount(email.trim(), password);
      else await signInWithCloudAccount(email.trim(), password);
      setPassword("");
      toast(authMode === "register" ? "Akun berhasil dibuat dan cloud sync aktif." : "Berhasil masuk. Menyinkronkan workspace...");
    } catch (error) { toast(authMessage(error), "error"); } finally { setAuthBusy(false); }
  };
  const test = async () => {
    setTesting(true);
    try {
      await generateWithAi({ action: "test", provider, workspaceId: activeWorkspaceId, brief: { origin: "Jakarta", destination: "Bandung", startDate: "2026-08-01", endDate: "2026-08-02", purpose: "Test", people: 1, budget: 1000000 } });
      toast(`Koneksi ${AI_PROVIDERS[provider].label} berhasil. Kredensial hanya digunakan di server.`);
    } catch (error) {
      toast(error.message || "Uji koneksi gagal.", "error");
    } finally {
      setTesting(false);
    }
  };
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || workspaces[0];
  const createNewWorkspace = async (event) => {
    event.preventDefault();
    const name = workspaceName.trim();
    if (!user || !name) { toast("Masukkan nama workspace terlebih dahulu.", "error"); return; }
    if (workspaces.some((w) => (w.name || "").trim().toLowerCase() === name.toLowerCase())) {
      toast(`Workspace dengan nama "${name}" sudah ada. Silakan gunakan nama lain.`, "error");
      return;
    }
    setWorkspaceBusy(true);
    try {
      const workspace = await createWorkspace(user.uid, name, workspaces);
      setWorkspaceName("");
      activateWorkspace(workspace);
      toast(`Workspace "${workspace.name}" berhasil dibuat.`);
    } catch (error) { toast(error.message || "Workspace gagal dibuat.", "error"); }
    finally { setWorkspaceBusy(false); }
  };
  const removeWorkspace = async (workspace) => {
    if (!user) return;
    if (!window.confirm(`Hapus workspace "${workspace.name}" secara permanen?`)) return;
    setWorkspaceBusy(true);
    try {
      await deleteWorkspace(user.uid, workspace.id);
      if (workspace.id === activeWorkspaceId) {
        const remaining = workspaces.filter((w) => w.id !== workspace.id);
        if (remaining.length > 0) switchWorkspace(remaining[0].id);
      }
      toast(`Workspace "${workspace.name}" telah dihapus.`);
    } catch (error) { toast(error.message || "Gagal menghapus workspace.", "error"); }
    finally { setWorkspaceBusy(false); }
  };
  const exitWorkspace = async (workspace) => {
    if (!user) return;
    if (!window.confirm(`Keluar dari workspace "${workspace.name}"?`)) return;
    setWorkspaceBusy(true);
    try {
      await leaveWorkspace(user.uid, workspace.id);
      if (workspace.id === activeWorkspaceId) {
        const remaining = workspaces.filter((w) => w.id !== workspace.id);
        if (remaining.length > 0) switchWorkspace(remaining[0].id);
      }
      toast(`Anda telah keluar dari "${workspace.name}".`);
    } catch (error) { toast(error.message || "Gagal keluar dari workspace.", "error"); }
    finally { setWorkspaceBusy(false); }
  };
  const resetPersonal = async (workspace) => {
    if (!user) return;
    if (!window.confirm(`Reset workspace "${workspace.name}"? Semua itinerary di dalamnya akan dihapus!`)) return;
    setWorkspaceBusy(true);
    try {
      await resetPersonalWorkspace(user.uid);
      toast(`Workspace "${workspace.name}" berhasil di-reset.`);
    } catch (error) { toast(error.message || "Gagal mereset workspace.", "error"); }
    finally { setWorkspaceBusy(false); }
  };
  const joinExistingWorkspace = async (event) => {
    event.preventDefault();
    if (!user || !workspaceCode.trim()) { toast("Masukkan kode workspace terlebih dahulu.", "error"); return; }
    setWorkspaceBusy(true);
    try {
      const workspace = await joinWorkspaceByCode(user.uid, workspaceCode);
      setWorkspaceCode("");
      activateWorkspace(workspace);
      toast(`Berhasil bergabung ke "${workspace.name}".`);
    } catch (error) { toast(error.message || "Gagal bergabung ke workspace.", "error"); }
    finally { setWorkspaceBusy(false); }
  };
  const inviteMember = async (event) => {
    event.preventDefault();
    if (!user || !activeWorkspaceId || !inviteMemberCode.trim()) { toast("Masukkan kode user terlebih dahulu.", "error"); return; }
    setWorkspaceBusy(true);
    try {
      const result = await inviteUserToWorkspace(user.uid, activeWorkspaceId, inviteMemberCode, inviteRole);
      setInviteMemberCode("");
      setInviteRole("editor");
      toast(result.alreadyMember ? "User tersebut sudah ada di workspace." : "User berhasil ditambahkan ke workspace.");
    } catch (error) { toast(error.message || "User gagal ditambahkan.", "error"); }
    finally { setWorkspaceBusy(false); }
  };
  const copyWorkspaceCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast("Kode workspace disalin.");
    } catch { toast(`Kode workspace: ${code}`); }
  };
  let i = 0;
  return (
    <section className="settings-stack">
      <article className="settings card">
        <div className="settings-title">
          <span className="settings-number">{step[i++]}</span>
          <div>
            <p className="eyebrow">KECERDASAN BUATAN</p>
            <h2>{AI_PROVIDERS[provider].label}</h2>
            <p>Kredensial AI dikelola di server dan tidak pernah disimpan di browser, localStorage, atau Firestore.</p>
          </div>
        </div>
        <div className="settings-form">
          <label>Provider
            <select value={provider} onChange={(event) => setProvider(event.target.value)}>
              <option value="deepseek">DeepSeek</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
            </select>
          </label>
          <label>Model<input value={AI_PROVIDERS[provider].model} readOnly /></label>
          <label>Status server<input value={loadingAi ? "Memeriksa..." : aiStatus?.[provider] ? "Siap digunakan" : "Belum dikonfigurasi"} readOnly /></label>
          <small>Admin deployment mengatur kredensial melalui environment server. Pengguna tidak mengirim API key dari browser.</small>
          <div className="button-row">
            <button className="primary" onClick={test} disabled={testing || loadingAi}>{testing ? "Menguji..." : "Uji koneksi"}</button>
          </div>
        </div>
      </article>
      <article className="settings card">
        <div className="settings-title">
          <span className="settings-number">{step[i++]}</span>
          <div>
            <p className="eyebrow">PREFERENSI</p>
            <h2>Wilayah & tampilan</h2>
          </div>
        </div>
        <div className="settings-form">
          <label>Mata uang
            <select value={currency} onChange={(e) => changeCurrency(e.target.value)}>
              {CURRENCY_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>Bahasa
            <select value={language} disabled>
              <option value="id">Indonesia</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
      </article>
      <article className="settings card">
        <div className="settings-title">
          <div>
            <p className="eyebrow">CLOUD SYNC</p>
            <h2>Workspace & anggota</h2>
            <p>Buat beberapa ruang kerja, pilih workspace aktif, atau undang anggota dengan kode unik.</p>
          </div>
        </div>
        {user ? (
          <>
            <div className="workspace-manager">
              <div className="workspace-manager-head">
                <div><strong>Workspace Anda</strong><small>{workspaces.length} workspace tersedia</small></div>
                {activeWorkspace && <span className="workspace-active-label">Aktif</span>}
              </div>
              <div className="member-code-card"><div><strong>Kode user Anda</strong><small>Bagikan kode ini agar pemilik workspace bisa menambahkan Anda.</small></div><div><code>{memberCode || "--------"}</code><button type="button" onClick={() => copyWorkspaceCode(memberCode)} disabled={!memberCode}>Salin</button></div></div>
              <div className="workspace-list">
                {!workspaces.length ? <p className="workspace-loading">Memuat workspace...</p> : workspaces.map((workspace) => (
                  <article key={workspace.id} className={`workspace-item${workspace.id === activeWorkspaceId ? " active" : ""}`}>
                    <button className="workspace-select" onClick={() => switchWorkspace(workspace.id)} aria-pressed={workspace.id === activeWorkspaceId}>
                      <span className="workspace-mark">{(workspace.name || "W").slice(0, 1).toUpperCase()}</span>
                      <span><strong>{workspace.name || "Workspace"}</strong><small>{workspace.role === "owner" ? "Pemilik" : workspace.role === "viewer" ? "Viewer" : "Editor"}{workspace.id === activeWorkspaceId ? " · sedang dipakai" : ""}</small></span>
                    </button>
                    <div className="workspace-code">
                      <code>{workspace.inviteCode || "--------"}</code>
                      <button type="button" onClick={() => copyWorkspaceCode(workspace.inviteCode)} disabled={!workspace.inviteCode}>Salin kode</button>
                      {workspace.id === user.uid ? (
                        <button type="button" className="workspace-reset-btn" onClick={() => resetPersonal(workspace)} disabled={workspaceBusy} title="Hapus semua itinerary di workspace pribadi">Reset</button>
                      ) : workspace.role === "owner" ? (
                        <button type="button" className="workspace-delete-btn" onClick={() => removeWorkspace(workspace)} disabled={workspaceBusy} title="Hapus workspace ini">Hapus</button>
                      ) : (
                        <button type="button" className="workspace-leave-btn" onClick={() => exitWorkspace(workspace)} disabled={workspaceBusy} title="Keluar dari workspace ini">Keluar</button>
                      )}
                    </div>
                    {workspace.role === "owner" && workspace.id === activeWorkspaceId && <><button type="button" className="workspace-invite" onClick={() => setInviteWorkspaceId(inviteWorkspaceId === workspace.id ? null : workspace.id)}>＋ Tambah user dengan kode</button>{inviteWorkspaceId === workspace.id && <form className="workspace-invite-form" onSubmit={inviteMember}><label>Kode user anggota<input value={inviteMemberCode} onChange={(event) => setInviteMemberCode(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" maxLength={8} placeholder="8 angka" /></label><label>Peran<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}><option value="editor">Editor · dapat mengubah</option><option value="viewer">Viewer · hanya membaca</option></select></label><button className="primary" disabled={workspaceBusy}>Tambahkan</button></form>}</>}
                  </article>
                ))}
              </div>
              <div className="workspace-actions">
                <form onSubmit={createNewWorkspace}>
                  <label>Buat workspace baru<input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Contoh: Tim Marketing" /></label>
                  <button className="primary" disabled={workspaceBusy}>Buat workspace</button>
                </form>
                <form onSubmit={joinExistingWorkspace}>
                  <label>Gabung dengan kode<input value={workspaceCode} onChange={(event) => setWorkspaceCode(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" maxLength={8} placeholder="8 angka" /></label>
                  <button className="outline" disabled={workspaceBusy}>Gabung</button>
                </form>
              </div>
            </div>
            <div className="sync-setting">
              <div>
                <span className={`state-dot ${cloudState}`} />
                <strong>{syncLabel(cloudState)}</strong>
                <small>{user.isAnonymous ? `Mode tamu · ${user.uid.slice(0, 8)}\u2026` : user.email}</small>
              </div>
              <button className="quiet" onClick={disconnect}>Keluar dari cloud</button>
            </div>
          </>
        ) : (
          <>
            <button className="google-btn settings-google" onClick={async () => { try { await signInWithGoogle(); toast("Berhasil masuk dengan Google. Menyinkronkan workspace..."); } catch (error) { toast(authMessage(error), "error"); } }}>
              <svg viewBox="0 0 48 48" width="18" height="18">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
              </svg>
              Lanjutkan dengan Google
            </button>
            <div className="divider"><span>atau</span></div>
            <div className="auth-switch">
              <button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>Masuk</button>
              <button className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>Daftar</button>
            </div>
            {authMode === "register" ? (
              <form className="auth-form" onSubmit={submitAccount}>
                <div className="settings-form">
                  <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com" required /></label>
                  <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" minLength={6} required /></label>
                  <div className="button-row">
                    <button className="primary" disabled={authBusy}>{authBusy ? "Memproses..." : "Daftar"}</button>
                  </div>
                </div>
              </form>
            ) : (
              <form className="auth-form" onSubmit={submitAccount}>
                <div className="settings-form">
                  <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com" required /></label>
                  <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan password" required /></label>
                  <div className="button-row">
                    <button className="primary" disabled={authBusy}>{authBusy ? "Memproses..." : "Masuk"}</button>
                  </div>
                </div>
              </form>
            )}
          </>
        )}
      </article>
      {isSuperAdmin && (
        <article className="settings card">
          <div className="settings-title">
            <div>
              <p className="eyebrow">ADMIN PANEL</p>
              <h2>Persetujuan akun</h2>
            </div>
          </div>
          <div className="settings-form">
            <div className="admin-pending-list">
              {loadingPending ? (
                <p>Memuat...</p>
              ) : pendingUsers.length === 0 ? (
                <p>Tidak ada pengguna menunggu.</p>
              ) : pendingUsers.map((u) => (
                <div key={u.uid} className="admin-pending-user">
                  <span className="admin-pending-email">
                    <strong>{u.email}</strong>
                    <small>{u.registeredAt}</small>
                  </span>
                  <div className="admin-pending-actions">
                    <button onClick={() => handleAdminAction(u.uid, "approve")} disabled={actionUid === u.uid}>{actionUid === u.uid ? "Memproses..." : "Setujui"}</button>
                    <button onClick={() => handleAdminAction(u.uid, "reject")} disabled={actionUid === u.uid}>{actionUid === u.uid ? "Memproses..." : "Tolak"}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>
      )}
      <article className="privacy card">
        <span>i</span>
        <div>
          <h3>Data & privasi</h3>
          <p>Trip memiliki salinan lokal untuk akses offline dan otomatis tersinkron ke Firestore melalui akun tamu atau email. Foto WebP maksimal 300 KB ikut tersinkron. Kredensial AI dikelola server dan tidak dikirim dari browser. Output AI tetap perlu diverifikasi.</p>
        </div>
      </article>
    </section>
  );
}

export default Settings;
