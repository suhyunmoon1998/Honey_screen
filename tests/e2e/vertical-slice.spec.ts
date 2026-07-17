import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const invitationPath = "/invite/honey-demo-invite";
const sessionCookieName = "honey_session";

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

test.beforeEach(async () => {
  execSync("pnpm db:reset", {
    cwd: process.cwd(),
    stdio: "ignore",
    env: process.env,
  });
});

function flushNotificationWorker() {
  execSync(
    "pnpm tsx -e 'import { processPendingOutbox } from \"./apps/worker/src/notifications\"; (async()=>{ await processPendingOutbox(); await processPendingOutbox(); })().catch((error)=>{ console.error(error); process.exit(1); })'",
    {
      cwd: process.cwd(),
      stdio: "ignore",
      env: process.env,
    },
  );
}

async function attachFailureArtifacts(page: Page, testInfo: TestInfo) {
  const consoleLogs: string[] = [];
  const networkLogs: string[] = [];

  page.on("console", (message) => {
    consoleLogs.push(`${message.type()}: ${message.text()}`);
  });

  page.on("response", async (response) => {
    const request = response.request();
    if (!request.url().includes("/api/")) {
      return;
    }

    const headers = await response.allHeaders();
    networkLogs.push(
      JSON.stringify({
        method: request.method(),
        url: response.url(),
        status: response.status(),
        hasSetCookie: "set-cookie" in headers,
        cacheControl: headers["cache-control"] ?? null,
      }),
    );
  });

  return async () => {
    if (testInfo.status === testInfo.expectedStatus) {
      return;
    }

    await testInfo.attach("console-log", {
      body: consoleLogs.join("\n") || "no console output captured",
      contentType: "text/plain",
    });

    await testInfo.attach("network-log", {
      body: networkLogs.join("\n") || "no api responses captured",
      contentType: "text/plain",
    });
  };
}

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
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function getCacheStorageSnapshot(page: Page) {
  return page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) {
      return { supported: false, cacheNames: [], entries: [] as string[] };
    }

    await navigator.serviceWorker.ready;
    await new Promise((resolve) => setTimeout(resolve, 250));

    const cacheNames = await caches.keys();
    const entries: string[] = [];

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();

      for (const request of requests) {
        entries.push(new URL(request.url).pathname);
      }
    }

    return { supported: true, cacheNames, entries };
  });
}

