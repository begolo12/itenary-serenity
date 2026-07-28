'use client';
import { rupiah } from '../../lib/trips';

export function PrintSheet({ trip, spent }) {
  const guide = trip.travelGuide || {};
  const agenda = trip.activities || [];
  const expenses = trip.expenses || [];
  const tasks = trip.tasks || [];
  const documents = trip.documents || [];
  const header = <><h1>{trip.title}</h1><p>{trip.origin} → {trip.destination || trip.venue} · {trip.startDate} s.d. {trip.endDate} · {trip.people} orang · {trip.currency || 'IDR'}</p>{trip.summary && <p>{trip.summary}</p>}</>;
  return <>
    <section className="print-sheet print-sheet-participant">
      {header}
      <h2>Rundown</h2>
      {agenda.map((item) => <article key={item.id}><b>{item.day} · {item.time}</b><div><strong>{item.title}</strong><p>{item.location} · {item.duration} · {item.transport}</p><p>{item.note}</p></div></article>)}
      <h2>Panduan perjalanan</h2>
      <ul>{Object.entries(guide).filter(([, value]) => value).map(([key, value]) => <li key={key}><strong>{key}:</strong> {value}</li>)}</ul>
      <p className="print-disclaimer">Versi peserta. Verifikasi kembali jadwal dan informasi keselamatan sebelum berangkat.</p>
    </section>
    <section className="print-sheet print-sheet-organizer">
      {header}
      <h2>Rundown</h2>
      {agenda.map((item) => <article key={item.id}><b>{item.day} · {item.time}</b><div><strong>{item.title}</strong><p>{item.location} · {item.duration} · {item.transport}</p><p>{item.note}</p>{item.bookingNote && <small>Verifikasi: {item.bookingNote}</small>}</div></article>)}
      <h2>Panduan perjalanan</h2>
      <ul>{Object.entries(guide).filter(([, value]) => value).map(([key, value]) => <li key={key}><strong>{key}:</strong> {value}</li>)}</ul>
      <h2>Anggaran</h2>
      <table><thead><tr><th>Kategori</th><th>Deskripsi</th><th>Realisasi / estimasi</th></tr></thead><tbody>{expenses.map((item) => <tr key={item.id}><td>{item.category}</td><td>{item.description}</td><td>{rupiah(item.actualAmount ?? item.amount, trip.currency)}</td></tr>)}<tr><th colSpan="2">Total</th><th>{rupiah(spent, trip.currency)}</th></tr></tbody></table>
      <h2>Dokumen</h2>
      <ul>{documents.map((item) => <li key={item.id}>{item.type} — {item.title} — {item.status} {item.number && `(${item.number})`}</li>)}</ul>
      <h2>Checklist</h2>
      <ul>{tasks.map((task) => <li key={task.id}>{task.done ? '[x]' : '[ ]'} {task.title} {task.due ? `· ${task.due}` : ''}</li>)}</ul>
      <p className="print-disclaimer">Versi panitia. Draft plan. Verifikasi kembali jadwal, biaya, peserta, dokumen, dan informasi keselamatan sebelum dilaksanakan.</p>
    </section>
  </>;
}
