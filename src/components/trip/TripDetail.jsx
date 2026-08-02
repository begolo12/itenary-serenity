'use client';
import { useState, useRef } from 'react';
import { dateLabel, rupiah } from '../../lib/trips';
import { generateWithAi } from '../../lib/ai-client';
import { compressPhotoForFirestore } from '../../lib/image-compression';
import { Overview } from './Overview';
import { Rundown } from './Rundown';
import { Budget } from './Budget';
import { Checklist } from './Checklist';
import EditorModal from './EditorModal';
import RegenerateModal from './RegenerateModal';
import { PrintSheet } from './PrintSheet';
import Documents from './Documents';
import CollaborationPanel from './CollaborationPanel';

export const tabs = [
  ['overview', 'Ringkasan'], ['rundown', 'Rundown'],
  ['budget', 'Anggaran'], ['checklist', 'Checklist'], ['documents', 'Dokumen'],
  ['collaboration', 'Kolaborasi'],
];
export function typeLabel(type) { return ({ activity: 'aktivitas', expense: 'biaya', task: 'tugas', document: 'dokumen', risk: 'risiko' })[type]; }
function TripDetail({ trip, tab, setTab, updateTrip, removeTrip, onDuplicate, toast, cloudReady, readOnly = false, provider = 'deepseek', workspaceId = '', user = null }) {
  const [modal, setModal] = useState(null);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [initialRegenerateSection, setInitialRegenerateSection] = useState('activities');
  const [compressing, setCompressing] = useState(false);
  const [regeneratingSection, setRegeneratingSection] = useState("");
  const photoInput = useRef(null);
  const spent = (trip.expenses || []).reduce((sum, item) => sum + Number(item.actualAmount ?? item.amount ?? 0), 0);
  const completed = (trip.tasks || []).filter((task) => task.done).length;
  const updateList = (key, list) => { if (!readOnly) updateTrip({ [key]: list }); };
  const removeItem = (key, id, label) => {
    if (readOnly) return;
    if (window.confirm(`Hapus ${label} ini?`)) updateList(key, (trip[key] || []).filter((item) => item.id !== id));
  };
  const saveItem = (key, item) => {
    if (readOnly) return;
    const currentList = trip[key] || [];
    const exists = currentList.some((current) => current.id === item.id);
    updateList(key, exists ? currentList.map((current) => current.id === item.id ? item : current) : [...currentList, item]);
    setModal(null);
  };
  const selectPhoto = async (event) => {
    if (readOnly) return;
    const file = event.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    try {
      const photo = await compressPhotoForFirestore(file);
      updateTrip({ photo });
      toast(`Foto dikompresi menjadi ${Math.round(photo.sizeBytes / 1024)} KB${cloudReady ? ' dan akan disinkronkan ke Firestore.' : ' dan disimpan lokal sampai cloud diaktifkan.'}`);
    } catch (error) { toast(error.message, 'error'); } finally { setCompressing(false); event.target.value = ''; }
  };
  const toggleLock = (key, id) => {
    if (readOnly) return;
    updateList(key, (trip[key] || []).map((item) => item.id === id ? { ...item, locked: !item.locked } : item));
  };
  const regenerateSection = async (section, customInstruction = "") => {
    if (readOnly || !workspaceId || regeneratingSection) return;
    setRegeneratingSection(section);
    try {
      const participants = trip.participants || { total: trip.people || 1, adults: trip.people || 1, children: 0, seniors: 0, accessibility: "" };
      const brief = {
        planType: trip.planType || "trip", origin: trip.origin || "", destination: trip.destination || "", locations: trip.locations || [],
        venue: trip.venue || "", meetingPoint: trip.meetingPoint || "", timezone: trip.timezone || "Asia/Jakarta",
        startDate: trip.startDate, endDate: trip.endDate, purpose: trip.purpose || trip.title || "Rencana", people: trip.people || participants.total || 1,
        participants, budget: trip.budget || 0, budgetMode: trip.budgetMode || "total", currency: trip.currency || "IDR",
        tripMode: trip.tripMode || "overnight", roomMode: trip.roomMode || "single", travelPace: trip.travelPace || "balanced",
        interests: trip.interests || (trip.highlights || []).join(", "), transportPreference: trip.transportPreference || "mixed",
        accommodationPreference: trip.accommodationPreference || "hotel", dietaryPreference: trip.dietaryPreference || "none",
        mustDo: trip.mustDo || "", avoid: trip.avoid || "", specialNeeds: trip.specialNeeds || "", agendaNotes: trip.agendaNotes || "",
        recommendDestination: false,
      };
      const currentSection = trip[section] || (section === "travelGuide" ? {} : []);
      const lockedItems = Array.isArray(currentSection) ? currentSection.filter((item) => item?.locked) : [];
      const result = await generateWithAi({ provider, workspaceId, action: "regenerate", section, brief, currentSection, lockedItems, customInstruction });
      const generated = result?.[section];
      if (generated == null) throw new Error("AI tidak mengembalikan bagian yang diminta.");
      let nextSection = generated;
      if (Array.isArray(generated)) {
        const currentLocked = new Map((Array.isArray(currentSection) ? currentSection : []).filter((item) => item?.locked && item.id).map((item) => [item.id, item]));
        const seen = new Set();
        nextSection = generated.map((item) => currentLocked.get(item?.id) || item).filter((item) => {
          const id = item?.id || JSON.stringify(item);
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        for (const item of currentLocked.values()) if (!seen.has(item.id)) nextSection.push(item);
      }
      updateTrip({ [section]: nextSection, generation: { ...(trip.generation || {}), status: "draft", provider: result.provider || provider, model: result.model || "", generatedAt: new Date().toISOString() } });
      toast(`Bagian ${section === "activities" ? "rundown" : section === "travelGuide" ? "panduan" : section} berhasil diregenerasi.`);
      setShowRegenerateModal(false);
    } catch (error) {
      toast(error.message || "Regenerasi AI gagal.", "error");
    } finally {
      setRegeneratingSection("");
    }
  };
  const printAudience = (audience) => {
    document.body.dataset.printAudience = audience;
    const cleanup = () => { delete document.body.dataset.printAudience; };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1500);
  };
  return <div className={`detail-view${readOnly ? ' read-only-detail' : ''}`}>
    <section className="detail-hero">
    {readOnly && <div className="read-only-banner" role="status">Mode viewer · perubahan dinonaktifkan</div>}
      <div className="detail-photo">{trip.photo?.photoData ? <img src={trip.photo.photoData} alt={`Foto ${trip.destination}`} /> : <span>{trip.destination?.slice(0, 2).toUpperCase()}</span>}<button onClick={() => photoInput.current?.click()} disabled={compressing}>{compressing ? '...' : '＋ Foto'}</button><input ref={photoInput} className="sr-only" type='file' accept='image/jpeg,image/png,image/webp' onChange={selectPhoto} /></div>
      <div className="detail-copy"><span className="badge coral">{trip.source === 'ai' ? 'DRAFT AI · PERLU VERIFIKASI' : 'TEMPLATE LOKAL'}</span><h2>{trip.title}</h2><p>{trip.origin} <b>→</b> {trip.destination}</p><small>{dateLabel(trip.startDate)} – {dateLabel(trip.endDate)} · {trip.people} orang</small><span className="local-photo-note">Foto WebP maksimal 300 KB ikut tersinkron saat cloud aktif.</span></div>
      <div className="detail-actions">
        <button className="light-button" onClick={() => setModal({ type: 'trip', item: trip })}>Edit detail</button>
        {!readOnly && <button className="light-button" onClick={() => onDuplicate(trip)}>Duplikat</button>}
        <button className="light-button" onClick={() => window.print()}>Cetak / PDF</button>
        {!readOnly && (
          <button
            className="light-button ai-regen-btn"
            onClick={() => {
              setInitialRegenerateSection(tab === 'rundown' ? 'activities' : tab === 'budget' ? 'expenses' : tab === 'checklist' ? 'tasks' : tab === 'documents' ? 'documents' : 'activities');
              setShowRegenerateModal(true);
            }}
            disabled={!workspaceId || Boolean(regeneratingSection)}
          >
            ✨ Regenerasi AI...
          </button>
        )}
        {!readOnly && (
          <select
            className="ai-regenerate-select"
            aria-label="Regenerasi bagian dengan AI"
            value=""
            onChange={(event) => {
              if (event.target.value) {
                setInitialRegenerateSection(event.target.value);
                setShowRegenerateModal(true);
              }
            }}
            disabled={!workspaceId || Boolean(regeneratingSection)}
          >
            <option value="">Pilih Bagian…</option>
            <option value="activities">Rundown</option>
            <option value="tasks">Checklist</option>
            <option value="expenses">Anggaran</option>
            <option value="documents">Dokumen</option>
            <option value="risks">Risiko</option>
            <option value="travelGuide">Panduan</option>
            <option value="facts">Fakta</option>
            <option value="assumptions">Asumsi</option>
            <option value="verificationNotes">Verifikasi</option>
            <option value="conflicts">Konflik</option>
            <option value="alternatives">Alternatif</option>
          </select>
        )}
        {regeneratingSection && <span className="generation-inline-status">Menyusun {regeneratingSection}…</span>}
        <button className="danger-light" onClick={() => removeTrip(trip)}>Hapus</button>
      </div>
    </section>
    <div className="tabs-header-bar">
      <div className="tabs" role="tablist" aria-label="Bagian itinerary">
        {tabs.map(([key, label]) => (
          <button
            role="tab"
            aria-selected={tab === key}
            key={key}
            className={tab === key ? 'active' : ''}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="print-options" aria-label="Pilihan format cetak">
        <span>Export:</span>
        <button type="button" onClick={() => printAudience('participant')}>Peserta</button>
        <button type="button" onClick={() => printAudience('organizer')}>Panitia</button>
      </div>
    </div>
    {tab === 'overview' && <Overview trip={trip} spent={spent} completed={completed} setTab={setTab} setModal={readOnly ? undefined : setModal} />}
    {tab === 'rundown' && <Rundown trip={trip} setModal={readOnly ? undefined : setModal} removeItem={removeItem} updateTrip={updateTrip} toggleLock={toggleLock} toast={toast} readOnly={readOnly} />}
    {tab === 'budget' && <Budget trip={trip} spent={spent} setModal={readOnly ? undefined : setModal} removeItem={removeItem} />}
    {tab === 'checklist' && <Checklist trip={trip} completed={completed} updateList={updateList} setModal={readOnly ? undefined : setModal} removeItem={removeItem} />}
    {tab === 'documents' && <Documents trip={trip} updateList={updateList} setModal={readOnly ? undefined : setModal} removeItem={removeItem} />}
    {tab === 'collaboration' && <CollaborationPanel trip={trip} workspaceId={workspaceId} user={user} readOnly={readOnly} toast={toast} />}
    <PrintSheet trip={trip} spent={spent} />
    {modal && <EditorModal modal={modal} close={() => setModal(null)} saveItem={saveItem} updateTrip={updateTrip} />}
    <RegenerateModal
      isOpen={showRegenerateModal}
      onClose={() => setShowRegenerateModal(false)}
      onRegenerate={regenerateSection}
      isRegenerating={Boolean(regeneratingSection)}
      initialSection={initialRegenerateSection}
    />
  </div>;
}

export default TripDetail;
