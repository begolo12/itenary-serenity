"use client";

import { useEffect, useRef, useState } from "react";
import { compressPhotoForFirestore } from "../lib/image-compression";
import { deleteProviderKey, loadProviderKey, saveProviderKey } from "../lib/secure-key-store";
import {
  bootstrapWorkspace, createCloudAccount, deleteCloudTrip, saveCloudTrip,
  signInToCloud, signInWithCloudAccount, signInWithGoogle, signOutFromCloud, watchAuth, watchCloudTrips,
  saveProviderKeyToCloud, loadProviderKeyFromCloud,
} from "../lib/cloud-sync";
import {
  STORAGE_KEY, blankTrip, createTemplate, dateLabel, downloadCsv, downloadIcs,
  rupiah, validateTrip,
} from "../lib/trips";

const tabs = [
  ["overview", "Ringkasan"], ["rundown", "Rundown"],
  ["budget", "Anggaran"], ["checklist", "Checklist"],
];
const CLOUD_UID_KEY = "serenity-itinerary-cloud-uid";
const AI_PROVIDERS = {
  deepseek: { label: "DeepSeek", model: "deepseek-v4-flash" },
  openai: { label: "OpenAI", model: "gpt-4o-mini" },
  gemini: { label: "Gemini", model: "gemini-2.0-flash" },
};

