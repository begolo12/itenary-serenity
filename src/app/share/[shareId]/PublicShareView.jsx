'use client';

import { useEffect, useState } from 'react';
import { getPublicTripShare } from '../../../lib/cloud-sync';
import { dateLabel, rupiah } from '../../../lib/trips';

export default function PublicShareView({ shareId }) {
  const [share, setShare] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('rundown');

  useEffect(() => {
    getPublicTripShare(shareId).then(setShare).catch((reason) => setError(reason.code === 'permission-denied' ? 'Tautan tidak ditemukan atau sudah kedaluwarsa.' : reason.message || 'Tautan tidak dapat dibuka.'));
  }, [shareId]);

  if (error) {
    return (
      <main className="ps-container">
        <div className="ps-card ps-error-card">
          <div className="ps-brand-tag">SERENITY ATLAS</div>
          <h1>Tautan Tidak Tersedia</h1>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!share) {
    return (
      <main className="ps-container">
        <div className="ps-card ps-loading-card">
          <div className="ps-brand-tag">SERENITY ATLAS</div>
          <h1>Memuat Rencana Perjalanan...</h1>
          <div className="ps-skeleton-bar" />
        </div>
      </main>
    );
  }

  const trip = share.snapshot || {};
  const activities = trip.activities || [];
  const expenses = trip.expenses || [];
  const tasks = trip.tasks || [];
  const documents = trip.documents || [];
  const notes = trip.verificationNotes || [];

  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.actualAmount ?? e.amount ?? 0), 0);
  const completedTasks = tasks.filter((t) => t.done || t.status === 'done').length;

  return (
    <main className="ps-container">
      {/* Editorial Header */}
      <header className="ps-hero card">
        <div className="ps-hero-badge">
          <span className="ps-pulse-dot" />
          <span>SERENITY ATLAS · PUBLIK READ ONLY</span>
        </div>
        <h1 className="ps-hero-title">{trip.title || share.title}</h1>
        <p className="ps-hero-route">
          <span>{trip.origin || 'Asal'}</span>
          <span className="ps-arrow">→</span>
          <span>{trip.destination || trip.venue || 'Tujuan'}</span>
        </p>
        <div className="ps-hero-meta">
          <div className="ps-meta-chip">
            <span className="ps-icon">📅</span>
            <span>{dateLabel(trip.startDate)} – {dateLabel(trip.endDate)}</span>
          </div>
          <div className="ps-meta-chip">
            <span className="ps-icon">👥</span>
            <span>{trip.people || trip.participants?.total || 1} Peserta</span>
          </div>
          {trip.budget > 0 && (
            <div className="ps-meta-chip">
              <span className="ps-icon">💰</span>
              <span>Anggaran: {rupiah(trip.budget, trip.currency || 'IDR')}</span>
            </div>
          )}
        </div>
        <div className="ps-hero-actions">
          <button className="primary" type="button" onClick={() => window.print()}>
            🖨️ Cetak / Simpan PDF
          </button>
        </div>
      </header>

      {/* Summary Stat Cards */}
      <section className="ps-stats-grid">
        <div className="ps-stat-card">
          <span className="ps-stat-label">Total Agenda</span>
          <span className="ps-stat-val">{activities.length}</span>
          <small className="ps-stat-sub">Kegiatan terjadwal</small>
        </div>
        <div className="ps-stat-card">
          <span className="ps-stat-label">Estimasi Biaya</span>
          <span className="ps-stat-val">{rupiah(totalSpent, trip.currency || 'IDR')}</span>
          <small className="ps-stat-sub">Dari {expenses.length} item anggaran</small>
        </div>
        <div className="ps-stat-card">
          <span className="ps-stat-label">Tugas Selesai</span>
          <span className="ps-stat-val">{completedTasks} / {tasks.length}</span>
          <small className="ps-stat-sub">Checklist persiapan</small>
        </div>
      </section>

      {/* Navigation Tabs */}
      <nav className="ps-tabs">
        <button className={activeTab === 'rundown' ? 'active' : ''} onClick={() => setActiveTab('rundown')}>
          📅 Rundown ({activities.length})
        </button>
        <button className={activeTab === 'budget' ? 'active' : ''} onClick={() => setActiveTab('budget')}>
          💵 Biaya ({expenses.length})
        </button>
        <button className={activeTab === 'checklist' ? 'active' : ''} onClick={() => setActiveTab('checklist')}>
          ✅ Checklist ({tasks.length})
        </button>
        <button className={activeTab === 'info' ? 'active' : ''} onClick={() => setActiveTab('info')}>
          ℹ️ Info & Catatan
        </button>
      </nav>

      {/* Tab Contents */}
      <section className="ps-content-card card">
        {activeTab === 'rundown' && (
          <div className="ps-tab-panel">
            <h2>Agenda Perjalanan</h2>
            {!activities.length ? (
              <p className="ps-empty">Belum ada agenda kegiatan.</p>
            ) : (
              <div className="ps-timeline">
                {activities.map((item, idx) => (
                  <article key={item.id || idx} className="ps-timeline-item">
                    <div className="ps-timeline-time">{item.time || '—'}</div>
                    <div className="ps-timeline-dot" />
                    <div className="ps-timeline-body">
                      <strong>{item.title}</strong>
                      {item.location && <p className="ps-loc">📍 {item.location}</p>}
                      {item.note && <p className="ps-note">{item.note}</p>}
                      {item.cost > 0 && <span className="ps-tag">Biaya: {rupiah(item.cost, trip.currency || 'IDR')}</span>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'budget' && (
          <div className="ps-tab-panel">
            <h2>Rincian Perkiraan Biaya</h2>
            {!expenses.length ? (
              <p className="ps-empty">Belum ada pengeluaran dicatat.</p>
            ) : (
              <div className="ps-table-wrap">
                <table className="ps-table">
                  <thead>
                    <tr>
                      <th>Kategori / Deskripsi</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td>
                          <strong>{item.category || item.description || 'Pengeluaran'}</strong>
                          {item.note && <small className="ps-subtext">{item.note}</small>}
                        </td>
                        <td>
                          <span className={`ps-status-pill ${item.paid ? 'paid' : 'unpaid'}`}>
                            {item.paid ? 'Sudah Dibayar' : 'Belum Dibayar'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          {rupiah(item.amount || item.actualAmount || 0, trip.currency || 'IDR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'checklist' && (
          <div className="ps-tab-panel">
            <h2>Checklist Persiapan</h2>
            {!tasks.length ? (
              <p className="ps-empty">Belum ada daftar tugas.</p>
            ) : (
              <ul className="ps-checklist">
                {tasks.map((item, idx) => (
                  <li key={item.id || idx} className={`ps-check-item ${item.done || item.status === 'done' ? 'done' : ''}`}>
                    <span className="ps-check-icon">{item.done || item.status === 'done' ? '☑️' : '⏹️'}</span>
                    <div>
                      <strong>{item.title}</strong>
                      {item.assigneeId && <small>PIC: {item.assigneeId}</small>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'info' && (
          <div className="ps-tab-panel">
            <h2>Ringkasan & Catatan Verifikasi</h2>
            <div className="ps-info-block">
              <h3>Tujuan / Catatan Umum</h3>
              <p>{trip.summary || trip.purpose || 'Rencana perjalanan ini dibagikan untuk dibaca bersama.'}</p>
            </div>
            {notes.length > 0 && (
              <div className="ps-info-block">
                <h3>Catatan Verifikasi</h3>
                <ul>
                  {notes.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
            {documents.length > 0 && (
              <div className="ps-info-block">
                <h3>Dokumen Terlampir</h3>
                <ul>
                  {documents.map((doc, idx) => (
                    <li key={doc.id || idx}>📄 <strong>{doc.title || doc.name}</strong> ({doc.type || 'Berkas'})</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Footer Info */}
      <footer className="ps-footer">
        <p>🔒 Dibagikan secara aman via <strong>Serenity Atlas</strong></p>
        <p className="ps-expiry">
          Tautan aktif sampai {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(share.expiresAt))}
        </p>
      </footer>
    </main>
  );
}
