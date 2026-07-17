"use client";

import { useRef, useState } from "react";
import { BOSS_ANSWER_EVENT } from "./boss-health-bar";

type Props = {
  missionId: string;
  missionSlotId: string;
  locale: "es" | "en";
  answerType?: string;
  isBigHit?: boolean;
};

const CONFIRM_ANIMATION_MS = 260;
const CARD_LEAVE_MS = 220;
const BURST_SPARK_COLORS = ["#3ee8a8", "#a689ff", "#ffffff", "#3ee8a8"];

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

function TapBurst({ active }: { active: boolean }) {
  if (!active || prefersReducedMotion()) {
    return null;
  }

  return (
    <span className="tap-burst" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, index) => (
        <span
          key={index}
          style={
            {
              "--angle": `${index * 45}deg`,
              "--spark-color": BURST_SPARK_COLORS[index % BURST_SPARK_COLORS.length],
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

export function AnswerForm({
  missionId,
  missionSlotId,
  locale,
  answerType,
  isBigHit,
}: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [selected, setSelected] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [textValue, setTextValue] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  async function submitAnswer(value: boolean | string) {
    if (saving) {
      return;
    }

    if (typeof value === "string" && value.trim().length === 0) {
      return;
    }

    setSaving(true);
    if (typeof value === "boolean") {
      setSelected(value);
    }

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(isBigHit ? [20, 30, 20, 30, 40] : [15, 25, 15]);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(BOSS_ANSWER_EVENT, { detail: { big: isBigHit } }),
      );
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
            value: typeof value === "string" ? value.trim() : value,
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

  if (answerType === "TEXT") {
    return (
      <div ref={rootRef} className="mt-6 space-y-3">
        <textarea
          className="field min-h-24 w-full resize-none"
          value={textValue}
          onChange={(event) => setTextValue(event.target.value)}
          disabled={saving}
          maxLength={500}
          placeholder={
            locale === "es" ? "Escribe tu respuesta..." : "Type your answer..."
          }
        />
        <button
          className="relative overflow-visible button-primary w-full"
          onClick={() => submitAnswer(textValue)}
          disabled={saving || textValue.trim().length === 0}
          type="button"
        >
          {locale === "es" ? "Continuar" : "Continue"}
          <TapBurst active={saving} />
        </button>
        <p aria-live="polite" className="text-sm muted">
          {status}
        </p>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="mt-6 space-y-3">
      <button
        className={`relative overflow-visible button-primary w-full ${selected === true ? "answer-selected" : ""}`}
        onClick={() => submitAnswer(true)}
        disabled={saving}
        type="button"
      >
        {locale === "es" ? "Si" : "Yes"}
        <TapBurst active={selected === true} />
      </button>
      <button
        className={`relative overflow-visible button-secondary w-full ${selected === false ? "answer-selected" : ""}`}
        onClick={() => submitAnswer(false)}
        disabled={saving}
        type="button"
      >
        <TapBurst active={selected === false} />
        No
      </button>
      <p aria-live="polite" className="text-sm muted">
        {status}
      </p>
    </div>
  );
}
