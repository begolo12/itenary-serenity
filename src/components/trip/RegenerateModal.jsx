'use client';
import { useState, useEffect } from 'react';

const REGEN_OPTIONS = [
  ['activities', 'Rundown / Agenda'],
  ['tasks', 'Checklist Tugas'],
  ['expenses', 'Anggaran Biaya'],
  ['documents', 'Dokumen & Persiapan'],
  ['risks', 'Mitigasi Risiko'],
  ['travelGuide', 'Panduan Perjalanan'],
  ['facts', 'Fakta'],
  ['assumptions', 'Asumsi'],
  ['verificationNotes', 'Verifikasi'],
  ['conflicts', 'Konflik'],
  ['alternatives', 'Alternatif'],
];

export default function RegenerateModal({ isOpen, onClose, onRegenerate, isRegenerating, initialSection = 'activities' }) {
  const [section, setSection] = useState(initialSection);
  const [customInstruction, setCustomInstruction] = useState('');

  useEffect(() => {
    if (initialSection) setSection(initialSection);
  }, [initialSection]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!section) return;
    onRegenerate(section, customInstruction);
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !isRegenerating) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="regen-modal-title">
        <header>
          <h2 id="regen-modal-title">✨ Regenerasi AI dengan Instruksi</h2>
          <button type="button" onClick={onClose} disabled={isRegenerating} aria-label="Tutup">×</button>
        </header>

        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Bagian yang Ingin Diperbarui</span>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              disabled={isRegenerating}
            >
              {REGEN_OPTIONS.map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </label>

          <label className="field" style={{ marginTop: '16px' }}>
            <span>Instruksi Tambahan / Catatan Perubahan</span>
            <textarea
              rows={4}
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder="Contoh: Saya mau rundownnya bukan ke lokasi A tapi ke lokasi B. Hari ke-2 tambahkan wisata kuliner malam."
              disabled={isRegenerating}
            />
            <small style={{ color: 'var(--text-muted, #888)', display: 'block', marginTop: '6px' }}>
              💡 Item yang dikunci (🔒) di rundown/checklist akan tetap dipertahankan oleh AI.
            </small>
          </label>

          <footer>
            <button type="button" className="light-button" onClick={onClose} disabled={isRegenerating}>
              Batal
            </button>
            <button type="submit" className="primary-button" disabled={isRegenerating}>
              {isRegenerating ? `Menyusun ${section}…` : '🚀 Mulai Regenerasi AI'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
