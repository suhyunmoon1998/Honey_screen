"use client";

import { useState } from "react";

type Props = {
  token: string;
  locale: "es" | "en";
  messages: {
    privacyConsent: string;
    messageConsent: string;
    requestOtp: string;
    verifyOtp: string;
  };
};

export function InvitationFlow({ token, locale, messages }: Props) {
  const [phone, setPhone] = useState("(555) 555-0101");
  const [code, setCode] = useState("");
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedMessages, setAcceptedMessages] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [step, setStep] = useState<"request" | "verify">("request");
  const [status, setStatus] = useState<string | null>(null);

  async function requestCode() {
    setStatus(locale === "es" ? "Enviando..." : "Sending...");
    const response = await fetch("/api/client/invitations/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        rawPhone: phone,
        locale,
        acceptedPrivacy,
        acceptedMessages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error ?? "No fue posible enviar el codigo.");
      return;
    }

    setDevCode(data.devCode ?? null);
    setStep("verify");
    setStatus(locale === "es" ? "Codigo listo." : "Code ready.");
  }

  async function verifyCode() {
    setStatus(locale === "es" ? "Verificando..." : "Verifying...");
    const response = await fetch("/api/client/invitations/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        rawPhone: phone,
        code,
        locale,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error ?? "No fue posible verificar el codigo.");
      return;
    }

    setStatus(locale === "es" ? "Verificado." : "Verified.");
    window.location.href = data.redirectTo;
  }

  return (
    <div className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-medium">Telefono movil</span>
        <input
          className="field"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </label>

      {step === "request" ? (
        <>
          <label className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4">
            <input
              checked={acceptedPrivacy}
              onChange={(event) => setAcceptedPrivacy(event.target.checked)}
              type="checkbox"
            />
            <span>{messages.privacyConsent}</span>
          </label>
          <label className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4">
            <input
              checked={acceptedMessages}
              onChange={(event) => setAcceptedMessages(event.target.checked)}
              type="checkbox"
            />
            <span>{messages.messageConsent}</span>
          </label>
          <button
            className="button-primary w-full"
            onClick={requestCode}
            type="button"
          >
            {messages.requestOtp}
          </button>
        </>
      ) : (
        <>
          {devCode ? (
            <div className="rounded-2xl border border-dashed border-accent bg-white px-4 py-3 text-sm">
              Codigo de desarrollo: <strong>{devCode}</strong>
            </div>
          ) : null}
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Codigo</span>
            <input
              className="field"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <button
            className="button-primary w-full"
            onClick={verifyCode}
            type="button"
          >
            {messages.verifyOtp}
          </button>
        </>
      )}
      <p aria-live="polite" className="text-sm muted">
        {status}
      </p>
    </div>
  );
}
