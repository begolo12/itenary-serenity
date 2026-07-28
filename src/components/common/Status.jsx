'use client';
import { useEffect, useState } from 'react';

export function Status({ message, kind = 'success', onClose }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!message) return;
    const t1 = setTimeout(() => setExiting(true), 4000);
    const t2 = setTimeout(() => onClose?.(), 4300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [message, onClose]);

  return (
    <div className={`notice-bar ${kind}${exiting ? ' exiting' : ''}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{message}</span>
      <button onClick={() => { setExiting(true); setTimeout(() => onClose?.(), 300); }} aria-label="Tutup pemberitahuan">×</button>
    </div>
  );
}
