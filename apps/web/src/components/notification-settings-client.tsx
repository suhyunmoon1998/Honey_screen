"use client";

import { useState } from "react";
import type { Locale } from "@honey/i18n";
import { getMessages } from "@honey/i18n";

type SettingsState = {
  clientLocale: string;
  timeZone: string;
  allowedReminderTimes: string[];
  preference: {
    enabled: boolean;
    preferredLocalTime: string;
    quietHoursStart: string;
    quietHoursEnd: string;
    consentVersion: string | null;
  };
  subscription: {
    hasActiveSubscription: boolean;
    activeSubscriptionId: string | null;
    activeDeviceInstallationId: string | null;
  };
  simulatedEnvironment: boolean;
  consentVersion: string;
  vapidPublicKey?: string | null;
};

type BrowserPermissionState = "default" | "granted" | "denied" | "unsupported";

function getInitialPermissionState(): BrowserPermissionState {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "unsupported";
  }

  return Notification.permission;
}

function getInstallationId() {
  const key = "honey_installation_id_v1";
  const existing = window.localStorage.getItem(key);

  if (existing) {
    return existing;
  }

  const created = crypto.randomUUID();
  window.localStorage.setItem(key, created);
  return created;
}

function toBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createSimulatedSubscription(installationId: string) {
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const p256dh = crypto.getRandomValues(new Uint8Array(65));

  return {
    endpoint: `https://push.example.test/${installationId}/${Date.now()}`,
    auth: toBase64Url(auth),
    p256dh: toBase64Url(p256dh),
  };
}

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function ensurePushSubscription(input: {
  installationId: string;
  vapidPublicKey?: string | null;
  simulatedEnvironment: boolean;
}) {
  const registration = await navigator.serviceWorker.ready;

  if (
    !input.simulatedEnvironment &&
    "pushManager" in registration &&
    input.vapidPublicKey
  ) {
    const existing = await registration.pushManager.getSubscription();

    if (existing) {
      const json = existing.toJSON();
      return {
        endpoint: json.endpoint ?? existing.endpoint,
        auth: json.keys?.auth ?? "",
        p256dh: json.keys?.p256dh ?? "",
      };
    }

    const created = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(input.vapidPublicKey),
    });
    const json = created.toJSON();
    return {
      endpoint: json.endpoint ?? created.endpoint,
      auth: json.keys?.auth ?? "",
      p256dh: json.keys?.p256dh ?? "",
    };
  }

  return createSimulatedSubscription(input.installationId);
}

async function loadSettings() {
  const response = await fetch("/api/client/notifications/settings", {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("SETTINGS_LOAD_FAILED");
  }

  return (await response.json()) as SettingsState;
}

async function postPermissionEvent(
  permission: Exclude<BrowserPermissionState, "unsupported">,
) {
  await fetch("/api/client/notifications/permission", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ permission }),
  });
}