test("Spanish invitation to mission completion and staff notifications", async ({
  browser,
  page,
}, testInfo) => {
  const finalizeArtifacts = await attachFailureArtifacts(page, testInfo);
  const manualTraceEnabled = process.env.E2E_TRACE === "1";

  if (manualTraceEnabled) {
    await page.context().tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });
  }

  try {
    await page.goto(invitationPath);
    await expect(
      page.getByRole("heading", { name: /Explora tu mision con Honey/i }),
    ).toBeVisible();
    expect(page.url().startsWith("http://localhost:3000")).toBe(true);

    await page.getByLabel(/Telefono movil/i).fill("(555) 555-0101");
    await page.getByRole("checkbox", { name: /aviso de privacidad/i }).check();
    await page
      .getByRole("checkbox", { name: /mensajes transaccionales/i })
      .check();
    await page.getByRole("button", { name: /Enviar codigo/i }).click();

    await expect(page.getByText(/Codigo de desarrollo:/i)).toBeVisible();
    await page.getByLabel(/^Codigo$/i).fill("246810");

    const verifyResponsePromise = page.waitForResponse((response) => {
      return (
        response.url().includes("/api/client/invitations/verify-otp") &&
        response.request().method() === "POST"
      );
    });

    await page.getByRole("button", { name: /Verificar codigo/i }).click();

    const verifyResponse = await verifyResponsePromise;
    const verifyHeaders = await verifyResponse.allHeaders();

    expect(verifyResponse.status()).toBe(200);
    expect(verifyHeaders["cache-control"]).toBe("no-store");

    await expect(page).toHaveURL(/\/dashboard$/);

    await expect
      .poll(async () => {
        const cookies = await page.context().cookies();
        return cookies.some((cookie) => cookie.name === sessionCookieName);
      })
      .toBe(true);

    const sessionCookie = (await page.context().cookies()).find(
      (cookie) => cookie.name === sessionCookieName,
    );

    expect(sessionCookie?.domain).toBe("localhost");
    expect(sessionCookie?.path).toBe("/");
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.secure).toBe(false);
    expect(sessionCookie?.sameSite).toBe("Lax");

    await expect(
      page.getByRole("heading", { name: /Antes de empezar/i }),
    ).toBeVisible();
    await page.getByRole("link", { name: /Continuar al tablero/i }).click();

    await expect(
      page.getByRole("heading", {
        name: /Honey esta lista para investigar contigo/i,
      }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: /Mision rapida de 3 preguntas/i })
      .click();

    await expect(page.getByText(/Mision 1 de 3/i)).toBeVisible();
    const firstQuestionHeading = page.getByRole("heading").first();
    await expect(firstQuestionHeading).toBeVisible();
    await expect(page.getByText(/POSSIBLE_/i)).toHaveCount(0);

    const firstAnswerResponsePromise = page.waitForResponse((response) => {
      return (
        response.url().includes("/api/client/missions/") &&
        response.url().includes("/answer") &&
        response.request().method() === "POST"
      );
    });

    await page.getByRole("button", { name: /^Si$/i }).click();

    const firstAnswerResponse = await firstAnswerResponsePromise;
    expect(firstAnswerResponse.status()).toBe(200);

    await expect(page.getByText(/Mision 2 de 3/i)).toBeVisible();
    const secondQuestionHeading = page.getByRole("heading").first();
    await expect(secondQuestionHeading).toBeVisible();
    const secondQuestionText = await secondQuestionHeading.textContent();

    await page.reload();

    await expect(page.getByText(/Mision 2 de 3/i)).toBeVisible();
    await expect(page.getByRole("heading").first()).toHaveText(
      secondQuestionText ?? "",
    );

    await page.getByRole("button", { name: /^No$/i }).click();
    await expect(page.getByText(/Mision 3 de 3/i)).toBeVisible();
    await expect(page.getByRole("heading").first()).toBeVisible();

    await page.getByRole("button", { name: /^Si$/i }).click();

    await expect(page).toHaveURL(/\/reward$/);
    await expect(
      page.getByRole("heading", { name: /Mision completada/i }),
    ).toBeVisible();
    await expect(page.getByText(/Honey reward/i)).toBeVisible();
    await expect(
      page.getByText(/Honey gano una pista por tu participacion/i),
    ).toBeVisible();
    await expect(page.getByText(/POSSIBLE_|review/i)).toHaveCount(0);
    flushNotificationWorker();

    const staffPage = await browser.newPage();
    const finalizeStaffArtifacts = await attachFailureArtifacts(
      staffPage,
      testInfo,
    );

    try {
      await staffPage.goto("/staff/login");
      await staffPage.getByLabel(/Contrasena/i).fill("jacklaw123");
      await staffPage.getByRole("button", { name: /Entrar/i }).click();

      await expect(
        staffPage.getByRole("heading", { name: /Notificaciones del equipo/i }),
      ).toBeVisible();

      await expect
        .poll(
          async () => {
            await staffPage.reload();
            return await staffPage
              .getByText(/Nuevo registro de cliente/i)
              .count();
          },
          { timeout: 15_000 },
        )
        .toBeGreaterThan(0);
      await expect
        .poll(
          async () => {
            await staffPage.reload();
            return await staffPage.getByText(/Mision completada/i).count();
          },
          { timeout: 15_000 },
        )
        .toBeGreaterThan(0);

      await expect(
        staffPage.getByText(/Nuevo registro de cliente/i),
      ).toBeVisible();
      await expect(staffPage.getByText(/Mision completada/i)).toBeVisible();
    } finally {
      await finalizeStaffArtifacts();
      await staffPage.close();
    }
  } finally {
    if (manualTraceEnabled) {
      const traceDir = join(process.cwd(), "test-results", "manual-traces");
      mkdirSync(traceDir, { recursive: true });
      await page.context().tracing.stop({
        path: join(traceDir, "positive-flow-trace.zip"),
      });
    }

    await finalizeArtifacts();
  }
});

