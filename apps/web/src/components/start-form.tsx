"use client";

import { useState } from "react";

type Props = {
  locale: "es" | "en";
};

export function StartForm({ locale }: Props) {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function submit() {
    if (status === "sending" || phone.trim().length === 0) {
      return;
    }

    setStatus("sending");

    try {
      const response = await fetch("/api/client/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawPhone: phone, locale }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        return;
      }

      setStatus("sent");

      if (data.redirectTo) {
        window.location.href = data.redirectTo;
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="mt-6 rounded-2xl border border-[#3ee8a8]/40 bg-[#1a2f2a] px-4 py-4 text-sm text-[#a9f5d6]">
        {locale === "es"
          ? "Listo. Tambien te enviamos el enlace por mensaje de texto."
          : "Done. We also texted you the link."}
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <label className="block">
        <span className="mb-2 block text-sm font-medium">
          {locale === "es" ? "Tu numero de telefono" : "Your phone number"}
        </span>
        <input
          className="field"
          inputMode="tel"
          onChange={(event) => setPhone(event.target.value)}
          placeholder="(555) 555-0101"
          type="tel"
          value={phone}
        />
      </label>
      <button
        className="button-primary w-full"
        disabled={status === "sending" || phone.trim().length === 0}
        onClick={submit}
        type="button"
      >
        {status === "sending"
          ? locale === "es"
            ? "Enviando..."
            : "Sending..."
          : locale === "es"
            ? "Enviarme el enlace"
            : "Text me the link"}
      </button>
      {status === "error" ? (
        <p aria-live="polite" className="text-sm text-[#f5b8b8]">
          {locale === "es"
            ? "No se pudo enviar. Intenta de nuevo."
            : "We could not send it. Please try again."}
        </p>
      ) : null}
    </div>
  );
}
