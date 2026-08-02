"use client";
import { useState } from "react";

const ONBOARDING_KEY = "serenity-itinerary-onboarded";

export function hasSeenOnboarding() {
  try { return localStorage.getItem(ONBOARDING_KEY) === "1"; } catch { return true; }
}

export function markOnboardingSeen() {
  try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch {}
}

const STEPS = [
  { title: "Buat itinerary", text: "Gunakan tombol ＋ Buat itinerary di sidebar atau FAB untuk menyusun rencana baru.", target: "sidebar-create" },
  { title: "Atur di tab", text: "Buka detail trip lalu jelajahi tab Ringkasan, Rundown, Anggaran, Checklist, dan Dokumen.", target: "tabs-guide" },
  { title: "Ekspor & bagikan", text: "Cetak/PDF, CSV, ICS kalender, dan tautan berbagi tersedia di detail trip.", target: "export-guide" },
];

export default function OnboardingTour({ onDone }) {
  const [step, setStep] = useState(0);
  if (step >= STEPS.length) return null;
  const current = STEPS[step];
  const advance = () => {
    if (step + 1 >= STEPS.length) {
      markOnboardingSeen();
      onDone?.();
    } else {
      setStep(step + 1);
    }
  };
  const skip = () => {
    markOnboardingSeen();
    onDone?.();
  };
  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-label="Panduan singkat Serenity">
      <div className="onboarding-backdrop" onClick={skip} />
      <div className="onboarding-popover">
        <span className="onboarding-step">Langkah {step + 1} / {STEPS.length}</span>
        <h3>{current.title}</h3>
        <p>{current.text}</p>
        <div className="onboarding-actions">
          <button type="button" className="quiet" onClick={skip}>Lewati</button>
          <button type="button" className="primary" onClick={advance}>
            {step + 1 >= STEPS.length ? "Selesai" : "Lanjut"}
          </button>
        </div>
      </div>
    </div>
  );
}