test("service worker caches only public immutable assets and excludes authenticated responses", async ({
  page,
}) => {
  await completeInvitationFlow(page);

  await page.goto("/dashboard");
  await page.goto("/mission/does-not-exist").catch(() => {});
  await page.goto("/dashboard");

  const snapshot = await getCacheStorageSnapshot(page);

  expect(snapshot.supported).toBe(true);
  expect(snapshot.cacheNames).toContain("honey-public-static-v1");
  expect(snapshot.entries).toContain("/offline.html");
  expect(snapshot.entries).toContain("/manifest.webmanifest");
  expect(snapshot.entries).toContain("/honey-source.png");
  expect(snapshot.entries).not.toContain("/dashboard");
  expect(snapshot.entries).not.toContain("/reward");
  expect(
    snapshot.entries.every((entry) => !entry.startsWith("/mission/")),
  ).toBe(true);
  expect(snapshot.entries.every((entry) => !entry.startsWith("/api/"))).toBe(
    true,
  );
  expect(snapshot.entries.every((entry) => !entry.startsWith("/staff/"))).toBe(
    true,
  );
  expect(snapshot.entries.every((entry) => !entry.startsWith("/invite/"))).toBe(
    true,
  );
});

test("unauthorized user receives no sensitive data", async ({
  page,
}, testInfo) => {
  const finalizeArtifacts = await attachFailureArtifacts(page, testInfo);

  try {
    await page.goto("/staff/notifications");
    await expect(page).toHaveURL(/\/staff\/login$/);
    await expect(page.getByText(/Notificaciones del equipo/i)).toHaveCount(0);
  } finally {
    await finalizeArtifacts();
  }
});

test("standard mission supports five-question completion in Spanish", async ({
  page,
}, testInfo) => {
  const finalizeArtifacts = await attachFailureArtifacts(page, testInfo);

  try {
    await completeInvitationFlow(page);
    await page
      .getByRole("link", { name: /Mision estandar de 5 preguntas/i })
      .click();

    for (let step = 1; step <= 5; step += 1) {
      await expect(
        page.getByText(new RegExp(`Mision ${step} de 5`, "i")),
      ).toBeVisible();
      await page.getByRole("button", { name: /^(Si|Yes)$/i }).click();
    }

    await expect(page).toHaveURL(/\/reward$/);
    await expect(
      page.getByRole("heading", { name: /Mision completada/i }),
    ).toBeVisible();
  } finally {
    await finalizeArtifacts();
  }
});

test("English invite flow shows English dashboard and mission copy", async ({
  page,
}, testInfo) => {
  const finalizeArtifacts = await attachFailureArtifacts(page, testInfo);

  try {
    await page.goto(`${invitationPath}?lang=en`);
    await expect(
      page.getByRole("heading", { name: /Start your mission with Honey/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Español/i })).toBeVisible();

    await completeInvitationFlow(page, { lang: "en" });

    await expect(
      page.getByRole("heading", {
        name: /Honey is ready to investigate with you/i,
      }),
    ).toBeVisible();

    await page.getByRole("link", { name: /Quick 3-question mission/i }).click();

    await expect(page.getByText(/Mission 1 of 3/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Yes$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^No$/i })).toBeVisible();
  } finally {
    await finalizeArtifacts();
  }
});

test("same-day daily cap redirects back to the dashboard with a clear message", async ({
  page,
}, testInfo) => {
  const finalizeArtifacts = await attachFailureArtifacts(page, testInfo);

  try {
    await completeInvitationFlow(page);
    await page
      .getByRole("link", { name: /Mision completa de hasta 10 preguntas/i })
      .click();

    for (let step = 1; step <= 10; step += 1) {
      await expect(
        page.getByText(new RegExp(`Mision ${step} de 10`, "i")),
      ).toBeVisible();
      await page.getByRole("button", { name: /^(Si|Yes)$/i }).click();
    }

    await expect(page).toHaveURL(/\/reward$/);
    await page.goto("/dashboard");
    await page
      .getByRole("link", { name: /Mision rapida de 3 preguntas/i })
      .click();

    await expect(page).toHaveURL(/\/dashboard\?status=daily-cap$/);
    await expect(
      page.getByText(/Ya completaste las preguntas disponibles por hoy\./i),
    ).toBeVisible();
  } finally {
    await finalizeArtifacts();
  }
});

