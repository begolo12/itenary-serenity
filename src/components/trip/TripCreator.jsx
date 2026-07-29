'use client';
import { useState, useEffect } from 'react';
import { CityAutocomplete } from '../common/CityAutocomplete';
import { Field } from '../common/Field';
import { blankTrip, createTemplate, validateTrip } from '../../lib/trips';
import { generateWithAi } from '../../lib/ai-client';
import { PLAN_TYPES, PLAN_TYPE_LABELS } from '../../lib/schemas/plan.js';

const AI_PROVIDERS = {
  deepseek: { label: 'DeepSeek', model: 'deepseek-v4-flash' },
  openai: { label: 'OpenAI', model: 'gpt-4o-mini' },
  gemini: { label: 'Gemini', model: 'gemini-2.0-flash' },
};

const formatBudget = (value) => {
  const num = String(value || '').replace(/[^0-9]/g, '');
  if (!num) return '';
  return Number(num).toLocaleString('id-ID');
};

const STEPS = ['Jenis & rute', 'Waktu & peserta', 'Preferensi & anggaran', 'Konfirmasi'];

const DRAFT_STORAGE_KEY = 'serenity-itinerary-wizard-draft';

function TripCreator({ provider, workspaceId, addTrip, cancel, toast }) {
  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.form) return { ...blankTrip, ...parsed.form };
      }
    } catch {}
    return { ...blankTrip };
  });
  const [step, setStep] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.step >= 1 && parsed?.step <= 4) return parsed.step;
      }
    } catch {}
    return 1;
  });
  const [hasRestoredDraft] = useState(() => {
    try { return Boolean(localStorage.getItem(DRAFT_STORAGE_KEY)); } catch { return false; }
  });
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState('');

  // Auto-save form draft whenever form or step changes
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ form, step, savedAt: new Date().toISOString() }));
    } catch {}
  }, [form, step]);

  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
  };

  const resetFormDraft = () => {
    clearDraft();
    setForm({ ...blankTrip });
    setStep(1);
    setError('');
    toast('Draft formulir dibersihkan.');
  };

  const field = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const participant = (name, value) => setForm((current) => {
    const participants = { ...current.participants, [name]: Math.max(0, Number(value || 0)) };
    const rawTotal = participants.adults + participants.children + participants.seniors;
    const total = Math.max(1, rawTotal);
    const normalized = rawTotal ? participants : { ...participants, adults: 1 };
    return { ...current, people: String(total), participants: { ...normalized, total } };
  });

  const nextStep = () => {
    if (step === 1 && !form.origin.trim()) {
      setError('Isi kota asal terlebih dahulu.');
      return;
    }
    if (step === 2) {
      if (!form.startDate || !form.endDate) {
        setError('Isi tanggal mulai dan selesai terlebih dahulu.');
        return;
      }
      if (form.endDate < form.startDate) {
        setError('Tanggal selesai tidak boleh sebelum tanggal mulai.');
        return;
      }
    }
    setError('');
    setStep((current) => current + 1);
  };

  const makeLocal = (event) => {
    event.preventDefault();
    const message = validateTrip(form);
    if (message) { setError(message); return; }
    clearDraft();
    addTrip(createTemplate(form));
    toast('Template deterministik dibuat secara lokal. Tidak ada AI yang dipanggil.');
  };

  const makeAi = async () => {
    const message = validateTrip(form, { allowDestinationRecommendation: true });
    if (message) { setError(message); return; }
    setGenerating(true);
    setGenerationStage('Mengirim brief dan batasan...');
    setError('');
    try {
      const result = await generateWithAi({ provider, workspaceId, brief: { ...form, recommendDestination: !String(form.destination || '').trim() && !String(form.venue || '').trim() && !form.locations.length } });
      setGenerationStage('Memeriksa struktur draft...');
      clearDraft();
      addTrip({ ...createTemplate(form), ...result, source: 'ai' });
      toast(`${result.recommendationSource ? 'Rekomendasi dan draft' : 'Draft'} ${AI_PROVIDERS[provider].label} selesai. Verifikasi jadwal, harga, dan detail keselamatan.`);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setGenerating(false);
      setGenerationStage('');
    }
  };

  const handleCancel = () => {
    clearDraft();
    cancel();
  };

  return (
    <form className="wizard card" onSubmit={makeLocal}>
      <div className="wizard-head">
        <div>
          <p className="eyebrow">BRIEF RENCANA</p>
          <h2>Mulai dari konteks yang penting.</h2>
          <p className="lead">Pilih jenis kegiatan, lalu isi lokasi, waktu, peserta, dan batasan. Detail dapat diedit setelah draft dibuat.</p>
          {hasRestoredDraft && (
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <small style={{ color: 'var(--pine)', fontWeight: 700 }}>✓ Draft tersimpan otomatis dipulihkan</small>
              <button type="button" className="quiet" style={{ fontSize: '11px', padding: '2px 6px' }} onClick={resetFormDraft}>Kosongkan draft</button>
            </div>
          )}
        </div>
        <span className="step">0{step} / 0{STEPS.length}</span>
      </div>
      <div className="wizard-steps" aria-label="Tahap pembuatan itinerary">
        {STEPS.map((s, i) => (
          <span key={s} className={i + 1 < step ? 'done' : i + 1 === step ? 'active' : ''} title={s} aria-label={s} />
        ))}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="wizard-content">
        {step === 1 && (
          <div className="form-grid">
            <label className="full-field">Jenis rencana<select value={form.planType} onChange={(event) => field('planType', event.target.value)}>{PLAN_TYPES.map((type) => <option key={type} value={type}>{PLAN_TYPE_LABELS[type]}</option>)}</select></label>
            <label>Kota asal<CityAutocomplete value={form.origin} onChange={(value) => field('origin', value)} placeholder='Cari kota asal...' /></label>
            <label className="destination-field">Tujuan / lokasi <span className="optional-label">opsional jika memakai venue atau rekomendasi AI</span><CityAutocomplete value={form.destination} onChange={(value) => field('destination', value)} placeholder='Contoh: Bali, Bandung, kantor klien' /><small>{form.destination.trim() ? 'AI akan mengikuti lokasi yang Anda tulis.' : 'Untuk acara, isi venue di bawah; untuk rekomendasi, kosongkan tujuan.'}</small></label>
            {form.planType !== 'trip' && <label>Venue / tempat acara<input value={form.venue} onChange={(event) => field('venue', event.target.value)} placeholder='Contoh: Gedung serbaguna, kantor pusat' /></label>}
            {form.planType !== 'trip' && <label>Titik kumpul<input value={form.meetingPoint} onChange={(event) => field('meetingPoint', event.target.value)} placeholder='Contoh: Lobby utama, gerbang sekolah' /></label>}
            <label>Tipe perjalanan<select value={form.tripMode} onChange={(event) => { const nextMode = event.target.value; field('tripMode', nextMode); if (nextMode === 'day_trip') { field('roomMode', 'single'); if (form.startDate) field('endDate', form.startDate); } }}><option value='day_trip'>1 day trip · tanpa menginap</option><option value='overnight'>Menginap</option></select></label>
            <label>Waktu mulai aktivitas<select value={form.departureWindow} onChange={(event) => field('departureWindow', event.target.value)}><option value='early'>Pagi sekali · 05.00–07.00</option><option value='morning'>Pagi · 07.00–10.00</option><option value='afternoon'>Siang · 11.00–14.00</option><option value='evening'>Sore/malam · setelah 15.00</option></select></label>
          </div>
        )}
        {step === 2 && (
          <div className="form-grid">
            <Field label='Tanggal mulai' type='date' value={form.startDate} onChange={(value) => { field('startDate', value); if (form.tripMode === 'day_trip') field('endDate', value); }} required />
            <Field label='Tanggal selesai' type='date' min={form.startDate} value={form.endDate} onChange={(value) => field('endDate', value)} disabled={form.tripMode === 'day_trip'} required />
            <Field label='Total peserta' type='number' min='1' step='1' value={form.participants.total} readOnly aria-readonly='true' />
            <Field label='Dewasa' type='number' min='0' step='1' value={form.participants.adults} onChange={(value) => participant('adults', Number(value || 0))} />
            <Field label='Anak' type='number' min='0' step='1' value={form.participants.children} onChange={(value) => participant('children', Number(value || 0))} />
            <Field label='Lansia' type='number' min='0' step='1' value={form.participants.seniors} onChange={(value) => participant('seniors', Number(value || 0))} />
            <label>Tujuan perjalanan<input list="purpose-list" value={form.purpose} onChange={(event) => field('purpose', event.target.value)} placeholder='Mis. Leisure, bisnis, keluarga...' /><datalist id="purpose-list"><option value='Leisure' /><option value='Bisnis' /><option value='Keluarga' /><option value='Backpacker' /><option value='Honeymoon' /><option value='Retreat' /><option value='Study tour' /><option value='Adventure' /><option value='Kuliner' /><option value='Budaya & Sejarah' /></datalist></label>
            <label>Tempo perjalanan<select value={form.travelPace} onChange={(event) => field('travelPace', event.target.value)}><option value='relaxed'>Santai · banyak waktu luang</option><option value='balanced'>Seimbang · nyaman tapi produktif</option><option value='packed'>Padat · sebanyak mungkin lokasi</option></select></label>
            <label className="full-field">Minat utama <span className="optional-label">pisahkan dengan koma</span><input value={form.interests} onChange={(event) => field('interests', event.target.value)} placeholder='Contoh: kuliner lokal, pantai, museum, fotografi' /></label>
            <label className="full-field">Prioritas perjalanan <span className="optional-label">opsional</span><textarea value={form.mustDo} onChange={(event) => field('mustDo', event.target.value)} placeholder='Apa yang paling ingin tercapai atau wajib dilakukan?' rows='3' /></label>
          </div>
        )}
        {step === 3 && (
          <div className="form-grid">
            <label>{form.budgetMode === 'per_person' ? 'Anggaran per peserta' : form.budgetMode === 'open' ? 'Anggaran (opsional)' : 'Anggaran total'} ({form.currency})<input type='text' inputMode='numeric' value={formatBudget(form.budget)} onChange={(event) => { const raw = event.target.value.replace(/[^0-9]/g, ''); field('budget', raw); }} placeholder={form.budgetMode === 'per_person' ? 'Mis. 1.250.000 / peserta' : 'Mis. 5.000.000'} required={form.budgetMode !== 'open'} /></label>
            <label>Mata uang<select value={form.currency} onChange={(event) => field('currency', event.target.value)}><option value='IDR'>IDR · Rupiah</option><option value='USD'>USD · Dollar</option><option value='SGD'>SGD · Dollar Singapura</option><option value='MYR'>MYR · Ringgit</option></select></label>
            <label>Mode anggaran<select value={form.budgetMode} onChange={(event) => field('budgetMode', event.target.value)}><option value='total'>Total kegiatan</option><option value='per_person'>Per peserta</option><option value='open'>Belum ditentukan</option></select></label>
            <label>Transportasi utama<select value={form.transportPreference} onChange={(event) => field('transportPreference', event.target.value)}><option value='mixed'>Campuran · fleksibel</option><option value='private_car'>Mobil pribadi / sewa</option><option value='public'>Transportasi umum</option><option value='ride_hailing'>Taksi online / ride-hailing</option><option value='walking'>Jalan kaki sebanyak mungkin</option></select></label>
            <label className={form.tripMode === 'day_trip' ? 'field-disabled' : ''}>Preferensi akomodasi<select value={form.accommodationPreference} onChange={(event) => field('accommodationPreference', event.target.value)} disabled={form.tripMode === 'day_trip'}><option value='hotel'>Hotel praktis</option><option value='boutique'>Boutique hotel</option><option value='villa'>Villa / apartemen</option><option value='budget'>Budget / hostel</option><option value='family'>Ramah keluarga</option></select></label>
            <label className={form.tripMode === 'day_trip' ? 'field-disabled' : ''}>Pengaturan room<select value={form.roomMode} onChange={(event) => field('roomMode', event.target.value)} disabled={form.tripMode === 'day_trip'}><option value='single'>Satu room</option><option value='separate'>Room terpisah</option></select></label>
            <label>Preferensi makanan<select value={form.dietaryPreference} onChange={(event) => field('dietaryPreference', event.target.value)}><option value='none'>Tidak ada pantangan</option><option value='halal'>Halal</option><option value='vegetarian'>Vegetarian</option><option value='vegan'>Vegan</option><option value='custom'>Lainnya · jelaskan di catatan</option></select></label>
            <label className="full-field">Yang ingin dihindari <span className="optional-label">opsional</span><textarea value={form.avoid} onChange={(event) => field('avoid', event.target.value)} placeholder='Contoh: jalan terlalu jauh, tempat terlalu ramai, aktivitas ekstrem' rows='2' /></label>
            <label className="full-field">Kebutuhan khusus & catatan penting <span className="optional-label">opsional</span><textarea value={form.specialNeeds} onChange={(event) => field('specialNeeds', event.target.value)} placeholder='Contoh: lansia, anak kecil, alergi, akses stroller, harus tiba sebelum jam tertentu' rows='3' /></label>
          </div>
        )}
        {step === 4 && (
          <div>
            <div className="review-grid">
              <div><span>Jenis</span><strong>{PLAN_TYPE_LABELS[form.planType]} · {form.purpose || 'umum'}</strong></div>
              <div><span>Rute / venue</span><strong>{form.origin} → {form.destination || form.venue || 'Rekomendasi AI'}</strong></div>
              <div><span>Jadwal</span><strong>{form.startDate || '—'} s.d. {form.endDate || '—'}</strong></div>
              <div><span>Peserta</span><strong>{form.people} total · {form.participants.adults} dewasa · {form.participants.children} anak · {form.participants.seniors} lansia</strong></div>
              <div><span>Gaya</span><strong>{form.travelPace === 'relaxed' ? 'Santai' : form.travelPace === 'packed' ? 'Padat' : 'Seimbang'} · {form.interests || 'fleksibel'}</strong></div>
              <div><span>Budget</span><strong>{form.currency} {formatBudget(form.budget) || '—'} · {form.budgetMode === 'per_person' ? 'per peserta' : form.budgetMode === 'open' ? 'terbuka' : 'total'}</strong></div>
              <div><span>Transport</span><strong>{form.transportPreference === 'private_car' ? 'Mobil pribadi / sewa' : form.transportPreference === 'public' ? 'Transportasi umum' : form.transportPreference === 'ride_hailing' ? 'Ride-hailing' : form.transportPreference === 'walking' ? 'Jalan kaki' : 'Campuran'}</strong></div>
            </div>
            <div className="brief-summary"><span className="spark">✓</span><div><strong>Konteks AI sudah siap</strong><p>{form.mustDo || form.avoid || form.specialNeeds ? 'Preferensi, prioritas, dan batasan akan dipakai sebagai aturan itinerary.' : 'Tambahkan catatan opsional jika ada kebutuhan khusus sebelum membuat draft.'}</p></div></div>
            <div className="ai-choice"><span className="spark">✦</span><div><strong>{AI_PROVIDERS[provider].label} · {AI_PROVIDERS[provider].model}</strong><p>{String(form.destination || '').trim() || String(form.venue || '').trim() ? 'AI menyusun draft mengikuti jenis kegiatan, lokasi, venue, ritme, budget, dan preferensi Anda.' : provider === 'gemini' ? 'Lokasi kosong: Gemini akan memakai Google Search untuk mencari rekomendasi yang sesuai brief.' : 'Lokasi kosong membutuhkan Gemini untuk rekomendasi online; provider lain tetap bisa dipakai jika lokasi diisi.'}</p></div></div>
            {generationStage && <p className="generation-status" role="status">{generationStage}</p>}
          </div>
        )}
      </div>
      <footer>
        {step > 1 && <button type='button' className='quiet' onClick={() => { setStep((current) => current - 1); setError(''); }}>Kembali</button>}
        <button type='button' className='quiet' onClick={handleCancel}>Batal</button>
        {step < STEPS.length && <button type='button' className='primary' onClick={nextStep}>Lanjut</button>}
        {step === STEPS.length && <><button type='submit' className='outline'>Gunakan template lokal</button><button type='button' className='primary' onClick={makeAi} disabled={generating}>{generating ? 'Menyusun draft...' : `Buat dengan ${AI_PROVIDERS[provider].label}`}</button></>}
      </footer>
    </form>
  );
}

export default TripCreator;
