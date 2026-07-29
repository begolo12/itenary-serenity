'use client';
import { PanelHead } from '../common/PanelHead';
import { downloadCsv, effectiveBudget, rupiah } from '../../lib/trips';

export function Budget({ trip, spent, setModal, removeItem }) {
  const expenses = trip.expenses || [];
  const paid = expenses.filter((item) => item.paid).reduce((sum, item) => sum + Number(item.actualAmount ?? item.amount ?? 0), 0);
  const hasBudget = trip.budgetMode !== 'open' && Number(trip.budget || 0) > 0;
  const budgetTotal = effectiveBudget(trip);
  const remaining = budgetTotal - spent;

  return (
    <section className="panel">
      <PanelHead
        eyebrow="ESTIMASI BIAYA"
        title={rupiah(spent, trip.currency)}
        action="＋ Tambah biaya"
        onAction={() => setModal({ type: 'expense', item: null })}
      />
      <div className="export-row">
        <button
          className="quiet"
          onClick={() =>
            downloadCsv(`${trip.destination || trip.venue || 'serenity'}-budget.csv`, [
              ['Kategori', 'Deskripsi', 'Estimasi', 'Aktual', 'Status'],
              ...expenses.map((item) => [
                item.category,
                item.description,
                item.amount,
                item.actualAmount ?? '',
                item.paid ? 'Dibayar' : item.verificationStatus || 'estimated',
              ]),
            ])
          }
        >
          Ekspor budget CSV
        </button>
      </div>

      <div className="budget-summary">
        <span>
          Rencana
          <strong>
            {hasBudget
              ? `${rupiah(budgetTotal, trip.currency)}${
                  trip.budgetMode === 'per_person' ? ` · ${rupiah(trip.budget, trip.currency)}/peserta` : ''
                }`
              : 'Belum ditentukan'}
          </strong>
        </span>
        <span>
          Terpakai<strong>{rupiah(spent, trip.currency)}</strong>
        </span>
        <span>
          Sudah dibayar<strong>{rupiah(paid, trip.currency)}</strong>
        </span>
        <span>
          Selisih
          <strong className={hasBudget && remaining < 0 ? 'negative' : ''}>
            {hasBudget ? rupiah(remaining, trip.currency) : '—'}
          </strong>
        </span>
      </div>

      {!expenses.length ? (
        <p className="panel-empty">
          Belum ada biaya. Tambahkan estimasi per kategori agar {trip.planType === 'trip' ? 'perjalanan' : 'kegiatan'} mudah dikendalikan.
        </p>
      ) : (
        <div className="data-list budget-list">
          {expenses.map((item) => (
            <article key={item.id} className="budget-card">
              <div className="budget-card-main">
                <span className="budget-icon">{(item.category || 'B').slice(0, 1)}</span>
                <div className="budget-copy">
                  <strong>{item.category || 'Lainnya'}</strong>
                  <small>
                    {item.description || 'Tanpa deskripsi'}
                    {item.note ? ` · ${item.note}` : ''}
                  </small>
                </div>
                <div className="budget-amount">
                  <b>{rupiah(item.actualAmount ?? item.amount ?? 0, trip.currency)}</b>
                  {item.actualAmount != null && <small className="actual-label">Aktual</small>}
                </div>
              </div>

              <div className="budget-card-footer">
                <span className={`paid-badge ${item.paid ? 'paid' : ''}`}>
                  {item.paid ? 'Dibayar' : item.verificationStatus === 'verified' ? 'Terverifikasi' : 'Estimasi'}
                </span>
                <div className="budget-actions">
                  <button className="mini" onClick={() => setModal({ type: 'expense', item })}>
                    Edit
                  </button>
                  <button className="mini danger" onClick={() => removeItem('expenses', item.id, 'biaya')}>
                    Hapus
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