export default function Home() {
  const [trips, setTrips] = useState([]);
  const [view, setView] = useState("home");
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("overview");
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [aiProvider, setAiProvider] = useState("deepseek");
  const [user, setUser] = useState(null);
  const [cloudState, setCloudState] = useState("local");
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const cloudUnsubscribe = useRef(null);
  const deletedIds = useRef(new Set());
  const autoAuthAttempted = useRef(false);

  const toast = (message, kind = "success") => setNotice({ message, kind });

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(saved?.trips)) {
        setTrips(saved.trips);
        setSelectedId(saved.selectedId || saved.trips[0]?.id || null);
      }
    } catch {
      setNotice({ message: "Data lokal lama tidak dapat dibaca. Serenity memulai ruang kerja baru.", kind: "error" });
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify({ trips, selectedId }));
  }, [hydrated, trips, selectedId]);

  useEffect(() => watchAuth(async (currentUser) => {
    cloudUnsubscribe.current?.();
    cloudUnsubscribe.current = null;
    setUser(currentUser);
    setCloudReady(false);
    setCloudError("");
    if (!currentUser) {
      setCloudState("local");
      if (!autoAuthAttempted.current) {
        autoAuthAttempted.current = true;
        setCloudState("connecting");
        signInToCloud().catch((error) => {
          setCloudState("error");
          setCloudError(authMessage(error));
        });
      }
      return;
    }
    const previousUid = localStorage.getItem(CLOUD_UID_KEY);
    if (previousUid && previousUid !== currentUser.uid) {
      setTrips([]);
      setSelectedId(null);
      setView("home");
    }
    localStorage.setItem(CLOUD_UID_KEY, currentUser.uid);
    setCloudState("connecting");
    try {
      await bootstrapWorkspace(currentUser);
      setCloudReady(true);
      setCloudState(navigator.onLine ? "synced" : "offline");
      loadProviderKeyFromCloud(currentUser.uid, aiProvider).then((cloudKey) => { if (cloudKey) setApiKey(cloudKey); });
      cloudUnsubscribe.current = watchCloudTrips(currentUser.uid, (cloudTrips) => {
        setTrips((localTrips) => {
          const merged = [...localTrips];
          cloudTrips.filter((cloud) => !deletedIds.current.has(cloud.id)).forEach((cloud) => {
            const index = merged.findIndex((local) => local.id === cloud.id);
            if (index < 0) merged.push(cloud);
            else if ((cloud.updatedAt || "") > (merged[index].updatedAt || "")) merged[index] = { ...cloud, photo: merged[index].photo || null };
          });
          return merged;
        });
        setCloudState(navigator.onLine ? "synced" : "offline");
      }, (error) => {
        setCloudState("error");
        setCloudError(cloudMessage(error));
      });
    } catch (error) {
      setCloudState("error");
      setCloudError(cloudMessage(error));
    }
  }), []);

  useEffect(() => () => cloudUnsubscribe.current?.(), []);

  useEffect(() => {
    if (!cloudReady || !user || !hydrated) return undefined;
    setCloudState(navigator.onLine ? "saving" : "offline");
    const timer = setTimeout(async () => {
      try {
        await Promise.all(trips.map((trip) => saveCloudTrip(user.uid, trip)));
        setCloudState(navigator.onLine ? "synced" : "offline");
        setCloudError("");
      } catch (error) {
        setCloudState(navigator.onLine ? "error" : "offline");
        setCloudError(cloudMessage(error));
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [trips, cloudReady, user, hydrated]);

  useEffect(() => {
    const online = () => setCloudState(user ? "saving" : "local");
    const offline = () => setCloudState("offline");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, [user]);

  useEffect(() => {
    let active = true;
    setApiKey("");
    loadProviderKey(aiProvider)
      .then((savedKey) => { if (active) setApiKey(savedKey); })
      .catch(() => { if (active) toast("Kunci tersimpan tidak dapat dibuka pada perangkat ini.", "error"); });
    return () => { active = false; };
  }, [aiProvider]);

  const selected = trips.find((trip) => trip.id === selectedId);
  const nav = (target) => setView(target);
  const openTrip = (id) => { setSelectedId(id); setTab("overview"); setView("detail"); };
  const updateTrip = (update) => setTrips((current) => current.map((trip) => trip.id === selectedId ? { ...trip, ...update, updatedAt: new Date().toISOString() } : trip));
  const addTrip = (trip) => { setTrips((current) => [trip, ...current]); setSelectedId(trip.id); setTab("overview"); setView("detail"); };
  const removeTrip = async (trip) => {
    if (!window.confirm(`Hapus "${trip.title}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    deletedIds.current.add(trip.id);
    setTrips((current) => current.filter((item) => item.id !== trip.id));
    setSelectedId(null);
    setView("home");
    if (cloudReady && user) {
      try { await deleteCloudTrip(user.uid, trip.id); } catch (error) { toast(`Terhapus lokal, tetapi cloud gagal: ${cloudMessage(error)}`, "error"); return; }
    }
    toast("Itinerary dihapus.");
  };

  return (
    <main className="shell">
      <Sidebar view={view} trips={trips} nav={nav} openTrip={openTrip} cloudState={cloudState} />
      <section className="content">
        <Topbar view={view} selected={selected} cloudState={cloudState} user={user} />
        {cloudError && <Status message={cloudError} kind="error" onClose={() => setCloudError("")} />}
        {notice && <Status {...notice} onClose={() => setNotice(null)} />}
        {!hydrated && <Loading />}
        {hydrated && view === "home" && <Dashboard trips={trips} openTrip={openTrip} create={() => nav("new")} />}
        {hydrated && view === "new" && <TripCreator apiKey={apiKey} provider={aiProvider} addTrip={addTrip} cancel={() => nav("home")} toast={toast} />}
        {hydrated && view === "detail" && selected && <TripDetail trip={selected} tab={tab} setTab={setTab} updateTrip={updateTrip} removeTrip={removeTrip} toast={toast} cloudReady={cloudReady} />}
        {hydrated && view === "detail" && !selected && <Empty title="Itinerary tidak ditemukan" text="Pilih itinerary dari beranda atau buat rencana baru." action={() => nav("home")} actionText="Ke beranda" />}
        {hydrated && view === "settings" && <Settings apiKey={apiKey} setApiKey={setApiKey} provider={aiProvider} setProvider={setAiProvider} user={user} cloudState={cloudState} cloudReady={cloudReady} toast={toast} />}
      </section>
      <BottomNav nav={nav} openTrip={openTrip} selectedId={selectedId} trips={trips} />
    </main>
  );
}

function cloudMessage(error) {
  if (error?.code === "permission-denied") return "Cloud menolak akses. Periksa bahwa Anonymous Auth aktif dan aturan workspace mengizinkan anggota.";
  if (error?.code === "unavailable") return "Cloud tidak tersedia. Perubahan tetap aman di perangkat dan akan dicoba lagi.";
  return `Sinkronisasi cloud gagal: ${error?.message || "kesalahan tidak dikenal"}`;
}

function Sidebar({ view, trips, nav, openTrip, cloudState }) {
  return <aside className="sidebar">
    <button className="brand" onClick={() => nav("home")}><b>S</b><span>Serenity<small>ITINERARY</small></span></button>
    <button className="primary wide" onClick={() => nav("new")}><span aria-hidden="true">＋</span> Buat itinerary</button>
    <nav aria-label="Navigasi utama">
      <button className={view === "home" ? "active" : ""} onClick={() => nav("home")}><Icon>⌂</Icon> Beranda</button>
      <button className={view === "detail" ? "active" : ""} onClick={() => trips[0] ? openTrip(trips[0].id) : nav("new")}><Icon>≡</Icon> Itinerary <span className="count">{trips.length}</span></button>
      <button className={view === "settings" ? "active" : ""} onClick={() => nav("settings")}><Icon>⚙</Icon> Pengaturan</button>
    </nav>
    <div className="sync-card"><i className={cloudState} /><div><strong>{syncLabel(cloudState)}</strong><small>{cloudState === "local" ? "Simpan perjalanan ke cloud" : "Workspace pribadi"}</small></div>{cloudState === "local" && <button className="sync-login" onClick={() => window.location.href = "/login"}>Login</button>}</div>
  </aside>;
}

function Icon({ children }) { return <span className="nav-icon" aria-hidden="true">{children}</span>; }
function syncLabel(state) { return ({ local: "Mode lokal", connecting: "Menyiapkan cloud", saving: "Menyimpan...", synced: "Cloud tersinkron", offline: "Offline · lokal aman", error: "Cloud bermasalah" })[state] || state; }

function Topbar({ view, selected, cloudState, user }) {
  const title = view === "home" ? "Rencanakan dengan tenang." : view === "new" ? "Perjalanan baru" : view === "settings" ? "Pengaturan" : selected?.title || "Itinerary";
  return <header className="topbar"><div><p className="eyebrow">SERENITY ATLAS</p><h1>{title}</h1></div><div className={`cloud-state ${cloudState}`}><i /><span>{user ? "Workspace anonim" : "Penyimpanan lokal"}<strong>{syncLabel(cloudState)}</strong></span></div></header>;
}

function Status({ message, kind = "success", onClose }) { return <div className={`notice-bar ${kind}`} role={kind === "error" ? "alert" : "status"}><span>{message}</span><button onClick={onClose} aria-label="Tutup pemberitahuan">×</button></div>; }
function Loading() { return <div className="loading card" role="status"><i /><strong>Membuka atlas perjalanan...</strong></div>; }
function Empty({ title, text, action, actionText }) { return <div className="empty card"><span className="empty-mark">S</span><h2>{title}</h2><p>{text}</p><button className="primary" onClick={action}>{actionText}</button></div>; }

function Dashboard({ trips, openTrip, create }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const today = new Date().toISOString().slice(0, 10);
  const shown = trips.filter((trip) => {
    const match = `${trip.title} ${trip.origin} ${trip.destination}`.toLowerCase().includes(query.toLowerCase());
    const state = trip.endDate < today ? "past" : "upcoming";
    return match && (filter === "all" || filter === state);
  });
  const openTasks = trips.reduce((sum, trip) => sum + trip.tasks.filter((task) => !task.done).length, 0);
  return <>
    <section className="hero">
      <div><p className="eyebrow light">WORKSPACE PRIBADI</p><h2>Perjalanan yang rapi,<br />dari niat hingga pulang.</h2><p>Susun agenda, biaya, dan hal kecil yang tidak boleh tertinggal.</p><button className="secondary" onClick={create}>Mulai merancang <span>→</span></button></div>
      <div className="atlas-art" aria-hidden="true"><span>JKT</span><i /><b>GO</b><em>07°48′S</em></div>
    </section>
    <section className="metrics">
      <article><span className="metric-icon">↗</span><strong>{trips.length}</strong><small>Rencana tersimpan</small></article>
      <article><span className="metric-icon">✓</span><strong>{openTasks}</strong><small>Tugas terbuka</small></article>
      <article><span className="metric-icon">Rp</span><strong>{rupiah(trips.reduce((sum, trip) => sum + Number(trip.budget || 0), 0))}</strong><small>Total anggaran</small></article>
    </section>
    <section className="section-heading"><div><p className="eyebrow">KOLEKSI ANDA</p><h2>Itinerary terbaru</h2></div><button className="text-button" onClick={create}>＋ Rencana baru</button></section>
    {trips.length > 0 && <div className="filters"><label className="search"><span aria-hidden="true">⌕</span><input aria-label="Cari itinerary" placeholder="Cari tujuan atau judul..." value={query} onChange={(event) => setQuery(event.target.value)} /></label><label><span className="sr-only">Filter perjalanan</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Semua perjalanan</option><option value="upcoming">Akan datang</option><option value="past">Selesai</option></select></label></div>}
    {!trips.length ? <Empty title="Atlas Anda masih kosong" text="Mulai dari template lokal atau hubungkan DeepSeek untuk membuat draft terstruktur." action={create} actionText="Buat itinerary pertama" /> : !shown.length ? <div className="no-results">Tidak ada itinerary yang cocok dengan pencarian ini.</div> : <div className="trip-grid">{shown.map((trip, index) => <TripCard key={trip.id} trip={trip} index={index} openTrip={openTrip} />)}</div>}
  </>;
}

function TripCard({ trip, index, openTrip }) {
  const done = trip.tasks.filter((task) => task.done).length;
  return <button className={`trip-card tone-${index % 3}`} onClick={() => openTrip(trip.id)}>
    <span className="trip-index">0{index + 1}</span><span className="trip-monogram">{trip.destination?.slice(0, 2).toUpperCase()}</span>
    <div className="trip-copy"><span className="badge">{trip.source === "ai" ? "DRAFT AI" : "TEMPLATE LOKAL"}</span><h3>{trip.title}</h3><p>{trip.origin} <span>→</span> {trip.destination}</p><small>{dateLabel(trip.startDate)} · {trip.people} orang</small></div>
    <div className="trip-progress"><span>{done}/{trip.tasks.length} tugas</span><i><b style={{ width: `${trip.tasks.length ? done / trip.tasks.length * 100 : 0}%` }} /></i></div>
  </button>;
}

const INDONESIAN_CITIES = [
  "Jakarta", "Bandung", "Surabaya", "Yogyakarta", "Semarang", "Medan", "Makassar",
  "Palembang", "Denpasar", "Bali", "Malang", "Solo", "Batam", "Padang", "Pekanbaru",
  "Balikpapan", "Banjarmasin", "Manado", "Pontianak", "Samarinda", "Lombok", "Bogor",
  "Depok", "Tangerang", "Bekasi", "Labuan Bajo", "Raja Ampat", "Bandar Lampung",
  "Jambi", "Ambon", "Jayapura", "Aceh", "Banda Aceh", "Kupang", "Mataram",
  "Manokwari", "Sorong", "Ternate", "Palu", "Kendari", "Gorontalo", "Mamuju",
  "Tanjung Pinang", "Pangkal Pinang", "Bengkulu", "Palangkaraya", "Tarakan",
  "Tanjung Selor", "Cirebon", "Tasikmalaya", "Purwokerto", "Magelang", "Salatiga",
  "Batu", "Kediri", "Madiun", "Probolinggo", "Banyuwangi", "Jember", "Garut", "Sukabumi",
];
function CityAutocomplete({ value, onChange, placeholder }) {
  const [input, setInput] = useState(value || "");
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  const filtered = INDONESIAN_CITIES.filter((c) => c.toLowerCase().includes(input.toLowerCase())).slice(0, 5);
  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setShow(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  return <div ref={ref} className="city-autocomplete"><input type="text" value={input} onChange={(e) => { setInput(e.target.value); setShow(true); }} onFocus={() => setShow(true)} placeholder={placeholder} /><button type="button" className="clear-input" onClick={() => { setInput(""); onChange(""); }} hidden={!input}>&times;</button>{show && input && filtered.length > 0 && <ul className="city-suggestions">{filtered.map((c) => <li key={c} onMouseDown={() => { setInput(c); onChange(c); setShow(false); }}>{c}</li>)}</ul>}</div>;
}

const formatBudget = (value) => {
  const num = String(value || "").replace(/[^0-9]/g, "");
  if (!num) return "";
  return Number(num).toLocaleString("id-ID");
};

function TripCreator({ apiKey, provider, addTrip, cancel, toast }) {
  const [form, setForm] = useState({ ...blankTrip });
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const field = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const makeLocal = (event) => {
    event.preventDefault();
    const message = validateTrip(form);
    if (message) { setError(message); return; }
    addTrip(createTemplate(form));
    toast("Template deterministik dibuat secara lokal. Tidak ada AI yang dipanggil.");
  };
  const makeAi = async () => {
    const message = validateTrip(form);
    if (message) { setError(message); return; }
    if (!apiKey) { setError(`Masukkan dan simpan kunci API ${AI_PROVIDERS[provider].label} di Pengaturan.`); return; }
    setGenerating(true); setError("");
    try {
      const response = await fetch("/api/ai/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, apiKey, brief: form }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Generasi gagal.");
      addTrip({ ...createTemplate(form), ...result, source: "ai" });
      toast(`Draft ${AI_PROVIDERS[provider].label} selesai. Verifikasi jadwal, harga, dan detail keselamatan.`);
    } catch (fetchError) { setError(fetchError.message); } finally { setGenerating(false); }
  };
  return <form className="wizard card" onSubmit={makeLocal}>
    <div className="wizard-head"><div><p className="eyebrow">BRIEF PERJALANAN</p><h2>Berikan rute sebuah cerita.</h2></div><span className="step">01 / 01</span></div>
    <p className="lead">Isi detail inti. Pilih template lokal yang deterministik atau buat draft AI dengan provider aktif dan kunci dari memori halaman ini.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-grid">
      <label>Kota asal<CityAutocomplete value={form.origin} onChange={(value) => field("origin", value)} placeholder="Cari kota asal..." /></label>
      <label>Tujuan<CityAutocomplete value={form.destination} onChange={(value) => field("destination", value)} placeholder="Cari kota tujuan..." /></label>
      <Field label="Tanggal mulai" type="date" value={form.startDate} onChange={(value) => field("startDate", value)} required />
      <Field label="Tanggal selesai" type="date" min={form.startDate} value={form.endDate} onChange={(value) => field("endDate", value)} required />
      <Field label="Jumlah orang" type="number" min="1" step="1" value={form.people} onChange={(value) => field("people", value)} required />
      <label>Jenis perjalanan<input list="purpose-list" value={form.purpose} onChange={(event) => field("purpose", event.target.value)} placeholder="Mis. Leisure, Bisnis, atau ketik sendiri..." /><datalist id="purpose-list"><option value="Leisure" /><option value="Bisnis" /><option value="Keluarga" /><option value="Backpacker" /><option value="Honeymoon" /><option value="Retreat" /><option value="Study tour" /><option value="Adventure" /><option value="Kuliner" /><option value="Budaya & Sejarah" /></datalist></label>
      <label>Anggaran total (IDR)<input type="text" inputMode="numeric" value={formatBudget(form.budget)} onChange={(event) => { const raw = event.target.value.replace(/[^0-9]/g, ""); field("budget", raw); }} placeholder="Mis. 5.000.000" required /></label>
    </div>
    <div className="ai-choice"><span className="spark">✦</span><div><strong>{AI_PROVIDERS[provider].label} · {AI_PROVIDERS[provider].model}</strong><p>{apiKey ? "Kunci tersedia hanya selama halaman ini terbuka." : "Belum ada kunci di memori. Template lokal tetap tersedia."}</p></div></div>
    <footer><button type="button" className="quiet" onClick={cancel}>Batal</button><button type="submit" className="outline">Gunakan template lokal</button><button type="button" className="primary" onClick={makeAi} disabled={generating}>{generating ? "Menyusun draft..." : `Buat dengan ${AI_PROVIDERS[provider].label}`}</button></footer>
  </form>;
}

function Field({ label, value, onChange, ...props }) { return <label>{label}<input value={value} onChange={(event) => onChange(event.target.value)} {...props} /></label>; }

function TripDetail({ trip, tab, setTab, updateTrip, removeTrip, toast, cloudReady }) {
  const [modal, setModal] = useState(null);
  const [compressing, setCompressing] = useState(false);
  const photoInput = useRef(null);
  const spent = trip.expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const completed = trip.tasks.filter((task) => task.done).length;
  const updateList = (key, list) => updateTrip({ [key]: list });
  const removeItem = (key, id, label) => {
    if (window.confirm(`Hapus ${label} ini?`)) updateList(key, trip[key].filter((item) => item.id !== id));
  };
  const saveItem = (key, item) => {
    const exists = trip[key].some((current) => current.id === item.id);
    updateList(key, exists ? trip[key].map((current) => current.id === item.id ? item : current) : [...trip[key], item]);
    setModal(null);
  };
  const selectPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    try {
      const photo = await compressPhotoForFirestore(file);
      updateTrip({ photo });
      toast(`Foto dikompresi menjadi ${Math.round(photo.sizeBytes / 1024)} KB${cloudReady ? " dan akan disinkronkan ke Firestore." : " dan disimpan lokal sampai cloud diaktifkan."}`);
    } catch (error) { toast(error.message, "error"); } finally { setCompressing(false); event.target.value = ""; }
  };
  return <>
    <section className="detail-hero">
      <div className="detail-photo">{trip.photo?.photoData ? <img src={trip.photo.photoData} alt={`Foto ${trip.destination}`} /> : <span>{trip.destination?.slice(0, 2).toUpperCase()}</span>}<button onClick={() => photoInput.current?.click()} disabled={compressing}>{compressing ? "..." : "＋ Foto"}</button><input ref={photoInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} /></div>
      <div className="detail-copy"><span className="badge coral">{trip.source === "ai" ? "DRAFT AI · PERLU VERIFIKASI" : "TEMPLATE LOKAL"}</span><h2>{trip.title}</h2><p>{trip.origin} <b>→</b> {trip.destination}</p><small>{dateLabel(trip.startDate)} – {dateLabel(trip.endDate)} · {trip.people} orang</small><span className="local-photo-note">Foto WebP maksimal 300 KB ikut tersinkron saat cloud aktif.</span></div>
      <div className="detail-actions"><button className="light-button" onClick={() => setModal({ type: "trip", item: trip })}>Edit detail</button><button className="light-button" onClick={() => window.print()}>Cetak / PDF</button><button className="danger-light" onClick={() => removeTrip(trip)}>Hapus</button></div>
    </section>
    <div className="tabs" role="tablist" aria-label="Bagian itinerary">{tabs.map(([key, label]) => <button role="tab" aria-selected={tab === key} key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}</div>
    {tab === "overview" && <Overview trip={trip} spent={spent} completed={completed} setTab={setTab} />}
    {tab === "rundown" && <Rundown trip={trip} setModal={setModal} removeItem={removeItem} updateTrip={updateTrip} toast={toast} />}
    {tab === "budget" && <Budget trip={trip} spent={spent} setModal={setModal} removeItem={removeItem} />}
    {tab === "checklist" && <Checklist trip={trip} completed={completed} updateList={updateList} setModal={setModal} removeItem={removeItem} />}
    <PrintSheet trip={trip} spent={spent} />
    {modal && <EditorModal modal={modal} close={() => setModal(null)} saveItem={saveItem} updateTrip={updateTrip} />}
  </>;
}

function PrintSheet({ trip, spent }) {
  return <section className="print-sheet">
    <h2>Rundown</h2>
    {trip.activities.map((item) => <article key={item.id}><b>{item.day} · {item.time}</b><div><strong>{item.title}</strong><p>{item.note}</p></div></article>)}
    <h2>Anggaran</h2>
    <table><thead><tr><th>Kategori</th><th>Jumlah</th></tr></thead><tbody>{trip.expenses.map((item) => <tr key={item.id}><td>{item.category}</td><td>{rupiah(item.amount)}</td></tr>)}<tr><th>Total</th><th>{rupiah(spent)}</th></tr></tbody></table>
    <h2>Checklist</h2>
    <ul>{trip.tasks.map((task) => <li key={task.id}>{task.done ? "[x]" : "[ ]"} {task.title}</li>)}</ul>
    <p className="print-disclaimer">Draft perjalanan. Verifikasi kembali jadwal, biaya, kesehatan, visa, dan informasi keselamatan sebelum berangkat.</p>
  </section>;
}

function Overview({ trip, spent, completed, setTab }) {
  const remaining = Number(trip.budget) - spent;
  const doneActs = trip.activities.filter((a) => a.done).length;
  const actProgress = trip.activities.length ? Math.round(doneActs / trip.activities.length * 100) : 0;
  return <section className="overview-grid">
    <article className="card stat-card"><p className="eyebrow">ANGGARAN TERPAKAI</p><strong>{rupiah(spent)}</strong><p className={remaining < 0 ? "negative" : ""}>{remaining < 0 ? `${rupiah(Math.abs(remaining))} melebihi batas` : `${rupiah(remaining)} tersisa`}</p><div className="bar"><i style={{ width: `${Math.min(100, spent / Number(trip.budget || 1) * 100)}%` }} /></div><button className="text-button" onClick={() => setTab("budget")}>Lihat rincian →</button></article>
    <article className="card stat-card"><p className="eyebrow">KESIAPAN CHECKLIST</p><strong>{completed}<small> / {trip.tasks.length}</small></strong><p>Tugas selesai</p><div className="bar pine"><i style={{ width: `${trip.tasks.length ? completed / trip.tasks.length * 100 : 0}%` }} /></div><button className="text-button" onClick={() => setTab("checklist")}>Buka checklist →</button></article>
    <article className="card stat-card"><p className="eyebrow">PROGRES TIMELINE</p><strong>{doneActs}<small> / {trip.activities.length}</small></strong><p>Aktivitas selesai ({actProgress}%)</p><div className="bar coral"><i style={{ width: `${actProgress}%` }} /></div><button className="text-button" onClick={() => setTab("rundown")}>Lihat timeline →</button></article>
    <article className="card next-card"><p className="eyebrow">AGENDA PERTAMA</p>{trip.activities[0] ? <><span>{trip.activities[0].day} · {trip.activities[0].time}</span><h3>{trip.activities[0].title}</h3><p>{trip.activities[0].note}</p></> : <p>Belum ada aktivitas.</p>}<button className="text-button" onClick={() => setTab("rundown")}>Lihat timeline →</button></article>
  </section>;
}

function Rundown({ trip, setModal, removeItem, updateTrip, toast, compressing }) {
  const photoRefs = useRef({});
  const [expandedPhotos, setExpandedPhotos] = useState({});
  const now = new Date();
  const tripStart = new Date(`${trip.startDate}T00:00:00`);
  const doneActivities = trip.activities.filter((a) => a.done).length;
  const progress = trip.activities.length ? Math.round(doneActivities / trip.activities.length * 100) : 0;
  
  const toggleDone = (id) => {
    const updated = trip.activities.map((a) => a.id === id ? { ...a, done: !a.done } : a);
    updateTrip({ activities: updated });
  };

  const uploadPhoto = async (activityId, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const photo = await compressPhotoForFirestore(file);
      const updated = trip.activities.map((a) => {
        if (a.id !== activityId) return a;
        const photos = a.photos || [];
        return { ...a, photos: [...photos, { ...photo, id: crypto.randomUUID(), uploadedAt: new Date().toISOString() }] };
      });
      updateTrip({ activities: updated });
      toast(`Foto dikompresi ${Math.round(photo.sizeBytes / 1024)} KB`);
    } catch (error) { toast(error.message, "error"); }
    event.target.value = "";
  };

  const toggleExpandPhotos = (activityId) => {
    setExpandedPhotos((prev) => ({ ...prev, [activityId]: !prev[activityId] }));
  };

  const getStatus = (activity) => {
    if (activity.done) return { label: "Selesai", cls: "done" };
    const dayNum = Math.max(1, Number(activity.day?.match(/\d+/)?.[0] || 1));
    const [h, m] = String(activity.time || "09:00").split(":").map(Number);
    const actDate = new Date(tripStart);
    actDate.setDate(actDate.getDate() + dayNum - 1);
    actDate.setHours(h || 9, m || 0, 0, 0);
    if (actDate < now) return { label: "Terlambat", cls: "late" };
    const diffMs = actDate - now;
    const diffHrs = diffMs / 3600000;
    if (diffHrs <= 2) return { label: `Dalam ${Math.round(diffHrs * 60)} menit`, cls: "soon" };
    return { label: "Mendatang", cls: "upcoming" };
  };

  return <section className="panel">
    <PanelHead eyebrow="ALUR PERJALANAN" title="Rundown" action="＋ Tambah aktivitas" onAction={() => setModal({ type: "activity", item: null })} />
    <div className="export-row"><button className="quiet" onClick={() => downloadIcs(trip)}>Ekspor kalender .ics</button></div>
    {trip.activities.length > 0 && <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /><span>{doneActivities}/{trip.activities.length} selesai ({progress}%)</span></div>}
    {!trip.activities.length ? <p className="panel-empty">Belum ada aktivitas.</p> : <div className="timeline">{trip.activities.map((item) => {
      const status = getStatus(item);
      const isExpanded = expandedPhotos[item.id];
      const photoCount = (item.photos || []).length;
      return <article key={item.id} className={`timeline-item ${item.done ? "completed" : ""}`}>
        <div className="timeline-time"><b>{item.time}</b><span>{item.day}</span><span className={`status-badge ${status.cls}`}>{status.label}</span></div>
        <i className={`timeline-dot ${item.done ? "done" : ""}`} onClick={() => toggleDone(item.id)} title={item.done ? "Tandai belum selesai" : "Tandai selesai"} />
        <div className="timeline-card card">
          <h3>{item.title}</h3>
          <p>{item.note || "Tanpa catatan"}</p>
          {(item.photos && item.photos.length > 0) && <div className="activity-photos">
            <img src={item.photos[0].photoData} alt={`Foto ${item.title}`} className="photo-thumb" onClick={() => toggleExpandPhotos(item.id)} />
            {photoCount > 1 && <span className="photo-count" onClick={() => toggleExpandPhotos(item.id)}>+{photoCount - 1}</span>}
            {isExpanded && <div className="photo-gallery">
              {item.photos.map((p) => <img key={p.id} src={p.photoData} alt={`Foto aktivitas`} />)}
              <button className="quiet" onClick={() => toggleExpandPhotos(item.id)}>Tutup galeri</button>
            </div>}
          </div>}
          <div className="timeline-actions">
            <button className="mini" onClick={() => setModal({ type: "activity", item })}>Edit</button>
            <label className="mini photo-upload">📷 Foto<input ref={(el) => { if (el) photoRefs.current[item.id] = el; }} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => uploadPhoto(item.id, e)} /></label>
            <button className="mini danger" onClick={() => removeItem("activities", item.id, "aktivitas")}>Hapus</button>
          </div>
        </div>
      </article>;
    })}</div>}
  </section>;
}

function Budget({ trip, spent, setModal, removeItem }) {
  return <section className="panel"><PanelHead eyebrow="ESTIMASI BIAYA" title={rupiah(spent)} action="＋ Tambah biaya" onAction={() => setModal({ type: "expense", item: null })} /><div className="budget-summary"><span>Rencana <strong>{rupiah(trip.budget)}</strong></span><span>Selisih <strong className={spent > trip.budget ? "negative" : ""}>{rupiah(Number(trip.budget) - spent)}</strong></span></div>{!trip.expenses.length ? <p className="panel-empty">Belum ada biaya.</p> : <div className="data-list">{trip.expenses.map((item) => <article key={item.id}><span>{item.category.slice(0, 1)}</span><strong>{item.category}</strong><b>{rupiah(item.amount)}</b><button className="mini" onClick={() => setModal({ type: "expense", item })}>Edit</button><button className="mini danger" onClick={() => removeItem("expenses", item.id, "biaya")}>Hapus</button></article>)}</div>}</section>;
}

function Checklist({ trip, updateList, setModal, removeItem }) {
  const toggle = (id) => updateList("tasks", trip.tasks.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  const done = trip.tasks.filter((t) => t.done).length;
  const total = trip.tasks.length;
  const progress = total ? Math.round(done / total * 100) : 0;
  const categories = [...new Set(trip.tasks.map((t) => t.category || "Umum"))];
  return <section className="panel">
    <PanelHead eyebrow="PERSIAPAN & TUGAS" title={`${done}/${total} tugas selesai`} action="＋ Tambah tugas" onAction={() => setModal({ type: "task", item: null })} />
    {total > 0 && <div className="progress-bar checklist-progress"><div className="progress-fill" style={{ width: `${progress}%` }} /><span>{progress}% siap — {total - done} tugas tersisa</span></div>}
    {!total ? <p className="panel-empty">Belum ada tugas. AI akan menghasilkan checklist lengkap.</p> : categories.map((cat) => {
      const catTasks = trip.tasks.filter((t) => (t.category || "Umum") === cat);
      const catDone = catTasks.filter((t) => t.done).length;
      return <div key={cat} className="checklist-group">
        <h4 className="checklist-category">{cat} <small>{catDone}/{catTasks.length}</small></h4>
        {catTasks.map((task) => <article key={task.id} className={task.done ? "done" : ""}><label><input type="checkbox" checked={task.done} onChange={() => toggle(task.id)} /><span>{task.title}</span></label><button className="mini" onClick={() => setModal({ type: "task", item: task })}>Edit</button><button className="mini danger" onClick={() => removeItem("tasks", task.id, "tugas")}>Hapus</button></article>)}
      </div>;
    })}
  </section>;
}

function PanelHead({ eyebrow, title, action, onAction }) { return <header className="panel-head"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button className="primary" onClick={onAction}>{action}</button></header>; }

function EditorModal({ modal, close, saveItem, updateTrip }) {
  const type = modal.type;
  const isTrip = type === "trip";
  const defaults = type === "activity" ? { day: "Hari 1", time: "09:00", title: "", note: "" } : type === "expense" ? { category: "", amount: "" } : type === "task" ? { title: "", done: false } : modal.item;
  const [data, setData] = useState({ ...defaults, ...(modal.item || {}) });
  const [error, setError] = useState("");
  const change = (name, value) => setData((current) => ({ ...current, [name]: value }));
  const submit = (event) => {
    event.preventDefault();
    if (isTrip) {
      const message = validateTrip(data);
      if (!data.title?.trim()) { setError("Judul wajib diisi."); return; }
      if (message) { setError(message); return; }
      updateTrip({ ...data, people: Number(data.people), budget: Number(data.budget) }); close(); return;
    }
    if (type === "activity" && !data.title.trim()) { setError("Judul aktivitas wajib diisi."); return; }
    if (type === "task" && !data.title.trim()) { setError("Nama tugas wajib diisi."); return; }
    if (type === "expense" && (!data.category.trim() || Number(data.amount) < 0 || data.amount === "")) { setError("Kategori wajib diisi dan jumlah tidak boleh negatif."); return; }
    saveItem(type === "activity" ? "activities" : type === "expense" ? "expenses" : "tasks", { ...data, id: data.id || crypto.randomUUID(), ...(type === "expense" ? { amount: Number(data.amount) } : {}) });
  };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="modal card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><div><p className="eyebrow">EDITOR</p><h2 id="modal-title">{isTrip ? "Edit detail perjalanan" : modal.item ? `Edit ${typeLabel(type)}` : `Tambah ${typeLabel(type)}`}</h2></div><button onClick={close} aria-label="Tutup dialog">×</button></header><form onSubmit={submit}>{error && <p className="form-error" role="alert">{error}</p>}{isTrip ? <div className="form-grid"><Field label="Judul" value={data.title} onChange={(v) => change("title", v)} required /><Field label="Asal" value={data.origin} onChange={(v) => change("origin", v)} required /><Field label="Tujuan" value={data.destination} onChange={(v) => change("destination", v)} required /><Field label="Mulai" type="date" value={data.startDate} onChange={(v) => change("startDate", v)} required /><Field label="Selesai" type="date" min={data.startDate} value={data.endDate} onChange={(v) => change("endDate", v)} required /><Field label="Orang" type="number" min="1" value={data.people} onChange={(v) => change("people", v)} required /><Field label="Anggaran" type="number" min="0" value={data.budget} onChange={(v) => change("budget", v)} required /></div> : type === "activity" ? <><div className="form-grid"><Field label="Hari" value={data.day} onChange={(v) => change("day", v)} required /><Field label="Waktu" type="time" value={data.time.replace(".", ":")} onChange={(v) => change("time", v)} required /></div><Field label="Aktivitas" value={data.title} onChange={(v) => change("title", v)} required /><label>Catatan<textarea value={data.note} onChange={(event) => change("note", event.target.value)} /></label></> : type === "expense" ? <><Field label="Kategori" value={data.category} onChange={(v) => change("category", v)} required /><Field label="Jumlah (IDR)" type="number" min="0" value={data.amount} onChange={(v) => change("amount", v)} required /></> : <Field label="Nama tugas" value={data.title} onChange={(v) => change("title", v)} required />}<footer><button type="button" className="quiet" onClick={close}>Batal</button><button className="primary">Simpan perubahan</button></footer></form></section></div>;
}

function typeLabel(type) { return ({ activity: "aktivitas", expense: "biaya", task: "tugas" })[type]; }

function Settings({ apiKey, setApiKey, provider, setProvider, user, cloudState, cloudReady, toast }) {
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
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
    if (!apiKey) { toast("Masukkan kunci API terlebih dahulu.", "error"); return; }
    setTesting(true);
    try {
      const response = await fetch("/api/ai/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test", provider, apiKey, brief: { origin: "Jakarta", destination: "Bandung", startDate: "2026-08-01", endDate: "2026-08-02", purpose: "Test", people: 1, budget: 1000000 } }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await saveProviderKey(provider, apiKey);
      if (user) await saveProviderKeyToCloud(user.uid, provider, apiKey);
      toast(`Koneksi ${AI_PROVIDERS[provider].label} berhasil. Kunci disimpan terenkripsi di perangkat ini.`);
    } catch (error) { toast(error.message || "Uji koneksi gagal.", "error"); } finally { setTesting(false); }
  };
  const rememberKey = async () => {
    if (!apiKey) { toast("Masukkan kunci API terlebih dahulu.", "error"); return; }
    setSavingKey(true);
    try { await saveProviderKey(provider, apiKey); if (user) await saveProviderKeyToCloud(user.uid, provider, apiKey); toast("Kunci API disimpan terenkripsi di perangkat ini."); }
    catch { toast("Browser tidak dapat menyimpan kunci terenkripsi.", "error"); }
    finally { setSavingKey(false); }
  };
  const clearKey = async () => {
    await deleteProviderKey(provider);
    setApiKey("");
    toast("Kunci dihapus dari memori dan penyimpanan terenkripsi.");
  };
  return <section className="settings-stack">
    <article className="settings card"><div className="settings-title"><span className="settings-number">01</span><div><p className="eyebrow">KECERDASAN BUATAN</p><h2>{AI_PROVIDERS[provider].label}</h2><p>Kunci dikirim hanya ke endpoint server Serenity lalu diteruskan ke provider terpilih. Kunci disimpan terenkripsi dengan Web Crypto pada perangkat ini dan tidak dikirim ke Firestore.</p></div></div><div className="settings-form"><label>Provider<select value={provider} onChange={(event) => { setProvider(event.target.value); setApiKey(""); }}><option value="deepseek">DeepSeek</option><option value="openai">OpenAI</option><option value="gemini">Gemini</option></select></label><label>Model<input value={AI_PROVIDERS[provider].model} readOnly /></label><label className="key-field">Kunci API<span><input type={showKey ? "text" : "password"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="off" placeholder={provider === "gemini" ? "AIza..." : "sk-..."} /><button type="button" onClick={() => setShowKey((value) => !value)}>{showKey ? "Sembunyikan" : "Lihat"}</button></span><small>Setelah disimpan atau koneksi berhasil, kunci tetap tersedia setelah refresh pada browser ini.</small></label><div className="button-row"><button className="primary" onClick={test} disabled={testing}>{testing ? "Menguji..." : "Uji koneksi"}</button><button className="outline" onClick={rememberKey} disabled={!apiKey || savingKey}>{savingKey ? "Menyimpan..." : "Simpan terenkripsi"}</button><button className="quiet" onClick={clearKey} disabled={!apiKey}>Hapus kunci</button></div></div></article>
    <article className="settings card"><div className="settings-title"><span className="settings-number">02</span><div><p className="eyebrow">CLOUD SYNC</p><h2>Workspace pribadi</h2><p>Akun email menjaga akses itinerary tetap tersedia di perangkat lain. Mode tamu tersedia untuk mencoba tanpa registrasi.</p></div></div>{user ? <div className="sync-setting"><div><span className={`state-dot ${cloudState}`} /><strong>{syncLabel(cloudState)}</strong><small>{user.isAnonymous ? `Mode tamu · ${user.uid.slice(0, 8)}…` : user.email}</small></div><button className="quiet" onClick={disconnect}>Keluar dari cloud</button></div> : <><button className="google-btn settings-google" onClick={async () => { try { await signInWithGoogle(); toast("Berhasil masuk dengan Google. Menyinkronkan workspace..."); } catch (error) { toast(authMessage(error), "error"); } }}><svg viewBox="0 0 48 48" width="18" height="18"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>Lanjutkan dengan Google</button><div className="divider"><span>atau</span></div><div className="auth-switch"><button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>Masuk</button><button className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>Buat akun</button></div><form className="settings-form auth-form" onSubmit={submitAccount}><Field label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} required /><Field label="Password" type="password" minLength="6" autoComplete={authMode === "register" ? "new-password" : "current-password"} value={password} onChange={setPassword} required /><div className="button-row"><button className="primary" disabled={authBusy}>{authBusy ? "Memproses..." : authMode === "register" ? "Buat akun & sinkronkan" : "Masuk & sinkronkan"}</button><button type="button" className="quiet" onClick={connect}>Coba sebagai tamu</button></div></form></>}{user && !cloudReady && <p className="form-error">Workspace belum siap. Tidak ada trip yang ditulis sebelum bootstrap selesai.</p>}</article>
    <article className="privacy card"><span>i</span><div><h3>Data & privasi</h3><p>Trip memiliki salinan lokal untuk akses offline dan otomatis tersinkron ke Firestore melalui akun tamu atau email. Foto WebP maksimal 300 KB ikut tersinkron. Kunci AI terenkripsi hanya pada perangkat ini dan tidak masuk Firestore. Output AI tetap perlu diverifikasi.</p></div></article>
  </section>;
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
  return messages[error?.code] || cloudMessage(error);
}

function BottomNav({ nav, openTrip, selectedId, trips }) { return <nav className="bottom-nav" aria-label="Navigasi mobile"><button onClick={() => nav("home")}><Icon>⌂</Icon>Beranda</button><button onClick={() => trips[0] ? openTrip(selectedId || trips[0].id) : nav("new")}><Icon>≡</Icon>Rencana</button><button className="fab" onClick={() => nav("new")} aria-label="Buat itinerary">＋</button><button onClick={() => nav("settings")}><Icon>⚙</Icon>Pengaturan</button></nav>; }
