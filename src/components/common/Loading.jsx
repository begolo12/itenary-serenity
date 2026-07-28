'use client';
export function Loading() { return <div className="loading card" role="status"><i /><strong>Membuka atlas perjalanan...</strong></div>; }

export function Skeleton({ height = 180, count = 1 }) {
  return <div className="skeleton-group">{Array.from({length: count}, (_, i) => (
    <div key={i} className="skeleton card" style={{height}} />
  ))}</div>;
}
