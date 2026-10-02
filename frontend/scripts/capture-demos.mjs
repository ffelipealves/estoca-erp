/**
 * Grava GIFs curtos das funcionalidades que um print estático não mostra.
 *
 *   npm run demos
 *   BASE_URL=http://localhost:3000 npm run demos
 *   npm run demos -- produto-cadastro-em-modal   # só os GIFs indicados
 *
 * O Playwright grava a interação em vídeo e o ffmpeg converte para GIF, que é o
 * único formato que o GitHub anima inline a partir de um arquivo do próprio
 * repositório — um .mp4 commitado e referenciado com sintaxe de imagem não toca.
 */
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { chromium } from "@playwright/test";

const run = promisify(execFile);

const BASE_URL = process.env.BASE_URL ?? "https://estoca-erp.vercel.app";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = join(ROOT, "docs", "demos");
const VIEWPORT = { height: 750, width: 1200 };

const GIF_WIDTH = 900;
const GIF_FPS = 12;

async function toGif(webmPath, name, startAt) {
  const gifPath = join(OUT_DIR, `${name}.gif`);
  const filters = [
    `fps=${GIF_FPS}`,
    `scale=${GIF_WIDTH}:-1:flags=lanczos`,
    // A interface é de cores chapadas: sem pontilhado, e só o retângulo que muda
    // entre quadros é recodificado. O GIF fica menor sem perder nitidez.
    "split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle",
  ].join(",");

  await run("ffmpeg", [
    "-y",
    "-loglevel", "error",
    "-i", webmPath,
    // `-ss` DEPOIS de `-i`: antes seria busca por keyframe, imprecisa no webm de
    // taxa variável que o Playwright grava, e a abertura da sessão sobrava.
    "-ss", String(Math.max(startAt, 0)),
    "-vf", filters,
    "-loop", "0",
    gifPath,
  ]);
  return gifPath;
}

/** Escolhe o perfil no cartão e entra com as credenciais de demonstração. */
async function login(page, role) {
  await page.waitForSelector("#email", { timeout: 180_000 });
  await page.getByText(role, { exact: true }).first().click();
  await page.getByRole("button", { name: `Entrar como ${role}` }).click();
  await page.getByRole("region", { name: "Totais da sandbox" }).waitFor({ timeout: 60_000 });
}

/** Navega pelo rail, sem recarregar: a sandbox e o login seguem na aba. */
async function goTo(page, label) {
  await page.getByRole("navigation", { name: "Áreas" }).getByRole("link", { name: label }).click();
  await page.locator("main h1", { hasText: label }).waitFor();
  await page.waitForTimeout(1200);
}

function modal(page) {
  return page.locator('[data-slot="dialog-content"]');
}

async function pick(page, trigger, option) {
  await trigger.click();
  await page.waitForTimeout(500);
  await page.getByRole("option", { name: option }).click();
  await page.locator('[data-slot="select-content"]').waitFor({ state: "detached" });
}

/** Espera o aviso de sucesso: o Render pode responder devagar depois de hibernar. */
async function toast(page, text) {
  await page.locator("[data-sonner-toast]", { hasText: text }).first().waitFor({ timeout: 90_000 });
}

/**
 * Roda um roteiro num contexto próprio e devolve o GIF.
 *
 * `readyAt` marca quanto tempo passou até a aplicação aparecer, para o ffmpeg
 * descartar exatamente esse trecho — o cold start do Render varia demais para
 * um corte fixo.
 */
async function record(browser, { role, name, script }) {
  const videoDir = await mkdtemp(join(tmpdir(), "estoca-demo-"));
  const context = await browser.newContext({
    locale: "pt-BR",
    recordVideo: { dir: videoDir, size: VIEWPORT },
    viewport: VIEWPORT,
  });
  const page = await context.newPage();
  const startedAt = Date.now();

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await login(page, role);
  await page.waitForTimeout(400);

  // O roteiro decide onde a demonstração começa: o login e a navegação até a
  // tela certa não interessam, e o cold start do Render varia demais para um
  // corte fixo.
  let readyAt = (Date.now() - startedAt) / 1000;
  const markStart = () => {
    readyAt = (Date.now() - startedAt) / 1000;
  };

  await script(page, markStart);
  await page.waitForTimeout(900);

  const video = page.video();
  await context.close();
  const webmPath = await video.path();

  const gifPath = await toGif(webmPath, name, readyAt);
  await rm(videoDir, { force: true, recursive: true });
  console.log(`  ✓ ${name}.gif`);
  return gifPath;
}

