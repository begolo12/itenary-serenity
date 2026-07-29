'use client';
import { useState } from 'react';
import { PLAN_TYPES, PLAN_TYPE_LABELS } from '../../lib/schemas/plan.js';
import { validateTrip, safeUUID } from '../../lib/trips';
import { Field } from '../common/Field';
import { typeLabel } from './TripDetail';

const formatAmount = (value) => {
  const digits = String(value ?? '').replace(/[^0-9]/g, '');
  return digits ? Number(digits).toLocaleString('id-ID') : '';
};

const guideFields = [
  ['transport', 'Transportasi'], ['accommodation', 'Akomodasi'], ['food', 'Makanan'],
  ['weather', 'Cuaca'], ['safety', 'Keselamatan'], ['tips', 'Tips lokal'],
];

function EditorModal({ modal, close, saveItem, updateTrip }) {
  const type = modal.type;
  const isTrip = type === 'trip';
  const defaults = type === 'activity'
    ? { day: 'Hari 1', time: '09:00', title: '', note: '', location: '', duration: '', transport: '', category: 'Aktivitas', estimatedCost: 0, bookingNote: '', done: false }
    : type === 'expense'
      ? { category: '', description: '', amount: '', paid: false, note: '' }
      : type === 'task'
        ? { title: '', category: 'Umum', priority: 'sedang', due: '', note: '', done: false }
        : type === 'document'
          ? { type: 'Reservasi', title: '', status: 'Perlu dicek', number: '', note: '' }
          : type === 'risk'
            ? { title: '', severity: 'medium', mitigation: '', status: 'open' }
            : modal.item;
  const [data, setData] = useState({ ...defaults, ...(modal.item || {}) });
  const [error, setError] = useState('');
  const change = (name, value) => setData((current) => ({ ...current, [name]: value }));
  const changeParticipant = (name, value) => setData((current) => {
    const participants = { total: Number(current.people) || 1, adults: 0, children: 0, seniors: 0, accessibility: '', ...(current.participants || {}), [name]: Math.max(0, Number(value || 0)) };
    const rawTotal = participants.adults + participants.children + participants.seniors;
    const total = Math.max(1, rawTotal);
    const normalized = rawTotal ? participants : { ...participants, adults: 1 };
    return { ...current, people: total, participants: { ...normalized, total } };
  });
  const changeGuide = (name, value) => setData((current) => ({ ...current, travelGuide: { ...(current.travelGuide || {}), [name]: value } }));
  const submit = (event) => {
    event.preventDefault();
    if (isTrip) {
      const message = validateTrip(data);
      if (!data.title?.trim()) { setError('Judul wajib diisi.'); return; }
      if (message) { setError(message); return; }
      updateTrip({
        ...data,
        people: Number(data.people),
        budget: Number(String(data.budget).replace(/[^0-9]/g, '')),
        highlights: typeof data.highlights === 'string' ? data.highlights.split(',').map((item) => item.trim()).filter(Boolean) : data.highlights || [],
      });
      close();
      return;
    }
    if (type === 'activity' && !String(data.title || '').trim()) { setError('Judul aktivitas wajib diisi.'); return; }
    if (type === 'task' && !String(data.title || '').trim()) { setError('Nama tugas wajib diisi.'); return; }
    if (type === 'document' && !String(data.title || '').trim()) { setError('Nama dokumen wajib diisi.'); return; }
    if (type === 'expense' && (!String(data.category || '').trim() || Number(data.amount) < 0 || data.amount === '')) { setError('Kategori wajib diisi dan jumlah tidak boleh negatif.'); return; }
    if (type === 'risk' && !String(data.title || '').trim()) { setError('Judul risiko wajib diisi.'); return; }
    const key = type === 'activity' ? 'activities' : type === 'expense' ? 'expenses' : type === 'task' ? 'tasks' : type === 'risk' ? 'risks' : 'documents';
    const { unitPrice, actualAmount, ...safeData } = data;
    saveItem(key, {
      ...safeData,
      id: data.id || safeUUID(),
      ...(type === 'expense' ? {
        amount: Number(String(data.amount).replace(/[^0-9]/g, '')),
        quantity: Number(data.quantity ?? 1),
        ...(data.unitPrice !== '' && data.unitPrice != null ? { unitPrice: Number(data.unitPrice) } : {}),
        ...(data.actualAmount !== '' && data.actualAmount != null ? { actualAmount: Number(data.actualAmount) } : {}),
      } : {}),
      ...(type === 'activity' ? { estimatedCost: Number(String(data.estimatedCost || 0).replace(/[^0-9]/g, '')) } : {}),
    });
  };
  const title = isTrip ? 'Edit detail plan' : modal.item ? `Edit ${typeLabel(type)}` : `Tambah ${typeLabel(type)}`;
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
    <section className={`modal card${isTrip ? ' trip-editor' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <header><div><p className="eyebrow">EDITOR</p><h2 id="modal-title">{title}</h2></div><button type="button" onClick={close} aria-label="Tutup dialog">×</button></header>
      <form onSubmit={submit}>
        {error && <p className="form-error" role="alert">{error}</p>}
        {isTrip ? <>
          <div className="form-grid">
            <Field label="Judul" value={data.title} onChange={(value) => change('title', value)} required />
            <label>Jenis rencana<select value={data.planType || 'trip'} onChange={(event) => change('planType', event.target.value)}>{PLAN_TYPES.map((planType) => <option key={planType} value={planType}>{PLAN_TYPE_LABELS[planType]}</option>)}</select></label>
            <Field label="Asal" value={data.origin} onChange={(value) => change('origin', value)} required />
            <Field label="Tujuan / lokasi" value={data.destination || ''} onChange={(value) => change('destination', value)} required={!data.venue && !(data.locations?.length)} />
            <Field label="Venue / tempat acara" value={data.venue || ''} onChange={(value) => change('venue', value)} />
            <Field label="Titik kumpul" value={data.meetingPoint || ''} onChange={(value) => change('meetingPoint', value)} />
            <Field label="Tanggal mulai" type="date" value={data.startDate} onChange={(value) => change('startDate', value)} required />
            <Field label="Tanggal selesai" type="date" value={data.endDate} onChange={(value) => change('endDate', value)} required />
            <Field label="Total peserta" type="number" min="1" value={data.people} readOnly aria-readonly="true" />
            <Field label="Dewasa" type="number" min="0" value={data.participants?.adults ?? 0} onChange={(value) => changeParticipant('adults', value)} />
            <Field label="Anak" type="number" min="0" value={data.participants?.children ?? 0} onChange={(value) => changeParticipant('children', value)} />
            <Field label="Lansia" type="number" min="0" value={data.participants?.seniors ?? 0} onChange={(value) => changeParticipant('seniors', value)} />
            <label>Tujuan kegiatan<input value={data.purpose || ''} onChange={(event) => change('purpose', event.target.value)} /></label>
            <label>Anggaran ({data.currency || 'IDR'})<input inputMode="numeric" value={formatAmount(data.budget)} onChange={(event) => change('budget', event.target.value)} /></label>
            <label>Mata uang<select value={data.currency || 'IDR'} onChange={(event) => change('currency', event.target.value)}><option value="IDR">IDR · Rupiah</option><option value="USD">USD · Dollar</option><option value="SGD">SGD · Dollar Singapura</option><option value="MYR">MYR · Ringgit</option></select></label>
            <label>Mode anggaran<select value={data.budgetMode || 'total'} onChange={(event) => change('budgetMode', event.target.value)}><option value="total">Total kegiatan</option><option value="per_person">Per peserta</option><option value="open">Belum ditentukan</option></select></label>
            <label>Tipe perjalanan<select value={data.tripMode || 'overnight'} onChange={(event) => change('tripMode', event.target.value)}><option value="day_trip">1 day trip</option><option value="overnight">Menginap</option></select></label>
            <label>Tempo<select value={data.travelPace || 'balanced'} onChange={(event) => change('travelPace', event.target.value)}><option value="relaxed">Santai</option><option value="balanced">Seimbang</option><option value="packed">Padat</option></select></label>
            <label className="full-field">Minat / fokus<input value={typeof data.highlights === 'string' ? data.highlights : (data.highlights || []).join(', ')} onChange={(event) => change('highlights', event.target.value)} /></label>
            <label className="full-field">Prioritas dan catatan<textarea value={data.mustDo || data.agendaNotes || ''} onChange={(event) => { change('mustDo', event.target.value); change('agendaNotes', event.target.value); }} rows="3" /></label>
          </div>
          <div className="editor-subsection"><p className="eyebrow">PANDUAN RENCANA</p><div className="form-grid">{guideFields.map(([key, label]) => <label key={key}>{label}<textarea value={data.travelGuide?.[key] || ''} onChange={(event) => changeGuide(key, event.target.value)} rows="2" /></label>)}</div></div>
        </> : type === 'activity' ? <div className="form-grid"><Field label="Hari" value={data.day} onChange={(value) => change('day', value)} /><Field label="Waktu" type="time" value={data.time} onChange={(value) => change('time', value)} /><Field label="Judul aktivitas" value={data.title} onChange={(value) => change('title', value)} required /><Field label="Lokasi" value={data.location || ''} onChange={(value) => change('location', value)} /><Field label="Durasi" value={data.duration || ''} onChange={(value) => change('duration', value)} placeholder="2 jam" /><Field label="Transportasi" value={data.transport || ''} onChange={(value) => change('transport', value)} /><label>Kategori<input value={data.category || ''} onChange={(event) => change('category', event.target.value)} /></label><Field label="Estimasi biaya" type="number" min="0" value={data.estimatedCost || 0} onChange={(value) => change('estimatedCost', value)} /><label>Catatan<textarea value={data.note || ''} onChange={(event) => change('note', event.target.value)} rows="3" /></label></div>
          : type === 'expense' ? <div className="form-grid"><Field label="Kategori" value={data.category || ''} onChange={(value) => change('category', value)} required /><Field label="Deskripsi" value={data.description || ''} onChange={(value) => change('description', value)} /><Field label="Estimasi" type="number" min="0" value={data.amount || ''} onChange={(value) => change('amount', value)} required /><Field label="Jumlah unit" type="number" min="0" value={data.quantity ?? 1} onChange={(value) => change('quantity', value)} /><Field label="Harga per unit" type="number" min="0" value={data.unitPrice ?? ''} onChange={(value) => change('unitPrice', value)} /><Field label="Aktual" type="number" min="0" value={data.actualAmount ?? ''} onChange={(value) => change('actualAmount', value)} /><label>Satuan<input value={data.unit || ''} onChange={(event) => change('unit', event.target.value)} /></label><label>Status verifikasi<select value={data.verificationStatus || 'estimated'} onChange={(event) => change('verificationStatus', event.target.value)}><option value="unverified">Belum diverifikasi</option><option value="estimated">Estimasi</option><option value="verified">Terverifikasi</option></select></label><label>Pembayar<input value={data.payerId || ''} onChange={(event) => change('payerId', event.target.value)} /></label><label><input type="checkbox" checked={Boolean(data.paid)} onChange={(event) => change('paid', event.target.checked)} /> Sudah dibayar</label><label><input type="checkbox" checked={Boolean(data.isContingency)} onChange={(event) => change('isContingency', event.target.checked)} /> Dana cadangan</label><label className="full-field">Catatan<textarea value={data.note || ''} onChange={(event) => change('note', event.target.value)} rows="3" /></label></div>
          : type === 'task' ? <div className="form-grid"><Field label="Nama tugas" value={data.title || ''} onChange={(value) => change('title', value)} required /><label>Kategori<input value={data.category || ''} onChange={(event) => change('category', event.target.value)} /></label><label>Fase<select value={data.phase || 'before'} onChange={(event) => change('phase', event.target.value)}><option value="before">Sebelum</option><option value="during">Saat kegiatan</option><option value="after">Sesudah</option></select></label><label>Prioritas<select value={data.priority || 'sedang'} onChange={(event) => change('priority', event.target.value)}><option value="tinggi">Tinggi</option><option value="sedang">Sedang</option><option value="rendah">Rendah</option></select></label><Field label="Tenggat" value={data.due || ''} onChange={(value) => change('due', value)} /><Field label="PIC" value={data.assigneeId || ''} onChange={(value) => change('assigneeId', value)} /><label>Status<select value={data.status || (data.done ? 'done' : 'todo')} onChange={(event) => change('status', event.target.value)}><option value="todo">Belum mulai</option><option value="in_progress">Berjalan</option><option value="blocked">Terblokir</option><option value="done">Selesai</option></select></label><label className="full-field">Catatan<textarea value={data.note || ''} onChange={(event) => change('note', event.target.value)} rows="3" /></label></div>
          : type === 'document' ? <div className="form-grid"><label>Jenis<input value={data.type || ''} onChange={(event) => change('type', event.target.value)} /></label><Field label="Nama dokumen" value={data.title || ''} onChange={(value) => change('title', value)} required /><label>Status<input value={data.status || ''} onChange={(event) => change('status', event.target.value)} /></label><Field label="Nomor / kode" value={data.number || ''} onChange={(value) => change('number', value)} /><label className="full-field">Catatan<textarea value={data.note || ''} onChange={(event) => change('note', event.target.value)} rows="3" /></label></div>
          : type === 'risk' ? <div className="form-grid"><Field label="Risiko" value={data.title || ''} onChange={(value) => change('title', value)} required /><label>Severity<select value={data.severity || 'medium'} onChange={(event) => change('severity', event.target.value)}><option value="low">Rendah</option><option value="medium">Sedang</option><option value="high">Tinggi</option><option value="critical">Kritis</option></select></label><label>Status<select value={data.status || 'open'} onChange={(event) => change('status', event.target.value)}><option value="open">Terbuka</option><option value="mitigated">Termitigasi</option><option value="accepted">Diterima</option></select></label><label className="full-field">Mitigasi<textarea value={data.mitigation || ''} onChange={(event) => change('mitigation', event.target.value)} rows="3" /></label></div>
          : null}
        {!isTrip && type === 'expense' && <label className="full-field">Bukti pembayaran / URL<input value={data.paymentProof || ''} onChange={(event) => change('paymentProof', event.target.value)} placeholder="Tempel URL atau nomor referensi" /></label>}
        {!isTrip && data.id && <label className="lock-toggle"><input type="checkbox" checked={Boolean(data.locked)} onChange={(event) => change('locked', event.target.checked)} /> Kunci item dari regenerasi AI</label>}
        <footer><button type="button" className="quiet" onClick={close}>Batal</button><button type="submit" className="primary">Simpan perubahan</button></footer>
      </form>
    </section>
  </div>;
}

export default EditorModal;
