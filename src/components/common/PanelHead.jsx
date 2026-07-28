'use client';
export function PanelHead({ eyebrow, title, action, onAction }) { return <header className="panel-head"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action && <button className="primary" onClick={onAction}>{action}</button>}</header>; }
