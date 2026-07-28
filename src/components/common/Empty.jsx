'use client';
export function Empty({ title, text, action, actionText }) { return <div className="empty card"><span className="empty-mark">S</span><h2>{title}</h2><p>{text}</p><button className="primary" onClick={action}>{actionText}</button></div>; }
