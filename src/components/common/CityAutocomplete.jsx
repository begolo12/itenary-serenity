'use client';
import { useState, useEffect, useRef } from 'react';

const INDONESIAN_CITIES = [
  "Jakarta", "Bandung", "Surabaya", "Yogyakarta", "Semarang", "Medan", "Makassar",
  "Palembang", "Denpasar", "Bali", "Malang", "Solo", "Batam", "Padang", "Pekanbaru",
  "Balikpapan", "Banjarmasin", "Manado", "Pontianak", "Samarinda", "Lombok", "Bogor",
  "Depok", "Tangerang", "Bekasi", "Labuan Bajo", "Raja Ampat", "Bandar Lampung",
  "Jambi", "Ambon", "Jayapura", "Aceh", "Banda Aceh", "Kupang", "Mataram",
  "Manokwari", "Sorong", "Ternate", "Palu", "Kendari", "Gorontalo", "Mamuju",
  "Tanjung Pinang", "Pangkal Pinang", "Bengkulu", "Palangkaraya", "Tarakan",
  "Tanjung Selor", "Cirebon", "Tasikmalaya", "Purwokerto", "Magelang", "Salatiga",
  "Batu", "Kediri", "Madiun", "Probolinggo", "Banyuwangi", "Jember", "Garut", "Sukabumi",
];

export function CityAutocomplete({ value, onChange, placeholder }) {
  const [input, setInput] = useState(value || "");
  const [show, setShow] = useState(false);
  const ref = useRef(null);
  const filtered = INDONESIAN_CITIES.filter((c) => c.toLowerCase().includes(input.toLowerCase())).slice(0, 5);
  useEffect(() => {
    setInput(value || "");
  }, [value]);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setShow(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  return <div ref={ref} className="city-autocomplete"><input type="text" value={input} onChange={(e) => { const next = e.target.value; setInput(next); onChange(next); setShow(true); }} onFocus={() => setShow(true)} placeholder={placeholder} /><button type="button" className="clear-input" onClick={() => { setInput(""); onChange(""); }} hidden={!input}>&times;</button>{show && input && filtered.length > 0 && <ul className="city-suggestions">{filtered.map((c) => <li key={c} onMouseDown={() => { setInput(c); onChange(c); setShow(false); }}>{c}</li>)}</ul>}</div>;
}
