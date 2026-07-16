import { execFileSync, execSync } from "node:child_process";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const invitationPath = "/invite/honey-demo-invite";

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

test.beforeEach(async () => {
  execSync("pnpm db:reset", {
    cwd: process.cwd(),
    stdio: "ignore",
    env: process.env,
  });
});

async function completeInvitationFlow(
  page: Page,
  options: { lang?: "es" | "en"; phone?: string } = {},
) {
  const lang = options.lang ?? "es";
  const phone = options.phone ?? "(555) 555-0101";

  await page.goto(lang === "en" ? `${invitationPath}?lang=en` : invitationPath);
  await page.getByLabel(/Telefono movil|Mobile phone/i).fill(phone);
  await page
    .getByRole("checkbox", { name: /aviso de privacidad|privacy notice/i })
    .check();
  await page
    .getByRole("checkbox", {
      name: /mensajes transaccionales|transactional messages/i,
    })
    .check();
  await page.getByRole("button", { name: /Enviar codigo|Send code/i }).click();
  await page.getByLabel(/^Codigo$|^Code$/i).fill("246810");
  await page
    .getByRole("button", { name: /Verificar codigo|Verify code/i })
    .click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page
    .getByRole("link", { name: /Continuar al tablero|Continue to dashboard/i })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function installNotificationMock(
  context: BrowserContext,
  input: {
    unsupported?: boolean;
    initialPermission?: "default" | "granted" | "denied";
    requestResult?: "default" | "granted" | "denied";
  } = {},
) {
  await context.addInitScript(
    ({ unsupported, initialPermission, requestResult }) => {
      if (unsupported) {
        Object.defineProperty(window, "Notification", {
          configurable: true,
          value: undefined,
        });
        Object.defineProperty(navigator, "serviceWorker", {
          configurable: true,
          value: undefined,
        });
        return;
      }

      let currentPermission = initialPermission;
      let requestCount = 0;

      class MockNotification {}

      Object.defineProperty(MockNotification, "permission", {
        configurable: true,
        get() {
          return currentPermission;
        },
      });
      Object.defineProperty(MockNotification, "requestPermission", {
        configurable: true,
        value: async () => {
          requestCount += 1;
          currentPermission = requestResult;
          return currentPermission;
        },
      });

      Object.defineProperty(window, "Notification", {
        configurable: true,
        writable: true,
        value: MockNotification,
      });
      Object.defineProperty(window, "__honeyNotificationTest", {
        configurable: true,
        value: {
          getRequestCount: () => requestCount,
          getPermission: () => currentPermission,
        },
      });
    },
    {
      unsupported: input.unsupported ?? false,
      initialPermission: input.initialPermission ?? "default",
      requestResult: input.requestResult ?? "granted",
    },
  );
}

async function getNotificationRequestCount(page: Page) {
  return page.evaluate(
    () =>
      (
        window as typeof window & {
          __honeyNotificationTest?: { getRequestCount(): number };
        }
      ).__honeyNotificationTest?.getRequestCount() ?? 0,
  );
}

async function loadSafeNotificationSettings(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/client/notifications/settings", {
      credentials: "include",
      cache: "no-store",
    });

    return response.json();
  });
}

function readJsonFromRepo<T>(code: string): T {
  return JSON.parse(
    execFileSync("pnpm", ["tsx", "-e", code], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    }).toString(),
  ) as T;
}

function getHoneyPoints() {
  return readJsonFromRepo<{ totalPoints: number }>(`
    import { prisma } from "@honey/db";
    (async () => {
      const client = await prisma.client.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
      const profile = await prisma.honeyProfile.findUnique({ where: { clientId: client.id } });
      console.log(JSON.stringify({ totalPoints: profile?.totalPoints ?? 0 }));
    })();
  `).totalPoints;
}

function getReminderPreferenceSnapshot() {
  return readJsonFromRepo<{
    enabled: boolean;
    preferredLocalTime: string | null;
  }>(`
    import { prisma } from "@honey/db";
    (async () => {
      const client = await prisma.client.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
      const pref = await prisma.notificationPreference.findUnique({
        where: {
          clientId_purpose_channel: {
            clientId: client.id,
            purpose: "MISSION_REMINDER",
            channel: "WEB_PUSH",
          },
        },
      });
      console.log(JSON.stringify({
        enabled: pref?.enabled ?? false,
        preferredLocalTime: pref?.preferredLocalTime ?? null,
      }));
    })();
  `);
}

test("notification settings do not prompt on dashboard load and show separate states", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await installNotificationMock(context, {
    initialPermission: "default",
    requestResult: "granted",
  });
  const page = await context.newPage();

  try {
    await completeInvitationFlow(page);
    expect(await getNotificationRequestCount(page)).toBe(0);

    await page.getByRole("link", { name: /Recordatorios de Honey/i }).click();
    await expect(page).toHaveURL(/\/settings\/notifications$/);
    expect(await getNotificationRequestCount(page)).toBe(0);

    await expect(
      page.getByRole("heading", { name: /Recordatorios de Honey/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/Permiso del navegador pendiente/i),
    ).toBeVisible();
    await expect(page.getByText(/Recordatorios desactivados/i)).toBeVisible();
    await expect(page.getByText(/Sin suscripcion activa/i)).toBeVisible();
  } finally {
    await context.close();
  }
});

