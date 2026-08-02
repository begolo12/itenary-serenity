'use client';
import { useState } from 'react';
import { dateLabel } from '../../lib/trips';

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const TONE_COLORS = ["#176b5b", "#e86f51", "#d9a441", "#2f7566", "#a43d23", "#0e3b33"];

function dateFormat(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function CalendarView({ trips, openTrip, create }) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [activeDay, setActiveDay] = useState(null);

  const scheduled = trips.filter((t) => t.startDate && t.endDate);

  const tripsByDate = {};
  scheduled.forEach((trip) => {
    const start = new Date(trip.startDate + "T00:00:00");
    const end = new Date(trip.endDate + "T23:59:59");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!tripsByDate[key]) tripsByDate[key] = [];
      tripsByDate[key].push(trip);
    }
  });

  const currentMonthStart = `${year}-${String(month + 1).padStart(2, "0")}`;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const nextMonthStart = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}`;

  const partitionByMonth = (list) => {
    const thisM = [];
    const nextM = [];
    list.forEach((trip) => {
      const start = trip.startDate.slice(0, 7);
      const end = trip.endDate.slice(0, 7);
      if (start === currentMonthStart || end === currentMonthStart) thisM.push(trip);
      else if (start === nextMonthStart || end === nextMonthStart) nextM.push(trip);
    });
    return { thisMonth: thisM, nextMonth: nextM };
  };

  const { thisMonth, nextMonth: nextMonthTrips } = partitionByMonth(scheduled);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();
  const totalCells = startPad + totalDays;
  const rows = Math.ceil(totalCells / 7);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else { setMonth(month - 1); } setActiveDay(null); };
  const nextMonthNav = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else { setMonth(month + 1); } setActiveDay(null); };
  const goToday = () => { setMonth(today.getMonth()); setYear(today.getFullYear()); };

  const handleDayClick = (dateKey, dayTrips) => {
    if (!dayTrips.length) return;
    setActiveDay(activeDay === dateKey ? null : dateKey);
    setSelectedTrip(dayTrips[0]);
  };

  const monogram = (dest) => dest?.slice(0, 2).toUpperCase() || "??";
  const colorForTrip = (trip) => TONE_COLORS[trip.destination?.length % TONE_COLORS.length];
  const detailTrip = selectedTrip || thisMonth[0] || nextMonthTrips[0] || null;

  const TripScheduleCard = ({ trip }) => {
    const done = trip.tasks.filter((t) => t.done).length;
    const total = trip.tasks.length;
    const pct = total ? Math.round(done / total * 100) : 0;
    return (
      <button className={`sched-card${detailTrip?.id === trip.id ? " selected" : ""}`} onClick={() => { setSelectedTrip(trip); setActiveDay(null); }} aria-pressed={detailTrip?.id === trip.id}>
        <span className="sched-mono" style={{ background: colorForTrip(trip) }}>{monogram(trip.destination)}</span>
        <div className="sched-body">
          <strong className="sched-title">{trip.title}</strong>
          <span className="sched-dest">{trip.destination}</span>
          <span className="sched-date">{dateFormat(trip.startDate)} - {dateFormat(trip.endDate)}</span>
        </div>
        <div className="sched-right">
          <div className="sched-meta">
            <span className="sched-people">{trip.people} orang</span>
            <span className="sched-tasks">{done}/{total}</span>
          </div>
          <div className="sched-bar">
            <div className="sched-bar-fill" style={{ width: `${pct}%`, background: pct === 100 ? "#176554" : "#4f46e5" }} />
          </div>
        </div>
        <span className="sched-arrow">→</span>
      </button>
    );
  };

  const dayTripsForActive = activeDay ? (tripsByDate[activeDay] || []) : [];

  return (
    <section className="scheduler-layout">
      <div className="scheduler-sidebar">
        <div className="scheduler-sidebar-header">
          <span className="calendar-glyph" aria-hidden="true" />
          <div><h2>Jadwal mendatang</h2><p>Perjalanan terdekat Anda</p></div>
        </div>
        <div className="scheduler-sections">
          <div className="sched-section">
            <h3>Bulan Ini <span className="sched-badge">{thisMonth.length}</span></h3>
            {thisMonth.length === 0 ? (
              <div className="sched-empty-small">
                <p>Tidak ada itinerary di bulan ini.</p>
                <button className="primary small" onClick={create}>+ Buat itinerary</button>
              </div>
            ) : (
              thisMonth.map((trip) => <TripScheduleCard key={trip.id} trip={trip} />)
            )}
          </div>
          <div className="sched-section">
            <h3>Bulan Depan <span className="sched-badge">{nextMonthTrips.length}</span></h3>
            {nextMonthTrips.length === 0 ? (
              <p className="sched-empty-text">Belum ada rencana untuk bulan depan.</p>
            ) : (
              nextMonthTrips.map((trip) => <TripScheduleCard key={trip.id} trip={trip} />)
            )}
          </div>
        </div>
      </div>

      <div className="scheduler-main">
        <div className="scheduler-calendar">
          <div className="calendar-toolbar">
            <button className="calendar-today-btn" onClick={goToday}>Hari ini</button>
            <div className="calendar-month-nav">
              <button onClick={prevMonth} aria-label="Bulan sebelumnya">‹</button>
              <h2 aria-live="polite">{MONTHS[month]} {year}</h2>
              <button onClick={nextMonthNav} aria-label="Bulan berikutnya">›</button>
            </div>
            <span className="calendar-total">{scheduled.length} itinerary</span>
          </div>
          <div className="calendar-legend" aria-label="Legenda kalender">
            <span><i className="legend-today" />Hari ini</span>
            <span><i className="legend-event" />Ada itinerary</span>
            <span><i className="legend-done" />Selesai</span>
          </div>

          {!scheduled.length ? (
            <div className="empty card" style={{ marginTop: 16 }}>
              <span className="empty-mark">▦</span>
              <h2>Belum ada itinerary terjadwal</h2>
              <p>Buat itinerary dengan tanggal mulai dan selesai agar muncul di kalender.</p>
              <button className="primary" onClick={create}>Buat itinerary pertama</button>
            </div>
          ) : (
            <div className="calendar-grid">
              {DAYS.map((d) => <div key={d} className="calendar-day-label">{d}</div>)}
              {Array.from({ length: rows * 7 }, (_, i) => {
                const dayNum = i - startPad + 1;
                const isValid = dayNum >= 1 && dayNum <= totalDays;
                const dateKey = isValid ? `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}` : null;
                const dayTrips = dateKey ? (tripsByDate[dateKey] || []) : [];
                const isToday = isValid && dateKey === todayStr;
                const isWeekend = i % 7 >= 5;
                const isActive = dateKey && dateKey === activeDay;
                return (
                  <button
                    key={i}
                    className={`calendar-day${isToday ? " today" : ""}${!isValid ? " empty" : ""}${isWeekend ? " weekend" : ""}${isActive ? " active" : ""}${dayTrips.length ? " has-trip" : ""}`}
                    disabled={!isValid || !dayTrips.length}
                    onClick={() => handleDayClick(dateKey, dayTrips)}
                  >
                    {isValid && <span className="calendar-date">{dayNum}</span>}
                    {isValid && dayTrips.length > 0 && (
                      <div className="calendar-dots">
                        {dayTrips.slice(0, 3).map((t, j) => (
                          <span key={t.id} className="calendar-dot" style={{ background: TONE_COLORS[j % TONE_COLORS.length] }} />
                        ))}
                        {dayTrips.length > 3 && <span className="calendar-dot more">+{dayTrips.length - 3}</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {(detailTrip || dayTripsForActive.length > 0) && (
          <div className="trip-detail-card card">
            {detailTrip ? (
              <>
                <div className="tdc-header">
                  <span className="tdc-mono" style={{ background: colorForTrip(detailTrip) }}>{monogram(detailTrip.destination)}</span>
                  <div>
                    <span className="tdc-kicker">Itinerary terpilih</span>
                    <h3>{detailTrip.title}</h3>
                    <div className="tdc-meta-row">
                      <span>{detailTrip.destination}</span>
                      <span>{dateFormat(detailTrip.startDate)} - {dateFormat(detailTrip.endDate)}</span>
                      <span>{detailTrip.people} orang</span>
                    </div>
                  </div>
                  <button className="tdc-open-btn" onClick={() => openTrip(detailTrip.id)}>Buka itinerary</button>
                </div>
                <div className="tdc-tasks">
                  <div className="tdc-tasks-head"><h4>Task list</h4><span>{detailTrip.tasks.filter((task) => task.done).length}/{detailTrip.tasks.length} selesai</span></div>
                  {detailTrip.tasks.length === 0 ? (
                    <p className="sched-empty-text">Belum ada tugas.</p>
                  ) : (
                    detailTrip.tasks.slice(0, 3).map((task, idx) => (
                      <label key={idx} className={`tdc-task ${task.done ? "done" : ""}`}>
                        <span className="tdc-checkbox">{task.done ? "✓" : "○"}</span>
                        <span>{task.text}</span>
                        {task.note && <small>{task.note}</small>}
                      </label>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <h4>{activeDay ? `Trip pada ${dateLabel(activeDay)}` : "Detail Trip"}</h4>
                <div className="calendar-popover-list">
                  {dayTripsForActive.map((trip) => {
                    const done = trip.tasks.filter((t) => t.done).length;
                    return (
                      <button key={trip.id} className="calendar-popover-item" onClick={() => { setSelectedTrip(trip); }}>
                        <span className="calendar-popover-monogram" style={{ background: colorForTrip(trip) }}>{monogram(trip.destination)}</span>
                        <div>
                          <strong>{trip.title}</strong>
                          <small>{trip.people} orang · {done}/{trip.tasks.length} tugas</small>
                        </div>
                        <span className="calendar-popover-arrow">→</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default CalendarView;
