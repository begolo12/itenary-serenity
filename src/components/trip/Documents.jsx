'use client';
import { PanelHead } from '../common/PanelHead';

export default function Documents({ trip, setModal, removeItem }) {
  const documents = trip.documents || [];
  return <section className="panel documents-panel">
    <PanelHead eyebrow='DOKUMEN & RESERVASI' title={`${documents.length} dokumen`} action='＋ Tambah dokumen' onAction={() => setModal({ type: 'document', item: null })} />
    <p className="panel-intro">Simpan nomor booking, dokumen identitas, tiket, dan catatan penting di satu tempat. Semua kolom bisa diubah kapan saja.</p>
    {!documents.length ? <p className="panel-empty">Belum ada dokumen. Tambahkan dokumen atau nomor reservasi pertama Anda.</p> : <div className="documents-grid">
      {documents.map((item) => <article className="document-card card" key={item.id}>
        <div className="document-card-head"><span className="document-icon">▣</span><span className={`document-status ${item.status === 'Selesai' ? 'complete' : ''}`}>{item.status || 'Perlu dicek'}</span></div>
        <p className="eyebrow">{item.type || 'Dokumen'}</p>
        <h3>{item.title}</h3>
        <code>{item.number || 'Nomor belum diisi'}</code>
        <p>{item.note || 'Tambahkan catatan atau instruksi verifikasi.'}</p>
        <div className="document-actions"><button className="mini" onClick={() => setModal({ type: 'document', item })}>Edit</button><button className="mini danger" onClick={() => removeItem('documents', item.id, 'dokumen')}>Hapus</button></div>
      </article>)}
    </div>}
  </section>;
}
