import { expect, test } from "@playwright/test";

test("o boot segue quando um bloqueador de anúncios barra o /healthz", async ({ page }) => {
  // A lista EasyPrivacy, ligada por padrão no uBlock Origin, tem a regra
  // `||onrender.com/health`: o navegador de quem usa bloqueador nunca alcança
  // o /healthz da API. O aquecimento é opcional, e o bootstrap acorda o servidor.
  await page.route("**/healthz", (route) => route.abort("blockedbyclient"));

  await page.goto("/");

  await expect(page.getByRole("button", { name: "Entrar como Administrador" })).toBeVisible({
    timeout: 100_000,
  });
  await expect(page.getByText("O servidor não respondeu")).toHaveCount(0);
});
