/**
 * Captura as telas principais do Estoca para a documentação.
 *
 *   npm run screenshots                     # contra a produção
 *   BASE_URL=http://localhost:3000 npm run screenshots
 *
 * Roda contra uma sandbox recém-criada, então as imagens sempre mostram o
 * mesmo catálogo inicial. Reexecutar sobrescreve os arquivos.
 */
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://estoca-erp.vercel.app";
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "screenshots");
const VIEWPORT = { height: 900, width: 1440 };
const DEMO_PASSWORD = "demo123";

let step = 0;

const UNSTICK_STYLE = "estoca-unstick";

async function shot(page, name, { fullPage = false } = {}) {
  step += 1;
  const file = join(OUT_DIR, `${String(step).padStart(2, "0")}-${name}.png`);
  await page.waitForTimeout(600);

  // Numa captura de página inteira o cabeçalho fixo é redesenhado na posição de
  // rolagem e aparece no meio da imagem. Fixar como estático só durante o clique
  // do obturador resolve, sem alterar o que a aplicação faz de verdade.
  if (fullPage) {
    await page.addStyleTag({
      content: ".sticky { position: static !important; }",
      // @ts-expect-error -- id não é tipado, mas serve para remover depois
      id: UNSTICK_STYLE,
    });
    await page.waitForTimeout(300);
  }

  await page.screenshot({ fullPage, path: file });

  if (fullPage) {
    await page.evaluate((id) => {
      document.querySelectorAll(`style#${id}, style`).forEach((node) => {
        if (node.textContent?.includes("position: static !important")) node.remove();
      });
    }, UNSTICK_STYLE);
  }

  console.log(`  ✓ ${String(step).padStart(2, "0")}-${name}.png`);
}

async function login(page, email) {
  // O bootstrap pode esperar o cold start do Render.
  await page.waitForSelector("#email", { timeout: 180_000 });
  await page.fill("#email", email);
  await page.fill("#password", DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
  // "attached", não "visible": no celular a sidebar existe no DOM mas fica
  // oculta por CSS. E `main h1` não serve — a tela de login também tem um.
  await page.waitForSelector('nav[aria-label="Navegação principal"]', {
    state: "attached",
    timeout: 60_000,
  });
  await page.waitForSelector("header", { timeout: 60_000 });
  await page.waitForTimeout(1500);
}

function nav(page, label) {
  return page.locator('nav[aria-label="Navegação principal"] button', { hasText: label }).first();
}

async function goToSection(page, label) {
  await nav(page, label).click();
  await page.waitForTimeout(2000);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ locale: "pt-BR", viewport: VIEWPORT });
  const page = await context.newPage();

  console.log(`Capturando de ${BASE_URL}`);
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

  await page.waitForSelector("#email", { timeout: 180_000 });
  await shot(page, "login");

  // ---------- Administrador ----------
  await login(page, "admin@estoca.demo");
  await shot(page, "painel-admin", { fullPage: true });

  await goToSection(page, "Produtos");
  await shot(page, "produtos-admin");

  await page.getByRole("button", { name: "+ Novo produto" }).click();
  await page.waitForTimeout(800);
  await page.locator('button[aria-label="O que é o aviso de estoque baixo"]').click();
  await shot(page, "produto-formulario-ajuda");
  await page.getByRole("button", { name: "Fechar formulário" }).click();
  await page.waitForTimeout(600);

  await goToSection(page, "Categorias");
  await shot(page, "categorias-admin");

  await goToSection(page, "Movimentações");
  await shot(page, "movimentacoes-admin");

  await page.getByRole("button", { name: "+ Nova movimentação" }).click();
  await page.waitForTimeout(800);
  await page.locator('button[aria-label="O que é o tipo de operação"]').click();
  await shot(page, "movimentacao-formulario-ajuda");
  await page.getByRole("button", { name: "Fechar formulário" }).click();
  await page.waitForTimeout(600);

  await goToSection(page, "Administração");
  await shot(page, "administracao", { fullPage: true });

  // ---------- Operador ----------
  await page.locator('button[aria-label="Trocar usuário"]').click();
  await page.waitForTimeout(1200);
  await login(page, "operador@estoca.demo");

  await goToSection(page, "Produtos");
  await shot(page, "produtos-operador");

  // Clicar num controle bloqueado revela o motivo da restrição. `force` porque
  // o Playwright trata `aria-disabled` como desabilitado, mas o botão responde
  // ao clique de propósito — é assim que o operador descobre a restrição.
  await page
    .locator('button[aria-disabled="true"]', { hasText: "Editar" })
    .first()
    .click({ force: true });
  await shot(page, "operador-acao-restrita");

  await goToSection(page, "Movimentações");
  await shot(page, "movimentacoes-operador");

  // ---------- Celular ----------
  const mobile = await browser.newContext({
    locale: "pt-BR",
    viewport: { height: 850, width: 390 },
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await login(mobilePage, "admin@estoca.demo");
  await shot(mobilePage, "painel-mobile", { fullPage: true });

  await browser.close();
  console.log(`\n${step} imagens em docs/screenshots/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