test("two browser contexts starting together still stay within one mission and one daily cap", async ({
  browser,
  page,
}, testInfo) => {
  const finalizeArtifacts = await attachFailureArtifacts(page, testInfo);
  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  const finalizeSecondArtifacts = await attachFailureArtifacts(
    secondPage,
    testInfo,
  );

  try {
    await completeInvitationFlow(page);
    await secondContext.addCookies(await page.context().cookies());
    await secondPage.goto("/dashboard");

    await Promise.all([
      page
        .getByRole("link", { name: /Mision completa de hasta 10 preguntas/i })
        .click(),
      secondPage
        .getByRole("link", { name: /Mision completa de hasta 10 preguntas/i })
        .click(),
    ]);

    await expect(page).toHaveURL(/\/mission\//);
    await expect(secondPage).toHaveURL(/\/mission\//);
    expect(new URL(page.url()).pathname).toBe(
      new URL(secondPage.url()).pathname,
    );

    for (let step = 1; step <= 10; step += 1) {
      await expect(
        page.getByText(new RegExp(`Mision ${step} de 10`, "i")),
      ).toBeVisible();
      await page.getByRole("button", { name: /^(Si|Yes)$/i }).click();
    }

    await expect(page).toHaveURL(/\/reward$/);
    await secondPage.goto("/dashboard");
    await secondPage
      .getByRole("link", { name: /Mision rapida de 3 preguntas/i })
      .click();
    await expect(secondPage).toHaveURL(/\/dashboard\?status=daily-cap$/);
  } finally {
    await finalizeArtifacts();
    await finalizeSecondArtifacts();
    await secondPage.close();
    await secondContext.close();
  }
});

test("admin can view content, draft, and approve versions", async ({
  browser,
}, testInfo) => {
  const adminPage = await browser.newPage();
  const finalizeAdminArtifacts = await attachFailureArtifacts(
    adminPage,
    testInfo,
  );

  try {
    await adminPage.goto("/staff/login");
    await adminPage.getByLabel(/Contrasena/i).fill("jacklaw123");
    await adminPage.getByRole("button", { name: /Entrar/i }).click();

    await adminPage.goto("/staff/content");
    await expect(
      adminPage.getByRole("heading", { name: /Contenido de preguntas/i }),
    ).toBeVisible();

    await adminPage.goto("/staff/admin");
    await expect(
      adminPage.getByRole("heading", { name: /Administracion de contenido/i }),
    ).toBeVisible();

    const draftForm = adminPage
      .locator('form[action="/api/staff/questions/draft"]')
      .first();
    await draftForm
      .locator('textarea[name="promptEs"]')
      .fill("Contenido ficticio actualizado para la prueba de diff.");
    await draftForm
      .locator('textarea[name="promptEn"]')
      .fill("Updated fictional content for the diff test.");
    await draftForm.getByRole("button", { name: /Crear DRAFT/i }).click();

    await expect(adminPage.getByText(/DRAFT v/i).first()).toBeVisible();
    await expect(adminPage.getByText(/Spanish text/i).first()).toBeVisible();
    await expect(adminPage.getByText(/CHANGED/i).first()).toBeVisible();

    await adminPage
      .locator('form[action="/api/staff/questions/approve"]')
      .first()
      .getByRole("button", { name: /Aprobar/i })
      .click();

    await expect(
      adminPage.locator('form[action="/api/staff/questions/approve"]'),
    ).toHaveCount(0);
  } finally {
    await finalizeAdminArtifacts();
    await adminPage.close();
  }
});
