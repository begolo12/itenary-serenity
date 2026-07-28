'use client';
import { WorkspacePicker } from '../common/WorkspacePicker';
import { Icon } from '../common/Icon';

function syncLabel(state) { return ({ local: "Mode lokal", connecting: "Menyiapkan cloud", saving: "Menyimpan...", synced: "Cloud tersinkron", offline: "Offline · lokal aman", error: "Cloud bermasalah" })[state] || state; }

function Sidebar({ view, trips, nav, openTrip, cloudState, user, workspaces, activeWorkspaceId, switchWorkspace }) {
  return <aside className="sidebar">
    <button className="brand" onClick={() => nav("home")}><b>S</b><span>Serenity<small>ITINERARY</small></span></button>
    <button className="primary wide" onClick={() => nav("new")}><span aria-hidden="true">＋</span> Buat itinerary</button>
    <nav aria-label="Navigasi utama">
      <button className={view === "home" ? "active" : ""} onClick={() => nav("home")}><Icon>⌂</Icon> Beranda</button>
      <button className={view === "detail" ? "active" : ""} onClick={() => trips[0] ? openTrip(trips[0].id) : nav("new")}><Icon>≡</Icon> Itinerary <span className="count">{trips.length}</span></button>
      <button className={view === "settings" ? "active" : ""} onClick={() => nav("settings")}><Icon>⚙</Icon> Pengaturan</button>
      <button className={view === "calendar" ? "active" : ""} onClick={() => nav("calendar")}><Icon>▦</Icon> Kalender</button>
    </nav>
    <div className="sidebar-footer">
      <WorkspacePicker workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} switchWorkspace={switchWorkspace} />
      <div className="sync-card">
        <i className={cloudState} />
        <div><strong>{syncLabel(cloudState)}</strong><small>{cloudState === "local" ? "Simpan perjalanan ke cloud" : "Sinkronisasi workspace"}</small></div>
        {!user && <button className="sync-login" onClick={() => window.location.href = "/login"}>Masuk</button>}
      </div>
    </div>
  </aside>;
}

export default Sidebar;

export { syncLabel };
