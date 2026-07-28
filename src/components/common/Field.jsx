'use client';
export function Field({ label, value, onChange, ...props }) { return <label>{label}<input value={value} onChange={(event) => onChange(event.target.value)} {...props} /></label>; }
