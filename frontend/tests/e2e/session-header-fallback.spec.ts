import { expect, test } from "@playwright/test";

const API_ORIGIN = "https://estoca-api.onrender.com";
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

  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Entrar na demonstração" }),
  ).toBeVisible({ timeout: 100_000 });

  const initialSessionId = await page.evaluate(
    (key) => window.sessionStorage.getItem(key),
    SESSION_STORAGE_KEY,
  );
  expect(initialSessionId).toMatch(/^[0-9a-f-]{36}$/i);

  await context.clearCookies();
  observedRequests.length = 0;
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Entrar na demonstração" }),
  ).toBeVisible({ timeout: 100_000 });

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
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
  await expect(page.getByRole("heading", { name: "Produtos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pulso do estoque" })).toBeVisible();

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
  await page.getByRole("button", { name: /Movimentações Entradas/ }).click();
  await page.getByRole("button", { name: "+ Nova movimentação" }).click();
  await page.getByRole("spinbutton", { name: "Quantidade recebida" }).fill("1");
  await page
    .getByRole("textbox", { name: "Observação opcional" })
    .fill("Validação automatizada WebKit sem cookie");

  await context.clearCookies();
  observedRequests.length = 0;
  await page.getByRole("button", { name: "Registrar movimentação" }).click();
  await expect(page.getByText(/Entrada registrada\. Saldo final:/)).toBeVisible();

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
