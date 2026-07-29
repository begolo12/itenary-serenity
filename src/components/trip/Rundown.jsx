'use client';
import { useRef, useState } from 'react';
import { PanelHead } from '../common/PanelHead';
import { compressPhotoForFirestore } from '../../lib/image-compression';
import { downloadIcs, rupiah, safeUUID } from '../../lib/trips';

const parseTime = (value) => {
  const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
const parseDuration = (value) => {
  const match = String(value || '').match(/(\d+(?:\.\d+)?)\s*(jam|hour|menit|min)/i);
  if (!match) return 60;
  return Math.round(Number(match[1]) * (match[2].toLowerCase().startsWith('j') || match[2].toLowerCase().startsWith('h') ? 60 : 1));
};
const activityInterval = (activity) => {
  const start = parseTime(activity.startTime || activity.time);
  if (start == null) return null;
  const end = parseTime(activity.endTime) ?? start + parseDuration(activity.duration);
  return { key: activity.date || activity.day || 'Hari 1', start, end };
};

export function Rundown({ trip, setModal, removeItem, updateTrip, toggleLock, toast, readOnly = false }) {
  const photoRefs = useRef({});
  const [expandedPhotos, setExpandedPhotos] = useState({});
  const activities = trip.activities || [];
  const now = new Date();
  const tripStart = new Date(`${trip.startDate}T00:00:00`);
  const doneActivities = activities.filter((a) => a.done).length;
  const progress = activities.length ? Math.round(doneActivities / activities.length * 100) : 0;
  const conflicts = activities.flatMap((item, index) => activities.slice(index + 1).filter((other) => {
    const first = activityInterval(item);
    const second = activityInterval(other);
    return first && second && first.key === second.key && first.start < second.end && second.start < first.end;
  }).map((other) => `${item.title || "Aktivitas"} ↔ ${other.title || "Aktivitas"} · ${item.time || "waktu sama"}`));

  const toggleDone = (id) => updateTrip({ activities: activities.map((activity) => {
    if (activity.id !== id) return activity;
    const done = !activity.done;
    return { ...activity, done, status: done ? 'done' : 'planned' };
  }) });
  const reorder = (fromId, toId) => {
    if (!fromId || fromId === toId) return;
    const next = [...activities];
    const fromIndex = next.findIndex((item) => item.id === fromId);
    const toIndex = next.findIndex((item) => item.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    updateTrip({ activities: next });
  };
  const uploadPhoto = async (activityId, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const photo = await compressPhotoForFirestore(file);
      updateTrip({ activities: activities.map((item) => item.id === activityId ? { ...item, photos: [...(item.photos || []), { ...photo, id: safeUUID(), uploadedAt: new Date().toISOString() }] } : item) });
      toast(`Foto dikompresi ${Math.round(photo.sizeBytes / 1024)} KB`);
    } catch (error) { toast(error.message, 'error'); }
    event.target.value = '';
  };
  const getStatus = (activity) => {
    if (activity.done) return { label: 'Selesai', cls: 'done' };
    const dayNum = Math.max(1, Number(activity.day?.match(/\d+/)?.[0] || 1));
    const [h, m] = String(activity.time || '09:00').split(':').map(Number);
    const actDate = new Date(tripStart);
    actDate.setDate(actDate.getDate() + dayNum - 1);
    actDate.setHours(h || 9, m || 0, 0, 0);
    if (actDate < now) return { label: 'Terlambat', cls: 'late' };
    const diffHrs = (actDate - now) / 3600000;
    if (diffHrs <= 2) return { label: `Dalam ${Math.max(1, Math.round(diffHrs * 60))} menit`, cls: 'soon' };
    return { label: 'Mendatang', cls: 'upcoming' };
  };

  return <section className="panel">
    <PanelHead eyebrow="ALUR PERJALANAN" title={`${activities.length} aktivitas`} action={readOnly ? null : "＋ Tambah aktivitas"} onAction={readOnly ? undefined : () => setModal?.({ type: 'activity', item: null })} />
    <div className="export-row"><button className="quiet" onClick={() => downloadIcs(trip)}>Ekspor kalender .ics</button></div>
    {activities.length > 0 && <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /><span>{doneActivities}/{activities.length} selesai ({progress}%)</span></div>}
    {conflicts.length > 0 && <div className="schedule-conflict" role="alert"><strong>Konflik jadwal terdeteksi</strong><span>{conflicts.slice(0, 3).join(" · ")}</span>{conflicts.length > 3 && <small>+{conflicts.length - 3} konflik lainnya</small>}</div>}
    {!activities.length ? <p className="panel-empty">Belum ada aktivitas.</p> : <div className="timeline">{activities.map((item) => {
      const status = getStatus(item);
      const isExpanded = expandedPhotos[item.id];
      const photos = item.photos || [];
      return <article key={item.id} className={`timeline-item ${item.done ? 'completed' : ''}`} draggable="true" onDragStart={(event) => { event.dataTransfer.setData('text/plain', item.id); event.currentTarget.classList.add('dragging'); }} onDragEnd={(event) => event.currentTarget.classList.remove('dragging')} onDragOver={(event) => { event.preventDefault(); event.currentTarget.classList.add('drag-over'); }} onDragLeave={(event) => event.currentTarget.classList.remove('drag-over')} onDrop={(event) => { event.preventDefault(); event.currentTarget.classList.remove('drag-over'); reorder(event.dataTransfer.getData('text/plain'), item.id); }}>
        <div className="timeline-time"><b>{item.time || '—'}</b><span>{item.day || 'Hari 1'}</span><span className={`status-badge ${status.cls}`}>{status.label}</span></div>
        <button type="button" disabled={readOnly} className={`timeline-dot ${item.done ? 'done' : ''}`} onClick={() => toggleDone(item.id)} title={item.done ? 'Tandai belum selesai' : 'Tandai selesai'} aria-label={item.done ? 'Tandai belum selesai' : 'Tandai selesai'}>{item.done ? '✓' : ''}</button>
        <div className="timeline-card card">
          <div className="activity-kicker"><span>{item.category || 'Aktivitas'}</span>{item.estimatedCost > 0 && <b>{rupiah(item.estimatedCost, trip.currency)}</b>}</div>
          <h3>{item.title}</h3>
          <div className="activity-meta"><span>⌖ {item.location || 'Lokasi belum diisi'}</span><span>◷ {item.duration || 'Durasi belum diisi'}</span><span>↗ {item.transport || 'Transportasi fleksibel'}</span></div>
          <p>{item.note || 'Tanpa catatan'}</p>
          {item.bookingNote && <div className="booking-note"><b>Booking / verifikasi</b><span>{item.bookingNote}</span></div>}
          {photos.length > 0 && <div className="activity-photos"><img src={photos[0].photoData} alt={`Foto ${item.title}`} className="photo-thumb" onClick={() => setExpandedPhotos((prev) => ({ ...prev, [item.id]: !prev[item.id] }))} />{photos.length > 1 && <span className="photo-count" onClick={() => setExpandedPhotos((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}>+{photos.length - 1}</span>}{isExpanded && <div className="photo-gallery">{photos.map((photo) => <img key={photo.id} src={photo.photoData} alt="Foto aktivitas" />)}<button className="quiet" onClick={() => setExpandedPhotos((prev) => ({ ...prev, [item.id]: false }))}>Tutup galeri</button></div>}</div>}
          {!readOnly && <div className="timeline-actions"><button className="mini" onClick={() => setModal?.({ type: 'activity', item })}>Edit semua detail</button><label className="mini photo-upload">＋ Foto<input ref={(element) => { if (element) photoRefs.current[item.id] = element; }} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => uploadPhoto(item.id, event)} /></label><button className="mini" onClick={() => toggleLock?.('activities', item.id)} aria-pressed={Boolean(item.locked)}>{item.locked ? 'Terkunci' : 'Kunci item'}</button><button className="mini danger" onClick={() => removeItem('activities', item.id, 'aktivitas')}>Hapus</button></div>}
        </div>
      </article>;
    })}</div>}
  </section>;
}