export function NotificationSettingsClient(props: {
  initialState: SettingsState;
  locale: Locale;
}) {
  const messages = getMessages(props.locale);
  const [settings, setSettings] = useState(props.initialState);
  const [preferredLocalTime, setPreferredLocalTime] = useState(
    props.initialState.preference.preferredLocalTime,
  );
  const [permission, setPermission] = useState<BrowserPermissionState>(
    getInitialPermissionState,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disableNotice, setDisableNotice] = useState<string | null>(null);

  async function refreshSettings() {
    const next = await loadSettings();
    setSettings(next);
    setPreferredLocalTime(next.preference.preferredLocalTime);
  }

  async function handleEnable() {
    if (permission === "unsupported") {
      return;
    }

    setPending(true);
    setError(null);
    setDisableNotice(null);

    try {
      await postPermissionEvent("default");
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission !== "granted") {
        await postPermissionEvent(nextPermission);
        return;
      }

      const installationId = getInstallationId();
      const subscription = await ensurePushSubscription({
        installationId,
        vapidPublicKey: settings.vapidPublicKey,
        simulatedEnvironment: settings.simulatedEnvironment,
      });

      const response = await fetch("/api/client/notifications/settings", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          preferredLocalTime,
          consentVersion: settings.consentVersion,
          anonymousDeviceId: installationId,
          platformHint: navigator.userAgent.slice(0, 120),
          permission: nextPermission,
          subscription,
        }),
      });

      if (!response.ok) {
        throw new Error("ENABLE_FAILED");
      }

      await refreshSettings();
    } catch {
      setError(messages.notificationTimeValidation);
    } finally {
      setPending(false);
    }
  }

  async function handleDisable() {
    setPending(true);
    setError(null);
    setDisableNotice(null);

    try {
      const installationId =
        typeof window === "undefined"
          ? undefined
          : (window.localStorage.getItem("honey_installation_id_v1") ??
            undefined);

      const response = await fetch("/api/client/notifications/settings", {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          anonymousDeviceId: installationId,
        }),
      });

      if (!response.ok) {
        throw new Error("DISABLE_FAILED");
      }

      try {
        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready;
          const subscription =
            await registration.pushManager?.getSubscription();
          await subscription?.unsubscribe();
        }
      } catch {
        setDisableNotice(messages.notificationDisabledBody);
      }

      await refreshSettings();
    } catch {
      setError(messages.notificationDisabledBody);
    } finally {
      setPending(false);
    }
  }

  const permissionLabel =
    permission === "granted"
      ? messages.notificationStatusPermissionGranted
      : permission === "denied"
        ? messages.notificationStatusPermissionDenied
        : permission === "default"
          ? messages.notificationStatusPermissionDefault
          : messages.notificationBrowserUnsupported;

  return (
    <section className="card p-5">
      <h1 className="text-3xl font-semibold">
        {messages.notificationSettingsTitle}
      </h1>
      <p className="mt-3 text-base leading-7 muted">
        {messages.notificationSettingsBody}
      </p>

      <div className="mt-5 space-y-2 text-sm">
        <p>{permissionLabel}</p>
        <p>
          {settings.preference.enabled
            ? messages.notificationStatusPreferenceEnabled
            : messages.notificationStatusPreferenceDisabled}
        </p>
        <p>
          {settings.subscription.hasActiveSubscription
            ? messages.notificationStatusSubscriptionActive
            : messages.notificationStatusSubscriptionMissing}
        </p>
        {settings.simulatedEnvironment ? (
          <p>{messages.notificationStatusSimulated}</p>
        ) : null}
      </div>

      <label
        className="mt-5 block text-sm font-medium"
        htmlFor="preferredLocalTime"
      >
        {messages.notificationPreferredTime}
      </label>
      <select
        id="preferredLocalTime"
        className="mt-2 w-full rounded-2xl border border-line bg-card-2 px-4 py-3 text-base"
        value={preferredLocalTime}
        onChange={(event) => setPreferredLocalTime(event.target.value)}
      >
        {settings.allowedReminderTimes.map((time) => (
          <option key={time} value={time}>
            {time}
          </option>
        ))}
      </select>

      {permission === "denied" ? (
        <p className="mt-4 rounded-2xl border border-line bg-card-2 px-4 py-3 text-sm muted">
          {messages.notificationPermissionDenied}
        </p>
      ) : null}

      {!settings.preference.enabled ? (
        <p className="mt-4 rounded-2xl border border-line bg-card-2 px-4 py-3 text-sm muted">
          {messages.notificationDisabledBody}
        </p>
      ) : null}

      {error ? (
        <p
          className="mt-4 rounded-2xl border border-line bg-card-2 px-4 py-3 text-sm muted"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {disableNotice ? (
        <p className="mt-4 rounded-2xl border border-line bg-card-2 px-4 py-3 text-sm muted">
          {disableNotice}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-3">
        <button
          type="button"
          className="button-primary min-h-11"
          onClick={handleEnable}
          disabled={pending || permission === "unsupported"}
        >
          {messages.notificationEnable}
        </button>
        <button
          type="button"
          className="button-secondary min-h-11"
          onClick={handleDisable}
          disabled={pending}
        >
          {messages.notificationDisable}
        </button>
      </div>
    </section>
  );
}
