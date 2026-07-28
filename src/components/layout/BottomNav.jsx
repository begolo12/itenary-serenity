'use client';
import { Icon } from '../common/Icon';

function BottomNav({ nav, openTrip, selectedId, trips, view }) {
  return (
    <nav className="bottom-nav" aria-label="Navigasi mobile">
      <button className={view === "home" ? "active" : ""} onClick={() => nav("home")}>
        <Icon>⌂</Icon>
        <span>Beranda</span>
      </button>
      <button className={view === "detail" ? "active" : ""} onClick={() => trips[0] ? openTrip(selectedId || trips[0].id) : nav("new")}>
        <Icon>≡</Icon>
        <span>Rencana</span>
      </button>
      <button className={`fab ${view === "new" ? "active" : ""}`} onClick={() => nav("new")} aria-label="Buat itinerary">
        <span>＋</span>
      </button>
       <button className={view === "calendar" ? "active" : ""} onClick={() => nav("calendar")}>
         <Icon>▦</Icon>
        <span>Kalender</span>
      </button>
      <button className={view === "settings" ? "active" : ""} onClick={() => nav("settings")}>
        <Icon>👤</Icon>
        <span>Akun</span>
      </button>
    </nav>
  );
}

export default BottomNav;
