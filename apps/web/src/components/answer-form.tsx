"use client";

import { useState } from "react";

type Props = {
  missionId: string;
  missionSlotId: string;
  locale: "es" | "en";
};

export function AnswerForm({ missionId, missionSlotId, locale }: Props) {
  const [status, setStatus] = useState<string | null>(null);

  async function submitAnswer(value: boolean) {
    setStatus(locale === "es" ? "Guardando..." : "Saving...");
    const response = await fetch(`/api/client/missions/${missionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        missionSlotId,
        value,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(
        locale === "es"
          ? "No se pudo guardar."
          : "We could not save your answer.",
      );
      return;
    }

    setStatus(locale === "es" ? "Guardado." : "Saved.");
    window.location.href = data.redirectTo;
  }

  return (
    <div className="mt-6 space-y-3">
      <button
        className="button-primary w-full"
        onClick={() => submitAnswer(true)}
        type="button"
      >
        {locale === "es" ? "Si" : "Yes"}
      </button>
      <button
        className="button-secondary w-full"
        onClick={() => submitAnswer(false)}
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
