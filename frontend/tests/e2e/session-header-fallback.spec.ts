import { expect, test } from "@playwright/test";

const API_ORIGIN = process.env.PLAYWRIGHT_API_URL ?? "https://estoca-api.onrender.com";
const SESSION_STORAGE_KEY = "estoca.session_id";

interface ObservedRequest {
  cookie: string | undefined;
  method: string;
  path: string;
  sessionId: string | undefined;
}

test("keeps the sandbox usable through X-Session-Id without cookies", async ({
  context,
  page,
  request,
}) => {
  const observedRequests: ObservedRequest[] = [];

  await expect
    .poll(
      async () => {
        try {
          return (await request.get(`${API_ORIGIN}/healthz`, { timeout: 30_000 })).ok();
        } catch {
          return false;
        }
      },
      { intervals: [2_000, 5_000, 10_000], timeout: 120_000 },
    )
    .toBe(true);

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== API_ORIGIN) return;

    const headers = request.headers();
    observedRequests.push({
      cookie: headers.cookie,
      method: request.method(),
      path: url.pathname,
      sessionId: headers["x-session-id"],
    });
  });

  const loginButton = page.getByRole("button", { name: "Entrar como Administrador" });

  await page.goto("/");
  await expect(loginButton).toBeVisible({ timeout: 100_000 });

  const initialSessionId = await page.evaluate(
    (key) => window.sessionStorage.getItem(key),
    SESSION_STORAGE_KEY,
  );
  expect(initialSessionId).toMatch(/^[0-9a-f-]{36}$/i);

  await context.clearCookies();
  observedRequests.length = 0;
  await page.reload();
  await expect(loginButton).toBeVisible({ timeout: 100_000 });

  const headerBootstrap = observedRequests.find(
    ({ method, path }) =>
      method === "POST" && path === "/api/v1/sessions/bootstrap",
  );
  expect(headerBootstrap).toEqual(
    expect.objectContaining({
      cookie: undefined,
      sessionId: initialSessionId,
    }),
  );
  await expect
    .poll(() =>
      page.evaluate((key) => window.sessionStorage.getItem(key), SESSION_STORAGE_KEY),
    )
    .toBe(initialSessionId);

  await context.clearCookies();
  observedRequests.length = 0;
  await loginButton.click();
  await expect(page.getByRole("heading", { name: "Painel", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Totais da sandbox" })).toBeVisible();

  const headerLogin = observedRequests.find(
    ({ method, path }) => method === "POST" && path === "/api/v1/auth/login",
  );
  expect(headerLogin).toEqual(
    expect.objectContaining({
      cookie: undefined,
      sessionId: initialSessionId,
    }),
  );

  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Movimentações" }).click();
  await expect(page.getByRole("heading", { name: "Movimentações", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Movimentar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Produto" }).click();
  await page.getByRole("option", { name: /Arruela lisa/ }).click();
  await page.locator('[data-slot="select-content"]').waitFor({ state: "detached" });
  await dialog.locator("#mov-qty").fill("1");
  await dialog.getByLabel("Observação").fill("Validação automatizada WebKit sem cookie");

  await context.clearCookies();
  observedRequests.length = 0;
  await dialog.getByRole("button", { name: "Confirmar entrada" }).click();
  await expect(page.getByText("Entrada registrada")).toBeVisible();

  const headerMovement = observedRequests.find(
    ({ method, path }) =>
      method === "POST" && path === "/api/v1/stock-movements",
  );
  expect(headerMovement).toEqual(
    expect.objectContaining({
      cookie: undefined,
      sessionId: initialSessionId,
    }),
  );
});
