'use client';
import { effectiveBudget, rupiah } from '../../lib/trips';

export function Overview({ trip, spent, completed, setTab, setModal }) {
  const budgetTotal = effectiveBudget(trip);
  const hasBudget = trip.budgetMode !== 'open' && Number(trip.budget || 0) > 0;
  const remaining = budgetTotal - spent;
  const activities = trip.activities || [];
  const tasks = trip.tasks || [];
  const doneActs = activities.filter((a) => a.done).length;
  const actProgress = activities.length ? Math.round(doneActs / activities.length * 100) : 0;
  const guide = trip.travelGuide || {};
  const highlights = trip.highlights?.length ? trip.highlights : trip.interests ? String(trip.interests).split(",").map((item) => item.trim()).filter(Boolean) : [];
  const pace = ({ relaxed: "Santai", balanced: "Seimbang", packed: "Padat" })[trip.travelPace] || "Fleksibel";
  const risks = (trip.risks || []).map((risk) => `${risk.title}${risk.mitigation ? ` · ${risk.mitigation}` : ""}`);
  const auditSections = [["Fakta", trip.facts], ["Asumsi", trip.assumptions], [trip.planType === "trip" ? "Verifikasi sebelum jalan" : "Verifikasi sebelum pelaksanaan", trip.verificationNotes], ["Konflik", trip.conflicts], ["Alternatif", trip.alternatives]].filter(([, items]) => items?.length);
  return <section className="overview-shell">
    <div className="overview-grid">
      <article className="card stat-card"><p className="eyebrow">ANGGARAN TERPAKAI · {trip.currency || 'IDR'}</p><strong>{rupiah(spent, trip.currency)}</strong><p className={hasBudget && remaining < 0 ? 'negative' : ''}>{!hasBudget ? 'Batas belum ditentukan' : remaining < 0 ? `${rupiah(Math.abs(remaining), trip.currency)} melebihi batas` : `${rupiah(remaining, trip.currency)} tersisa`}</p><div className="bar"><i style={{ width: `${hasBudget ? Math.min(100, spent / Math.max(1, budgetTotal) * 100) : 0}%` }} /></div><button className="text-button" onClick={() => setTab('budget')}>Lihat rincian →</button></article>
      <article className="card stat-card"><p className="eyebrow">KESIAPAN CHECKLIST</p><strong>{completed}<small> / {tasks.length}</small></strong><p>Tugas selesai</p><div className="bar pine"><i style={{ width: `${tasks.length ? completed / tasks.length * 100 : 0}%` }} /></div><button className="text-button" onClick={() => setTab('checklist')}>Buka checklist →</button></article>
      <article className="card stat-card"><p className="eyebrow">PROGRES TIMELINE</p><strong>{doneActs}<small> / {activities.length}</small></strong><p>Aktivitas selesai ({actProgress}%)</p><div className="bar coral"><i style={{ width: `${actProgress}%` }} /></div><button className="text-button" onClick={() => setTab('rundown')}>Lihat timeline →</button></article>
      <article className="card next-card"><p className="eyebrow">AGENDA PERTAMA</p>{activities[0] ? <><span>{activities[0].day} · {activities[0].time}</span><h3>{activities[0].title}</h3><p>{activities[0].note}</p></> : <p>Belum ada aktivitas.</p>}<button className="text-button" onClick={() => setTab('rundown')}>Lihat timeline →</button></article>
    </div>
    <article className="overview-summary card">
      <div className="overview-summary-head"><div><p className="eyebrow">RINGKASAN {trip.planType === 'trip' ? 'PERJALANAN' : 'KEGIATAN'}</p><h2>{trip.summary || `Rencana ${trip.purpose || "kegiatan"} ke ${trip.destination || trip.venue}`}</h2></div><button className="outline" onClick={() => setModal?.({ type: 'trip', item: trip })}>Edit konteks</button></div>
      {trip.recommendationNote && <p className="recommendation-note">{trip.recommendationNote}</p>}
      <div className="trip-facts"><span><b>Jenis</b>{trip.planTypeLabel || trip.planType || "Plan"}</span><span><b>Peserta</b>{trip.people} orang</span><span><b>Tempo</b>{pace}</span><span><b>Transport</b>{trip.transportPreference || "Campuran"}</span><span><b>Venue / tujuan</b>{trip.venue || trip.destination || "Belum ditentukan"}</span><span><b>Makanan</b>{trip.dietaryPreference || "Tidak ada pantangan"}</span></div>
      {highlights.length > 0 && <div className="highlight-list"><b>Fokus rencana</b>{highlights.map((item) => <span key={item}>{item}</span>)}</div>}
    </article>
    {auditSections.length > 0 && <div className="plan-audit-grid">{auditSections.map(([title, items]) => <article className="plan-audit-card card" key={title}><p className="eyebrow">{title}</p><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></article>)}</div>}
    <article className="plan-audit-card risk-register card"><div className="plan-audit-head"><p className="eyebrow">RISIKO & MITIGASI</p><button className="mini" onClick={() => setModal?.({ type: 'risk', item: null })}>＋ Tambah risiko</button></div>{risks.length > 0 ? <ul>{risks.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Belum ada risiko tercatat. Tambahkan risiko dan rencana mitigasinya.</p>}</article>
    <div className="guide-grid">{[["Transportasi", guide.transport, "↗"], ["Akomodasi", guide.accommodation, "⌂"], ["Makanan", guide.food, "◌"], ["Cuaca", guide.weather, "☼"], ["Keselamatan", guide.safety, "!"], ["Tips lokal", guide.tips, "✦"]].map(([title, text, icon]) => <article className="guide-card card" key={title}><span className="guide-icon">{icon}</span><div><p className="eyebrow">{title}</p><p>{text || "Belum ada catatan. Edit konteks untuk menambahkan."}</p></div></article>)}</div>
  </section>;
}
