'use client';

import { useEffect, useState } from 'react';
import { getPublicTripShare } from '../../../lib/cloud-sync';
import { dateLabel, rupiah } from '../../../lib/trips';

export default function PublicShareView({ shareId }) {
  const [share, setShare] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getPublicTripShare(shareId).then(setShare).catch((reason) => setError(reason.code === 'permission-denied' ? 'Tautan tidak ditemukan atau sudah kedaluwarsa.' : reason.message || 'Tautan tidak dapat dibuka.'));
  }, [shareId]);

  if (error) return <main className="public-share-page"><section className="public-share-card"><p className="eyebrow">SERENITY ATLAS</p><h1>Tautan tidak tersedia</h1><p>{error}</p></section></main>;
  if (!share) return <main className="public-share-page"><section className="public-share-card"><p className="eyebrow">SERENITY ATLAS</p><h1>Memuat itinerary…</h1></section></main>;

  const trip = share.snapshot || {};
  return <main className="public-share-page">
    <section className="public-share-card">
      <header className="public-share-header"><div><p className="eyebrow">SERENITY ATLAS · READ ONLY</p><h1>{trip.title || share.title}</h1><p>{trip.origin || '—'} <b>→</b> {trip.destination || trip.venue || '—'}</p><small>{dateLabel(trip.startDate)} – {dateLabel(trip.endDate)} · {trip.people || trip.participants?.total || 0} orang</small></div><button className="light-button" type="button" onClick={() => window.print()}>Cetak</button></header>
    </section>
    <section className="public-share-grid">
      <article className="public-share-card"><p className="eyebrow">RUNDOWN</p><h2>Agenda</h2>{trip.activities?.length ? <ol className="public-share-list">{trip.activities.map((item) => <li key={item.id}><strong>{item.time || '—'} · {item.title}</strong><span>{item.location || trip.destination || 'Lokasi menyusul'}{item.note ? ` · ${item.note}` : ''}</span></li>)}</ol> : <p>Belum ada agenda.</p>}</article>
      <article className="public-share-card"><p className="eyebrow">ANGGARAN</p><h2>Perkiraan biaya</h2>{trip.expenses?.length ? <ul className="public-share-list">{trip.expenses.map((item) => <li key={item.id}><strong>{item.category || item.description}</strong><span>{rupiah(item.amount || item.actualAmount || 0, trip.currency || 'IDR')}{item.paid ? ' · Dibayar' : ''}</span></li>)}</ul> : <p>Belum ada rincian biaya.</p>}</article>
      <article className="public-share-card"><p className="eyebrow">CHECKLIST</p><h2>Tugas penting</h2>{trip.tasks?.length ? <ul className="public-share-list">{trip.tasks.map((item) => <li key={item.id}><strong>{item.title}</strong><span>{item.done || item.status === 'done' ? 'Selesai' : item.status === 'blocked' ? 'Terblokir' : 'Belum selesai'}{item.assigneeId ? ` · PIC ${item.assigneeId}` : ''}</span></li>)}</ul> : <p>Belum ada tugas.</p>}</article>
      <article className="public-share-card"><p className="eyebrow">VERIFIKASI</p><h2>Catatan</h2><p>{trip.summary || trip.purpose || 'Snapshot dibagikan untuk dibaca bersama.'}</p>{trip.verificationNotes?.length ? <ul>{trip.verificationNotes.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : null}</article>
    </section>
    <p className="public-share-expiry">Tautan aktif sampai {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(share.expiresAt))}.</p>
  </main>;
}
