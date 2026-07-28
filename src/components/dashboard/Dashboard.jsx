"use client";
import { useState } from "react";
import { effectiveBudget, rupiah, dateLabel } from "../../lib/trips";
import { Empty } from "../common/Empty";

export function Dashboard({ trips, openTrip, create }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const today = new Date().toISOString().slice(0, 10);
  const shown = trips.filter((trip) => {
    const match = `${trip.title} ${trip.origin} ${trip.destination}`.toLowerCase().includes(query.toLowerCase());
    const state = trip.endDate < today ? "past" : "upcoming";
    return match && (filter === "all" || filter === state);
  });
  const openTasks = trips.reduce((sum, trip) => sum + (trip.tasks || []).filter((task) => !task.done).length, 0);
  const currencyTotals = {};
  const allExpenses = {};
  trips.forEach((trip) => {
    const currency = trip.currency || "IDR";
    currencyTotals[currency] ||= { budget: 0, spent: 0 };
    currencyTotals[currency].budget += effectiveBudget(trip);
    (trip.expenses || []).forEach((expense) => {
      currencyTotals[currency].spent += Number(expense.actualAmount ?? expense.amount ?? 0);
      const key = `${currency} · ${expense.category || "Lainnya"}`;
      allExpenses[key] = allExpenses[key] || { currency, amount: 0 };
      allExpenses[key].amount += Number(expense.actualAmount ?? expense.amount ?? 0);
    });
  });
  const currencyEntries = Object.entries(currencyTotals);
  const primaryCurrency = currencyEntries[0]?.[0] || "IDR";
  const primaryTotals = currencyTotals[primaryCurrency] || { budget: 0, spent: 0 };
  const budgetMetric = currencyEntries.length ? currencyEntries.map(([currency, totals]) => rupiah(totals.budget, currency)).join(" · ") : rupiah(0, primaryCurrency);
  const expenseEntries = Object.entries(allExpenses).sort((a, b) => b[1].amount - a[1].amount);
  const maxExpense = expenseEntries.length ? expenseEntries[0][1].amount : 1;
  const totalTasks = trips.reduce((sum, t) => sum + t.tasks.length, 0);
  const doneTasks = trips.reduce((sum, t) => sum + t.tasks.filter((tk) => tk.done).length, 0);
  const budgetPct = primaryTotals.budget ? Math.round(primaryTotals.spent / primaryTotals.budget * 100) : 0;
  const upcomingTrips = trips.filter((t) => t.endDate >= today).length;
  const pastTrips = trips.filter((t) => t.endDate < today).length;
  const destFreq = {};
  trips.forEach((t) => { if (t.destination) destFreq[t.destination] = (destFreq[t.destination] || 0) + 1; });
  const topDests = Object.entries(destFreq).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return <>
    <section className="hero">
      <div><p className="eyebrow light">WORKSPACE PRIBADI</p><h2>Perjalanan yang rapi,<br />dari niat hingga pulang.</h2><p>Susun agenda, biaya, dan hal kecil yang tidak boleh tertinggal.</p><button className="secondary" onClick={create}>Mulai merancang <span>→</span></button></div>
      <div className="atlas-art" aria-hidden="true"><span>JKT</span><i /><b>GO</b><em>07°48′S</em></div>
    </section>
    <section className="metrics">
      <article><span className="metric-icon">↗</span><strong>{trips.length}</strong><small>Rencana tersimpan</small></article>
      <article><span className="metric-icon">✓</span><strong>{openTasks}</strong><small>Tugas terbuka</small></article>
      <article><span className="metric-icon">¤</span><strong>{budgetMetric}</strong><small>Total anggaran · per mata uang</small></article>
    </section>
    {trips.length > 0 && (
      <section className="insight-grid">
        <article className="insight-card card">
          <p className="eyebrow">PENGELUARAN PER KATEGORI</p>
          {expenseEntries.length === 0 ? <p className="insight-empty">Belum ada pengeluaran tercatat.</p> : (
            <div className="chart-bars">
              {expenseEntries.map(([cat, amt]) => (
                <div key={cat} className="chart-bar-row">
                  <span className="chart-bar-label">{cat}</span>
                  <div className="chart-bar-track"><div className="chart-bar-fill" style={{width: `${Math.round(amt.amount / maxExpense * 100)}%`}} /><span className="chart-bar-val">{rupiah(amt.amount, amt.currency)}</span></div>
                </div>
              ))}
            </div>
          )}
        </article>
        <article className="insight-card card">
          <p className="eyebrow">UTILITAS ANGGARAN</p>
          <div className="chart-donut-wrap">
            <div className="chart-donut" style={{background: `conic-gradient(var(--coral) 0% ${budgetPct}%, var(--soft) ${budgetPct}% 100%)`}}>
              <span>{budgetPct}%</span>
            </div>
            <div className="chart-donut-legend">
              <div><span className="legend-dot" style={{background:"var(--coral)"}} /> Terpakai ({primaryCurrency}): {rupiah(primaryTotals.spent, primaryCurrency)}</div>
              <div><span className="legend-dot" style={{background:"var(--soft)"}} /> Tersisa ({primaryCurrency}): {rupiah(primaryTotals.budget - primaryTotals.spent, primaryCurrency)}</div>
            </div>
          </div>
        </article>
        <article className="insight-card card">
          <p className="eyebrow">STATUS PERJALANAN</p>
          <div className="status-donut-wrap">
            <div className="chart-donut status-donut" style={{background: `conic-gradient(#176554 0% ${upcomingTrips ? upcomingTrips/trips.length*100 : 0}%, #e47759 ${upcomingTrips ? upcomingTrips/trips.length*100 : 0}% ${upcomingTrips ? (upcomingTrips+pastTrips)/trips.length*100 : 0}%, var(--soft) ${upcomingTrips ? (upcomingTrips+pastTrips)/trips.length*100 : 0}% 100%)`}}>
              <span>{trips.length}</span>
            </div>
            <div className="chart-donut-legend">
              <div><span className="legend-dot" style={{background:"#176554"}} /> Akan datang: {upcomingTrips}</div>
              <div><span className="legend-dot" style={{background:"#e47759"}} /> Selesai: {pastTrips}</div>
              <div><span className="legend-dot" style={{background:"var(--soft)"}} /> Draft: {trips.length - upcomingTrips - pastTrips}</div>
            </div>
          </div>
        </article>
        <article className="insight-card card">
          <p className="eyebrow">PROGRES CHECKLIST</p>
          <div className="checklist-summary">
            <div className="checklist-big-num">{doneTasks}<small>/{totalTasks}</small></div>
            <div className="progress-bar checklist-progress" style={{margin: "12px 0"}}>
              <div className="progress-fill" style={{width: `${totalTasks ? doneTasks/totalTasks*100 : 0}%`}} />
              <span>{totalTasks ? Math.round(doneTasks/totalTasks*100) : 0}% siap</span>
            </div>
            <small>{openTasks} tugas masih terbuka</small>
          </div>
        </article>
        {topDests.length > 0 && (
          <article className="insight-card card">
            <p className="eyebrow">DESTINASI TERBANYAK</p>
            <div className="tag-cloud">
              {topDests.map(([dest, count]) => (
                <span key={dest} className="tag-bubble">{dest} <b>{count}</b></span>
              ))}
            </div>
          </article>
        )}
      </section>
    )}
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