const DEMOS = [
  {
    role: "Administrador",
    name: "catalogo-ordenacao-e-filtros",
    async script(page, markStart) {
      await goTo(page, "Produtos");
      markStart();
      await page.waitForTimeout(1000);
      const header = (label) => page.locator("table thead").getByRole("button", { name: label });

      await header("Preço unit.").click();
      await page.waitForTimeout(1100);
      await header("Preço unit.").click();
      await page.waitForTimeout(1100);
      await header("Saldo").click();
      await page.waitForTimeout(1300);

      await pick(page, page.getByRole("combobox").first(), "Elétrica");
      await page.waitForTimeout(1400);
      await page.getByRole("button", { name: /Só estoque baixo/ }).click();
      await page.waitForTimeout(1600);
      await page.getByRole("button", { name: "Limpar filtros" }).click();
      await page.waitForTimeout(1000);

      // O campo de leitura filtra o catálogo enquanto se digita.
      await page.keyboard.press("/");
      await page.keyboard.type("fita", { delay: 120 });
      await page.waitForTimeout(1600);
    },
  },
  {
    role: "Administrador",
    name: "registrar-ajuste-de-estoque",
    async script(page, markStart) {
      await goTo(page, "Movimentações");
      markStart();
      await page.waitForTimeout(600);
      // A tecla M abre o registro de qualquer área.
      await page.keyboard.press("m");
      await modal(page).waitFor();
      await page.waitForTimeout(700);

      await pick(page, modal(page).getByRole("combobox", { name: "Produto" }), /Disjuntor bipolar/);
      await page.waitForTimeout(600);
      // O ajuste é a regra menos óbvia: o número digitado vira o saldo. E, S e A
      // trocam a operação pelo teclado.
      await modal(page).locator("input[name=mov-type]:checked").focus();
      await page.keyboard.press("a");
      await page.waitForTimeout(1000);
      await modal(page).locator("#mov-qty").pressSequentially("1", { delay: 200 });
      await page.waitForTimeout(1400);
      await modal(page).locator("#mov-qty").pressSequentially("0", { delay: 200 });
      await page.waitForTimeout(1600);

      await modal(page).getByRole("button", { name: "Confirmar ajuste" }).click();
      await toast(page, "Ajuste registrado");
      await page.waitForTimeout(1600);
    },
  },
  {
    role: "Administrador",
    name: "produto-cadastro-em-modal",
    async script(page, markStart) {
      await goTo(page, "Produtos");
      markStart();
      await page.waitForTimeout(800);
      await page.getByRole("button", { name: "Novo produto" }).click();
      await modal(page).waitFor();
      await page.waitForTimeout(800);

      const dialog = modal(page);
      await dialog.getByLabel("Nome").pressSequentially('Serrote 22" dente travado', { delay: 45 });
      await dialog.getByLabel("SKU").pressSequentially("FER-1410", { delay: 55 });
      await pick(page, dialog.getByRole("combobox", { name: "Categoria" }), "Ferramentas manuais");
      await dialog.getByLabel("Preço unitário").pressSequentially("79,90", { delay: 70 });
      await dialog.getByLabel("Limite de estoque baixo").pressSequentially("3", { delay: 70 });
      await dialog.getByLabel("Quantidade inicial").fill("");
      await dialog.getByLabel("Quantidade inicial").pressSequentially("12", { delay: 70 });
      await page.waitForTimeout(1000);

      await dialog.getByRole("button", { name: "Cadastrar produto" }).click();
      await toast(page, "Produto cadastrado");
      await page.waitForTimeout(1800);
    },
  },
  {
    role: "Administrador",
    name: "produto-edicao-e-rascunho",
    async script(page, markStart) {
      await goTo(page, "Produtos");
      markStart();
      await page.waitForTimeout(800);
      const editFirst = async () => {
        await page.locator("table tbody tr").first().getByRole("button", { name: /^Editar / }).click();
        await modal(page).waitFor();
      };
      const dialog = modal(page);

      await editFirst();
      await page.waitForTimeout(900);

      // Clicar fora fecha o modal e descarta o que não foi salvo.
      await dialog.getByLabel("Nome").fill("");
      await dialog.getByLabel("Nome").pressSequentially("Rascunho que não será salvo", { delay: 45 });
      await page.waitForTimeout(900);
      await page.mouse.click(8, 8);
      await modal(page).waitFor({ state: "detached" });
      await page.waitForTimeout(1000);

      await editFirst();
      await page.waitForTimeout(1400);

      await dialog.getByLabel("Preço unitário").fill("");
      await dialog.getByLabel("Preço unitário").pressSequentially("45,50", { delay: 90 });
      await page.waitForTimeout(900);
      await dialog.getByRole("button", { name: "Salvar alterações" }).click();
      await toast(page, "Produto atualizado");
      await page.waitForTimeout(1800);
    },
  },
  {
    role: "Administrador",
    name: "produto-exclusao-com-confirmacao",
    async script(page, markStart) {
      await goTo(page, "Produtos");
      markStart();
      await page.waitForTimeout(800);
      const deleteFirst = async () => {
        await page.locator("table tbody tr").first().getByRole("button", { name: /^Excluir / }).click();
        await modal(page).getByText("O histórico vai junto.").waitFor();
      };

      await deleteFirst();
      await page.waitForTimeout(1800);
      await modal(page).getByRole("button", { name: "Cancelar" }).click();
      await modal(page).waitFor({ state: "detached" });
      await page.waitForTimeout(1000);

      await deleteFirst();
      await page.waitForTimeout(1200);
      // Excluir leva o histórico junto: o botão só libera depois da confirmação.
      await modal(page).getByRole("checkbox").check();
      await page.waitForTimeout(900);
      await modal(page).getByRole("button", { name: "Excluir produto e histórico" }).click();
      await toast(page, "Produto excluído");
      await page.waitForTimeout(1800);
    },
  },
  {
    role: "Operador",
    name: "operador-sem-permissao",
    async script(page, markStart) {
      await goTo(page, "Produtos");
      await page.waitForTimeout(900);
      markStart();
      // `force`: o Playwright trata `aria-disabled` como desabilitado, mas o
      // botão responde ao clique de propósito para explicar a restrição.
      await page
        .getByRole("button", { name: /^Editar .*: exclusivo do Administrador$/ })
        .first()
        .click({ force: true });
      await modal(page).waitFor();
      await page.waitForTimeout(2600);
      await modal(page).getByRole("button", { name: "Entendi" }).click();
      await modal(page).waitFor({ state: "detached" });
      await page.waitForTimeout(900);

      await page
        .getByRole("navigation", { name: "Áreas" })
        .getByRole("button", { name: /Administração/ })
        .click({ force: true });
      await modal(page).waitFor();
      await page.waitForTimeout(2200);
      // A troca de perfil mantém a sandbox: os dados continuam os mesmos.
      await modal(page).getByRole("button", { name: "Trocar para Administrador" }).click();
      await toast(page, "Agora você está como Administrador");
      await page.waitForTimeout(1800);
    },
  },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  // O Chromium formata `<input type="date">` pelo idioma da aplicação, não pelo
  // `locale` do contexto — daí o argumento e a variável de ambiente.
  const browser = await chromium.launch({
    args: ["--lang=pt-BR"],
    env: { ...process.env, LANG: "pt_BR.UTF-8", LANGUAGE: "pt_BR:pt" },
  });
  console.log(`Gravando de ${BASE_URL}`);

  const only = process.argv.slice(2);
  const selected = only.length ? DEMOS.filter((demo) => only.includes(demo.name)) : DEMOS;
  if (only.length && selected.length !== only.length) {
    const known = DEMOS.map((demo) => demo.name).join(", ");
    throw new Error(`GIF desconhecido em: ${only.join(", ")}. Disponíveis: ${known}`);
  }

  for (const demo of selected) {
    await record(browser, demo);
  }

  await browser.close();
  console.log(`\n${selected.length} GIFs em docs/demos/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
