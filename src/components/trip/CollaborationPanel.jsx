'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  addTripComment,
  createPublicTripShare,
  createTripVersion,
  setTripApproval,
  watchTripCollaboration,
} from '../../lib/cloud-sync';

function shortActor(uid) {
  return uid ? `Anggota · ${String(uid).slice(0, 8)}` : 'Anggota';
}

function formatDate(value) {
  if (!value) return 'Baru saja';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function CollaborationPanel({ trip, workspaceId, user, readOnly = false, toast }) {
  const [comments, setComments] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [versions, setVersions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [comment, setComment] = useState('');
  const [approval, setApproval] = useState('pending');
  const [approvalNote, setApprovalNote] = useState('');
  const [shareDays, setShareDays] = useState('7');
  const [busy, setBusy] = useState('');
  const [shareLink, setShareLink] = useState('');

  useEffect(() => {
    if (!workspaceId || !trip?.id || !user) return undefined;
    return watchTripCollaboration(workspaceId, trip.id, {
      comments: setComments,
      approvals: (next) => {
        setApprovals(next);
        const mine = next.find((item) => item.id === user.uid);
        if (mine) {
          setApproval(mine.status || 'pending');
          setApprovalNote(mine.note || '');
        }
      },
      versions: setVersions,
      auditLogs: setAuditLogs,
      onError: (error) => toast?.(error?.message || 'Data kolaborasi gagal dimuat.', 'error'),
    });
  }, [workspaceId, trip?.id, user, toast]);

  const latestApproval = useMemo(() => approvals.find((item) => item.id === user?.uid), [approvals, user]);

  const run = async (name, operation, success) => {
    setBusy(name);
    try {
      await operation();
      toast?.(success);
    } catch (error) {
      toast?.(error.message || 'Aksi kolaborasi gagal.', 'error');
    } finally {
      setBusy('');
    }
  };

  const submitComment = (event) => {
    event.preventDefault();
    run('comment', () => addTripComment(workspaceId, trip.id, user.uid, comment), 'Komentar ditambahkan.');
    setComment('');
  };

  const saveApproval = () => run('approval', () => setTripApproval(workspaceId, trip.id, user.uid, approval, approvalNote), 'Status approval disimpan.');

  const saveVersion = () => run('version', () => createTripVersion(workspaceId, trip, user.uid, 'Snapshot manual sebelum perubahan berikutnya'), 'Versi itinerary disimpan.');

  const shareTrip = () => run('share', async () => {
    const result = await createPublicTripShare(workspaceId, trip, user.uid, shareDays);
    const link = `${window.location.origin}/share/${result.shareId}`;
    setShareLink(link);
    try { await navigator.clipboard.writeText(link); } catch { /* Clipboard may be unavailable in the browser. */ }
  }, 'Tautan publik dibuat dan disalin jika browser mengizinkan.');

  return <section className="collaboration-panel panel" aria-labelledby="collaboration-title">
    <header className="panel-head">
      <div><p className="eyebrow">KOLABORASI</p><h2 id="collaboration-title">Ruang kerja bersama</h2></div>
      <span className="badge">{readOnly ? 'Viewer' : 'Editor'}</span>
    </header>
    <div className="collab-grid">
      <article className="collab-card">
        <p className="eyebrow">Komentar</p>
        <h3>Catatan tim</h3>
        <div className="collab-list">{comments.length ? comments.slice(0, 8).map((item) => <div className="collab-item" key={item.id}><p>{item.text}</p><small>{shortActor(item.actorUid)} · {formatDate(item.createdAt)}</small></div>) : <p className="muted">Belum ada komentar.</p>}</div>
        <form onSubmit={submitComment} className="collab-form"><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Tulis catatan untuk tim…" rows="3" disabled={readOnly || busy === 'comment'} /><button className="primary" type="submit" disabled={readOnly || !comment.trim() || busy === 'comment'}>{busy === 'comment' ? 'Mengirim…' : 'Kirim komentar'}</button></form>
      </article>
      <article className="collab-card">
        <p className="eyebrow">Approval</p>
        <h3>Keputusan rencana</h3>
        <label>Status<select value={approval} onChange={(event) => setApproval(event.target.value)} disabled={readOnly || busy === 'approval'}><option value="pending">Menunggu review</option><option value="approved">Disetujui</option><option value="changes_requested">Perlu perubahan</option></select></label>
        <label>Catatan reviewer<textarea value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} rows="3" placeholder="Apa yang perlu diperiksa?" disabled={readOnly || busy === 'approval'} /></label>
        <button className="primary" type="button" onClick={saveApproval} disabled={readOnly || busy === 'approval'}>{busy === 'approval' ? 'Menyimpan…' : 'Simpan approval'}</button>
        {latestApproval && <small className="collab-hint">Status terakhir: {latestApproval.status}</small>}
      </article>
      <article className="collab-card">
        <p className="eyebrow">Versi & audit</p>
        <h3>Jejak perubahan</h3>
        <button className="light-button" type="button" onClick={saveVersion} disabled={readOnly || busy === 'version'}>{busy === 'version' ? 'Menyimpan…' : 'Simpan versi saat ini'}</button>
        <div className="collab-list compact">{versions.slice(0, 5).map((item) => <div className="collab-item" key={item.id}><strong>{item.note || 'Snapshot itinerary'}</strong><small>{shortActor(item.actorUid)} · {formatDate(item.createdAt)}</small></div>)}{auditLogs.slice(0, 4).map((item) => <div className="collab-item" key={item.id}><strong>{item.action}</strong><small>{shortActor(item.actorUid)} · {formatDate(item.createdAt)}</small></div>)}{!versions.length && !auditLogs.length && <p className="muted">Aktivitas kolaborasi akan muncul di sini.</p>}</div>
      </article>
      <article className="collab-card">
        <p className="eyebrow">Share publik</p>
        <h3>Bagikan versi read-only</h3>
        <p className="muted">Tautan hanya menampilkan snapshot itinerary dan otomatis kedaluwarsa.</p>
        <label>Masa aktif<select value={shareDays} onChange={(event) => setShareDays(event.target.value)} disabled={readOnly || busy === 'share'}><option value="1">1 hari</option><option value="7">7 hari</option><option value="30">30 hari</option></select></label>
        <button className="primary" type="button" onClick={shareTrip} disabled={readOnly || busy === 'share'}>{busy === 'share' ? 'Membuat tautan…' : 'Buat tautan publik'}</button>
        {shareLink && <label className="share-link">Tautan siap<input readOnly value={shareLink} onFocus={(event) => event.target.select()} /></label>}
      </article>
    </div>
  </section>;
}
