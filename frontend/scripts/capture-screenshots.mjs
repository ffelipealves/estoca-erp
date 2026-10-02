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

let step = 0;

async function shot(page, name, { fullPage = false } = {}) {
  step += 1;
  const file = join(OUT_DIR, `${String(step).padStart(2, "0")}-${name}.png`);
  // Tira o ponteiro de cima do gráfico e espera as animações de entrada.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(700);

  // Numa captura de página inteira, a barra de status, o rail e a barra de
  // ferramentas fixos são redesenhados na posição de rolagem e aparecem no meio
  // da imagem. Soltá-los só durante o clique do obturador resolve.
  const unstick = fullPage
    ? await page.addStyleTag({ content: ".sticky { position: static !important; }" })
    : null;
  if (unstick) await page.waitForTimeout(300);

  await page.screenshot({ fullPage, path: file });

  if (unstick) await unstick.evaluate((node) => node.remove());
  console.log(`  ✓ ${String(step).padStart(2, "0")}-${name}.png`);
}

/** Escolhe o perfil no cartão e entra com as credenciais de demonstração. */
async function login(page, role) {
  // O bootstrap pode esperar o cold start do Render.
  await page.waitForSelector("#email", { timeout: 180_000 });
  await page.getByText(role, { exact: true }).first().click();
  await page.getByRole("button", { name: `Entrar como ${role}` }).click();
  await page.getByRole("region", { name: "Totais da sandbox" }).waitFor({ timeout: 60_000 });
  await page.locator(".recharts-line").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1200);
}

/** Navega pelo rail, sem recarregar: a sandbox e o login seguem na aba. */
async function goTo(page, label) {
  await page.getByRole("navigation", { name: "Áreas" }).getByRole("link", { name: label }).click();
  await page.locator("main h1", { hasText: label }).waitFor();
  await page.waitForTimeout(1500);
}

function modal(page) {
  return page.locator('[data-slot="dialog-content"]');
}

async function openModal(page, button) {
  await button.click();
  await modal(page).waitFor();
  await page.waitForTimeout(500);
}

async function closeModal(page) {
  await modal(page).getByRole("button", { name: "Fechar", exact: true }).click();
  await modal(page).waitFor({ state: "detached" });
}

async function pick(page, trigger, option) {
  await trigger.click();
  await page.getByRole("option", { name: option }).click();
  await page.locator('[data-slot="select-content"]').waitFor({ state: "detached" });
}

async function clearPreviousShots() {
  for (const file of await readdir(OUT_DIR)) {
    if (/^\d{2}-.*\.png$/.test(file)) await rm(join(OUT_DIR, file));
  }
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
  await login(page, "Administrador");
  await shot(page, "painel-admin", { fullPage: true });

  await goTo(page, "Produtos");
  await shot(page, "produtos-admin");

  // Cadastro: modal preenchido, com a quantidade inicial que vira entrada.
  await openModal(page, page.getByRole("button", { name: "Novo produto" }));
  await modal(page).getByLabel("Nome").fill('Serrote 22" dente travado');
  await modal(page).getByLabel("SKU").fill("FER-1410");
  await pick(page, modal(page).getByRole("combobox", { name: "Categoria" }), "Ferramentas manuais");
  await modal(page).getByLabel("Preço unitário").fill("79,90");
  await modal(page).getByLabel("Limite de estoque baixo").fill("3");
  await modal(page).getByLabel("Quantidade inicial").fill("12");
  await shot(page, "produto-cadastro-modal");
  await closeModal(page);

  // Edição: dados cadastrais; o saldo só muda por movimentação.
  const firstRow = page.locator("table tbody tr").first();
  await openModal(page, firstRow.getByRole("button", { name: /^Editar / }));
  await shot(page, "produto-edicao-modal");
  await closeModal(page);

  // Exclusão: diz quanto histórico vai junto e exige confirmação.
  await openModal(page, firstRow.getByRole("button", { name: /^Excluir / }));
  await modal(page).getByText("O histórico vai junto.").waitFor();
  await page.waitForTimeout(600);
  await shot(page, "produto-exclusao-modal");
  await closeModal(page);

  await goTo(page, "Categorias");
  await shot(page, "categorias-admin");

  await openModal(page, page.getByRole("button", { name: "Nova categoria" }));
  await modal(page).getByLabel("Nome").fill("Pintura");
  await modal(page).getByLabel("Descrição").fill("Tintas, rolos, pincéis e fitas de mascaramento.");
  await shot(page, "categoria-modal");
  await closeModal(page);

  await goTo(page, "Movimentações");
  await shot(page, "movimentacoes-admin");

  // Ajuste: o visor mostra o saldo no sistema, o contado e a diferença.
  await openModal(page, page.getByRole("button", { name: /^Registrar movimentação/ }));
  await pick(page, modal(page).getByRole("combobox", { name: "Produto" }), /Disjuntor bipolar/);
  await modal(page).getByRole("radio", { name: "Ajuste" }).check({ force: true });
  await modal(page).locator("#mov-qty").fill("7");
  await shot(page, "movimentacao-modal");
  await closeModal(page);

  await goTo(page, "Administração");
  await shot(page, "administracao", { fullPage: true });

  // ---------- Operador ----------
  await page.getByRole("button", { name: /^Perfil:/ }).click();
  await page.getByRole("menuitem", { name: "Trocar para Operador" }).click();
  await page.getByText("Agora você está como Operador").waitFor();
  await page.waitForTimeout(4500); // o aviso some antes da captura

  await goTo(page, "Produtos");
  await shot(page, "produtos-operador");

  // Clicar numa ação travada explica o motivo. `force` porque o Playwright trata
  // `aria-disabled` como desabilitado, mas o botão responde ao clique de
  // propósito — é assim que o operador descobre a restrição.
  await page
    .getByRole("button", { name: /^Editar .*: exclusivo do Administrador$/ })
    .first()
    .click({ force: true });
  await modal(page).waitFor();
  await page.waitForTimeout(500);
  await shot(page, "operador-acao-restrita");
  await modal(page).getByRole("button", { name: "Entendi" }).click();
  await modal(page).waitFor({ state: "detached" });

  await goTo(page, "Movimentações");
  await shot(page, "movimentacoes-operador");

  // ---------- Celular ----------
  const mobile = await browser.newContext({
    locale: "pt-BR",
    viewport: { height: 850, width: 390 },
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await login(mobilePage, "Administrador");
  await shot(mobilePage, "painel-mobile", { fullPage: true });

  // No celular o modal vira uma folha inferior: cabeçalho e ações ficam à vista
  // e só o corpo rola.
  await mobilePage.getByRole("button", { name: "Abrir menu" }).click();
  await mobilePage.getByRole("dialog").getByRole("link", { name: "Produtos" }).click();
  await mobilePage.locator("main ul.divide-y > li").first().waitFor();
  await mobilePage.waitForTimeout(800);
  await openModal(
    mobilePage,
    mobilePage.locator("main ul.divide-y > li").first().getByRole("button", { name: /^Editar / }),
  );
  await shot(mobilePage, "produto-edicao-modal-mobile");

  await browser.close();
  console.log(`\n${step} imagens em docs/screenshots/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