test("denied browser permission does not block the mission flow", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await installNotificationMock(context, {
    initialPermission: "default",
    requestResult: "denied",
  });
  const page = await context.newPage();

  try {
    await completeInvitationFlow(page);
    await page.getByRole("link", { name: /Recordatorios de Honey/i }).click();
    await page
      .getByRole("button", { name: /^Activar recordatorios$/i })
      .click();

    await expect(
      page.getByText(/Permiso del navegador bloqueado/i),
    ).toBeVisible();
    await expect(
      page.getByText(/Tu navegador bloqueo los recordatorios/i),
    ).toBeVisible();

    await page.goto("/dashboard");
    await page
      .getByRole("link", { name: /Mision rapida de 3 preguntas/i })
      .click();
    await expect(page).toHaveURL(/\/mission\//);
  } finally {
    await context.close();
  }
});

test("enabling and disabling reminders keeps Honey points unchanged and keeps browser-facing responses safe", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await installNotificationMock(context, {
    initialPermission: "default",
    requestResult: "granted",
  });
  const page = await context.newPage();

  try {
    await completeInvitationFlow(page);
    const pointsBeforeEnable = getHoneyPoints();

    await page.getByRole("link", { name: /Recordatorios de Honey/i }).click();
    await page.selectOption("#preferredLocalTime", "17:00");

    await page
      .getByRole("button", { name: /^Activar recordatorios$/i })
      .click();

    await expect(
      page.getByText(/Permiso del navegador concedido/i),
    ).toBeVisible();
    await expect(page.getByText(/Recordatorios activados/i)).toBeVisible();
    await expect(
      page.getByText(/Suscripcion activa en este momento/i),
    ).toBeVisible();
    const safeSettings = await loadSafeNotificationSettings(page);
    expect(safeSettings.preference.enabled).toBe(true);
    expect(safeSettings.preference.preferredLocalTime).toBe("17:00");
    expect(safeSettings.subscription).not.toHaveProperty("endpoint");
    expect(safeSettings.subscription).not.toHaveProperty("auth");
    expect(safeSettings.subscription).not.toHaveProperty("p256dh");
    expect(JSON.stringify(safeSettings)).not.toContain("push.example.test");
    expect(getHoneyPoints() - pointsBeforeEnable).toBe(0);
    expect(getReminderPreferenceSnapshot()).toEqual({
      enabled: true,
      preferredLocalTime: "17:00",
    });

    await page
      .getByRole("button", { name: /^Desactivar recordatorios$/i })
      .click();

    await expect(page.getByText(/Recordatorios desactivados/i)).toBeVisible();
    expect(getHoneyPoints() - pointsBeforeEnable).toBe(0);
    expect(getReminderPreferenceSnapshot().enabled).toBe(false);
  } finally {
    await context.close();
  }
});

test("server preference stays disabled when subscription persistence fails", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await installNotificationMock(context, {
    initialPermission: "default",
    requestResult: "granted",
  });
  await context.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.url;
      const method =
        init?.method ??
        (typeof input === "string" ? "GET" : (input.method ?? "GET"));

      if (
        url.includes("/api/client/notifications/settings") &&
        method.toUpperCase() === "PUT"
      ) {
        return new Response(JSON.stringify({ error: "forced failure" }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        });
      }

      return originalFetch(input, init);
    };
  });
  const page = await context.newPage();

  try {
    await completeInvitationFlow(page);
    await page.getByRole("link", { name: /Recordatorios de Honey/i }).click();

    await page
      .getByRole("button", { name: /^Activar recordatorios$/i })
      .click();
    await expect(page.getByText(/Recordatorios desactivados/i)).toBeVisible();
    await expect(page.getByText(/Sin suscripcion activa/i)).toBeVisible();
    expect(getReminderPreferenceSnapshot().enabled).toBe(false);
  } finally {
    await context.close();
  }
});

test("unsupported push APIs and English notification copy are rendered honestly", async ({
  browser,
}) => {
  const unsupportedContext = await browser.newContext();
  const unsupportedPage = await unsupportedContext.newPage();

  try {
    await completeInvitationFlow(unsupportedPage);
    await unsupportedPage.close();
    await unsupportedContext.addInitScript(() => {
      Reflect.deleteProperty(window, "PushManager");
    });
    const unsupportedSettingsPage = await unsupportedContext.newPage();
    await unsupportedSettingsPage.goto("/settings/notifications");
    await expect(
      unsupportedSettingsPage.getByText(
        /Este navegador no puede mostrar recordatorios push/i,
      ),
    ).toBeVisible();
  } finally {
    await unsupportedContext.close();
  }

  const englishContext = await browser.newContext();
  await installNotificationMock(englishContext, {
    initialPermission: "default",
    requestResult: "granted",
  });
  const englishPage = await englishContext.newPage();

  try {
    await completeInvitationFlow(englishPage, { lang: "en" });
    await englishPage.getByRole("link", { name: /Honey reminders/i }).click();
    await expect(
      englishPage.getByRole("heading", { name: /Honey reminders/i }),
    ).toBeVisible();
    await expect(
      englishPage.getByText(/Browser permission not requested yet/i),
    ).toBeVisible();
    await expect(
      englishPage.getByText(/What time would you prefer a reminder/i),
    ).toBeVisible();
  } finally {
    await englishContext.close();
  }
});
