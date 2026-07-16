"use client";

import { useRef, useState } from "react";

type Props = {
  missionId: string;
  missionSlotId: string;
  locale: "es" | "en";
};

const CONFIRM_ANIMATION_MS = 260;
const CARD_LEAVE_MS = 220;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export function AnswerForm({ missionId, missionSlotId, locale }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [selected, setSelected] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  async function submitAnswer(value: boolean) {
    if (saving) {
      return;
    }

    setSaving(true);
    setSelected(value);

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(12);
    }

    setStatus(locale === "es" ? "Guardando..." : "Saving...");

    await new Promise((resolve) => setTimeout(resolve, CONFIRM_ANIMATION_MS));

    try {
      const response = await fetch(
        `/api/client/missions/${missionId}/answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            missionSlotId,
            value,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setStatus(
          locale === "es"
            ? "No se pudo guardar."
            : "We could not save your answer.",
        );
        setSaving(false);
        setSelected(null);
        return;
      }

      setStatus(locale === "es" ? "Guardado." : "Saved.");

      const card = rootRef.current?.closest(".card");
      card?.classList.add("card-leaving");

      if (!prefersReducedMotion()) {
        await new Promise((resolve) => setTimeout(resolve, CARD_LEAVE_MS));
      }

      window.location.href = data.redirectTo;
    } catch {
      setStatus(
        locale === "es"
          ? "No se pudo guardar."
          : "We could not save your answer.",
      );
      setSaving(false);
      setSelected(null);
    }
  }

  return (
    <div ref={rootRef} className="mt-6 space-y-3">
      <button
        className={`button-primary w-full ${selected === true ? "answer-selected" : ""}`}
        onClick={() => submitAnswer(true)}
        disabled={saving}
        type="button"
      >
        {locale === "es" ? "Si" : "Yes"}
      </button>
      <button
        className={`button-secondary w-full ${selected === false ? "answer-selected" : ""}`}
        onClick={() => submitAnswer(false)}
        disabled={saving}
        type="button"
      >
        No
      </button>
      <p aria-live="polite" className="text-sm muted">
        {status}
      </p>
    </div>
  );
}
