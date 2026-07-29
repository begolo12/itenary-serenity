"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  bootstrapWorkspace, deleteCloudTrip, saveCloudTrip, flushCloudQueue,
  watchAuth, watchCloudTrips, watchCloudWorkspaces,
  cloudMessage, mergeCloudTrip,
} from "../lib/cloud-sync";
import { STORAGE_KEY } from "../lib/trips";
import { migratePlan } from "../lib/schemas/plan.js";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import BottomNav from "../components/layout/BottomNav";
import { Dashboard } from "../components/dashboard/Dashboard";
import TripCreator from "../components/trip/TripCreator";
import TripDetail from "../components/trip/TripDetail";
import CalendarView from "../components/trip/CalendarView";
import Settings from "../components/settings/Settings";
import { Empty } from "../components/common/Empty";
import { Status } from "../components/common/Status";

const CLOUD_UID_KEY = "serenity-itinerary-cloud-uid";
const ACTIVE_WORKSPACE_KEY = "serenity-itinerary-active-workspace";
const VALID_VIEWS = new Set(["home", "new", "detail", "settings", "calendar"]);

export default function Home() {
  const router = useRouter();
  const [trips, setTrips] = useState([]);
  const [view, setView] = useState("home");
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("overview");
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState(null);
  const [aiProvider, setAiProvider] = useState("deepseek");
  const [user, setUser] = useState(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [cloudState, setCloudState] = useState("local");
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [memberCode, setMemberCode] = useState("");
  const [workspaceTripsReady, setWorkspaceTripsReady] = useState(false);
  const cloudUnsubscribe = useRef(null);
  const workspaceUnsubscribe = useRef(null);
  const deletedIds = useRef(new Set());
  const persistedTripSignatures = useRef(new Map());
  const [pendingApproval, setPendingApproval] = useState(false);
  const pendingUnsubscribe = useRef(null);
  const activeWorkspaceRole = workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.role || "owner";
  const readOnly = activeWorkspaceRole === "viewer";

  const toast = (message, kind = "success") => setNotice({ message, kind });

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (VALID_VIEWS.has(saved?.view)) setView(saved.view);
      if (Array.isArray(saved?.trips)) {
        setTrips(saved.trips.map((trip) => migratePlan(trip)));
        setSelectedId(saved.selectedId || saved.trips[0]?.id || null);
      }
    } catch {
      setNotice({ message: "Data lokal lama tidak dapat dibaca. Serenity memulai ruang kerja baru.", kind: "error" });
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify({ trips, selectedId, view }));
  }, [hydrated, trips, selectedId, view]);

  useEffect(() => watchAuth(async (currentUser) => {
    cloudUnsubscribe.current?.();
    cloudUnsubscribe.current = null;
    workspaceUnsubscribe.current?.();
    workspaceUnsubscribe.current = null;
    setUser(currentUser);
    setCloudReady(false);
    setWorkspaceTripsReady(false);
    setWorkspaces([]);
    setActiveWorkspaceId(null);
    setMemberCode("");
    setCloudError("");
    if (!currentUser) {
      setCloudState("local");
      setAuthResolved(true);
      router.replace("/login");
      return;
    }
    setAuthResolved(true);
    const previousUid = localStorage.getItem(CLOUD_UID_KEY);
    if (previousUid && previousUid !== currentUser.uid) {
      setTrips([]);
      setSelectedId(null);
      setView("home");
    }
    localStorage.setItem(CLOUD_UID_KEY, currentUser.uid);
    setCloudState("connecting");
    try {
      const defaultWorkspace = await bootstrapWorkspace(currentUser);
      if (defaultWorkspace.pending) {
        setPendingApproval(true);
        setCloudReady(true);
        setCloudState("pending");
        pendingUnsubscribe.current = onSnapshot(doc(db, "users", currentUser.uid), (snap) => {
          const data = snap.data();
          if (data?.status === "approved") {
            window.location.reload();
          }
        });
        return;
      }
      setPendingApproval(false);
      setMemberCode(defaultWorkspace.memberCode || "");
      setCloudReady(true);
      setCloudState(navigator.onLine ? "synced" : "offline");
      workspaceUnsubscribe.current = watchCloudWorkspaces(currentUser.uid, (nextWorkspaces) => {
        setWorkspaces(nextWorkspaces);
        setActiveWorkspaceId((current) => {
          const stored = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
          if (current && nextWorkspaces.some((w) => w.id === current)) return current;
          if (stored && nextWorkspaces.some((w) => w.id === stored)) return stored;
          return nextWorkspaces[0]?.id || defaultWorkspace.id;
        });
      }, (error) => {
        setCloudState("error");
        setCloudError(cloudMessage(error));
      });
    } catch (error) {
      setCloudState("error");
      setCloudError(cloudMessage(error));
    }
  }), [router]);

  useEffect(() => () => {
    cloudUnsubscribe.current?.();
    workspaceUnsubscribe.current?.();
    pendingUnsubscribe.current?.();
  }, []);

  useEffect(() => {
    cloudUnsubscribe.current?.();
    cloudUnsubscribe.current = null;
    persistedTripSignatures.current.clear();
    if (!cloudReady || !user || !activeWorkspaceId) return undefined;
    setWorkspaceTripsReady(false);
    setTrips([]);
    setSelectedId(null);
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, activeWorkspaceId);
    cloudUnsubscribe.current = watchCloudTrips(activeWorkspaceId, (cloudTrips) => {
      const visibleTrips = cloudTrips.filter((t) => !deletedIds.current.has(t.id)).map((trip) => migratePlan(trip));
      visibleTrips.forEach((trip) => persistedTripSignatures.current.set(trip.id, JSON.stringify(trip)));
      setTrips(visibleTrips);
      setSelectedId((current) => visibleTrips.some((t) => t.id === current) ? current : visibleTrips[0]?.id || null);
      setWorkspaceTripsReady(true);
      setCloudState(navigator.onLine ? "synced" : "offline");
    }, (error) => {
      setWorkspaceTripsReady(false);
      setCloudState("error");
      setCloudError(cloudMessage(error));
    });
    return () => cloudUnsubscribe.current?.();
  }, [activeWorkspaceId, cloudReady, user]);
  useEffect(() => {
    if (!cloudReady || !user || !activeWorkspaceId || navigator.onLine === false) return undefined;
    flushCloudQueue(activeWorkspaceId, user.uid).then(({ conflicts }) => {
      if (conflicts.length) setCloudError(`Perubahan offline bentrok pada: ${conflicts.join(", ")}. Versi cloud dipertahankan.`);
    }).catch((error) => setCloudError(cloudMessage(error)));
    return undefined;
  }, [activeWorkspaceId, cloudReady, user]);
  useEffect(() => {
    if (readOnly || !cloudReady || !user || !activeWorkspaceId || !workspaceTripsReady || !hydrated) return undefined;
    const dirtyTrips = trips.filter((trip) => {
      const signature = JSON.stringify(trip);
      return persistedTripSignatures.current.get(trip.id) !== signature;
    });
    if (!dirtyTrips.length) return undefined;
    setCloudState(navigator.onLine ? "saving" : "offline");
    const timer = setTimeout(async () => {
      try {
        await Promise.all(dirtyTrips.map((trip) => saveCloudTrip(activeWorkspaceId, user.uid, trip)));
        dirtyTrips.forEach((trip) => persistedTripSignatures.current.set(trip.id, JSON.stringify(trip)));
        setCloudState(navigator.onLine ? "synced" : "offline");
        setCloudError("");
      } catch (error) {
        setCloudState(navigator.onLine ? "error" : "offline");
        setCloudError(error?.code === "cloud/conflict" ? `${error.message} Gunakan versi cloud atau simpan perubahan lagi.` : cloudMessage(error));
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [trips, activeWorkspaceId, cloudReady, user, hydrated, workspaceTripsReady, readOnly]);

  useEffect(() => {
    const online = async () => {
      if (!user || !activeWorkspaceId) { setCloudState(user ? "saving" : "local"); return; }
      try {
        const { conflicts } = await flushCloudQueue(activeWorkspaceId, user.uid);
        if (conflicts.length) setCloudError(`Perubahan offline bentrok pada: ${conflicts.join(", ")}. Versi cloud dipertahankan.`);
        setCloudState("synced");
      } catch (error) {
        setCloudState("error");
        setCloudError(cloudMessage(error));
      }
    };
    const offline = () => setCloudState("offline");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, [user, activeWorkspaceId]);

  // keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "1") { e.preventDefault(); nav("home"); }
        if (e.key === "2") { e.preventDefault(); nav("new"); }
        if (e.key === "3") { e.preventDefault(); nav("settings"); }
        if (e.key === "4") { e.preventDefault(); nav("calendar"); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const selected = trips.find((t) => t.id === selectedId);
  const nav = (target) => setView(target === "new" && readOnly ? "home" : target);
  const switchWorkspace = (workspaceId) => {
    if (!workspaces.some((w) => w.id === workspaceId)) return;
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
    setWorkspaceTripsReady(false);
    setActiveWorkspaceId(workspaceId);
    setSelectedId(null);
    if (view === "detail" || view === "new") setView("home");
  };
  const activateWorkspace = (workspace) => {
    if (!workspace?.id) return;
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspace.id);
    setWorkspaceTripsReady(false);
    setActiveWorkspaceId(workspace.id);
  };
  const openTrip = (id) => { setSelectedId(id); setTab("overview"); setView("detail"); };
  const updateTrip = (update) => { if (readOnly) return; setTrips((current) => current.map((t) => t.id === selectedId ? migratePlan({ ...t, ...update, updatedAt: new Date().toISOString() }) : t)); };
  const addTrip = (trip) => { if (readOnly) return; const normalized = migratePlan(trip); setTrips((current) => [normalized, ...current]); setSelectedId(normalized.id); setTab("overview"); setView("detail"); };
  const removeTrip = async (trip) => {
    if (readOnly) return;
    if (!window.confirm(`Hapus "${trip.title}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    deletedIds.current.add(trip.id);
    setTrips((current) => current.filter((item) => item.id !== trip.id));
    setSelectedId(null);
    setView("home");
    if (cloudReady && user) {
      try { await deleteCloudTrip(activeWorkspaceId, trip.id); } catch (error) { toast(`Terhapus lokal, tetapi cloud gagal: ${cloudMessage(error)}`, "error"); return; }
    }
    toast("Itinerary dihapus.");
  };

  if (pendingApproval) {
    return (
      <main className="auth-loading" aria-busy="true">
        <div className="loading-card">
          <h2>Akun menunggu persetujuan</h2>
          <p>Admin akan menyetujui akun Anda segera. Halaman ini akan otomatis memuat setelah disetujui.</p>
          <div className="loading"><i /><span>Menunggu persetujuan...</span></div>
        </div>
      </main>
    );
  }

  if (!authResolved || !user) {
    return (
      <main className="auth-loading" aria-busy="true">
        <div className="loading"><i /><span>Memeriksa sesi...</span></div>
      </main>
    );
  }

  return (
    <main className="shell">
      <Sidebar view={view} trips={trips} nav={nav} openTrip={openTrip} cloudState={cloudState} user={user} workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} switchWorkspace={switchWorkspace} />
      <section className="content">
        <Topbar view={view} selected={selected} cloudState={cloudState} user={user} workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} switchWorkspace={switchWorkspace} />
        {cloudError && <Status message={cloudError} kind="error" onClose={() => setCloudError("")} />}
        {notice && <Status {...notice} onClose={() => setNotice(null)} />}
        {!hydrated && <div className="skeleton-group"><div className="skeleton" style={{height: 345}} /><div className="skeleton" style={{height: 180}} /><div className="skeleton" style={{height: 180}} /></div>}
        {hydrated && view === "home" && <Dashboard trips={trips} openTrip={openTrip} create={() => nav("new")} />}
        {hydrated && view === "new" && <TripCreator provider={aiProvider} workspaceId={activeWorkspaceId} addTrip={addTrip} cancel={() => nav("home")} toast={toast} />}
        {hydrated && view === "detail" && selected && <TripDetail trip={selected} tab={tab} setTab={setTab} updateTrip={updateTrip} removeTrip={removeTrip} toast={toast} cloudReady={cloudReady} readOnly={readOnly} provider={aiProvider} workspaceId={activeWorkspaceId} user={user} />}
        {hydrated && view === "detail" && !selected && <Empty title="Itinerary tidak ditemukan" text="Pilih itinerary dari beranda atau buat rencana baru." action={() => nav("home")} actionText="Ke beranda" />}
        {hydrated && view === "settings" && <Settings provider={aiProvider} setProvider={setAiProvider} user={user} memberCode={memberCode} cloudState={cloudState} cloudReady={cloudReady} toast={toast} workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} switchWorkspace={switchWorkspace} activateWorkspace={activateWorkspace} />}
        {hydrated && view === "calendar" && <CalendarView trips={trips} openTrip={openTrip} create={() => nav("new")} />}
      </section>
      <BottomNav view={view} nav={nav} openTrip={openTrip} selectedId={selectedId} trips={trips} />
    </main>
  );
}
