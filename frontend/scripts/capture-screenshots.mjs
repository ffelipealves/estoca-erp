/**
 * Captura as telas principais do Estoca para a documentação.
 *
 *   npm run screenshots                     # contra a produção
 *   BASE_URL=http://localhost:3000 npm run screenshots
 *
 * Roda contra uma sandbox recém-criada, então as imagens sempre mostram o
 * mesmo catálogo inicial. As imagens numeradas anteriores são apagadas antes de
 * gravar, para que uma renumeração não deixe arquivos órfãos na pasta.
 */
import { mkdir, readdir, rm } from "node:fs/promises";
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

async function clearPreviousShots() {
  for (const file of await readdir(OUT_DIR)) {
    if (/^\d{2}-.*\.png$/.test(file)) await rm(join(OUT_DIR, file));
  }
}

function modal(page) {
  return page.locator("dialog[open]");
}

async function closeModal(page) {
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.waitForTimeout(600);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await clearPreviousShots();
  // O Chromium formata `<input type="date">` pelo idioma da aplicação, não pelo
  // `locale` do contexto — sem isto os filtros de período saem em mm/dd/yyyy.
  const browser = await chromium.launch({
    args: ["--lang=pt-BR"],
    env: { ...process.env, LANG: "pt_BR.UTF-8", LANGUAGE: "pt_BR:pt" },
  });
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

  // Cadastro: modal preenchido, com a ajuda de um campo aberta.
  await page.getByRole("button", { name: "+ Novo produto" }).click();
  await page.waitForTimeout(800);
  await modal(page).getByPlaceholder("Ex.: Café em grãos").fill("Café em grãos 500g");
  await modal(page).getByPlaceholder("Ex.: CAFE-001").fill("CAFE-500");
  await modal(page).locator('input[type="number"]').first().fill("32.90");
  await page.locator('button[aria-label="O que é o aviso de estoque baixo"]').click();
  await shot(page, "produto-cadastro-modal");
  await closeModal(page);

  // Edição: o modal abre já com os dados do produto.
  await page.locator("ul.divide-y > li").first().getByRole("button", { name: "Editar" }).click();
  await page.waitForTimeout(800);
  await shot(page, "produto-edicao-modal");
  await closeModal(page);

  // Exclusão: a confirmação nomeia o produto e o foco começa em Cancelar.
  await page.locator("ul.divide-y > li").first().getByRole("button", { name: "Excluir" }).click();
  await page.waitForTimeout(800);
  await shot(page, "produto-exclusao-modal");
  await closeModal(page);

  await goToSection(page, "Categorias");
  await shot(page, "categorias-admin");

  await page.getByRole("button", { name: "+ Nova categoria" }).click();
  await page.waitForTimeout(800);
  await modal(page).getByPlaceholder("Ex.: Bebidas").fill("Bebidas");
  await shot(page, "categoria-modal");
  await closeModal(page);

  await goToSection(page, "Movimentações");
  await shot(page, "movimentacoes-admin");

  await page.getByRole("button", { name: "+ Nova movimentação" }).click();
  await page.waitForTimeout(800);
  await page.locator('button[aria-label="O que é o tipo de operação"]').click();
  await shot(page, "movimentacao-modal");
  await closeModal(page);

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

  // No celular o modal ocupa a largura da tela e a área rolável mantém o X à vista.
  await mobilePage.getByRole("button", { name: "Abrir menu" }).click();
  await mobilePage
    .locator("#mobile-navigation button", { hasText: "Produtos" })
    .first()
    .click();
  await mobilePage.waitForSelector("ul.divide-y li");
  await mobilePage
    .locator("ul.divide-y > li")
    .first()
    .getByRole("button", { name: "Editar" })
    .click();
  await mobilePage.waitForTimeout(800);
  await shot(mobilePage, "produto-edicao-modal-mobile");

  await browser.close();
  console.log(`\n${step} imagens em docs/screenshots/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
