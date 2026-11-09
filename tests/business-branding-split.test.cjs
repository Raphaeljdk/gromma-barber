const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("dados, identidade e clube abrem em rotas distintas", () => {
  const modules = read("app/erp/[tenant]/[module]/page.tsx");
  for (const route of ["dados", "identidade", "clube-config", "unidades"])
    assert.match(modules, new RegExp('"' + route + '"'));
  const nav = read("lib/erp-navigation.ts");
  // As rotas continuam acessíveis pelo buscador, sem recriar subabas em Empresa.
  const palette = read("components/erp-command-palette.tsx");
  assert.match(nav, /route: "dados"/);
  assert.match(palette, /id: "identidade"/);
  assert.match(palette, /id: "clube-config"/);
});

test("formulários da identidade e clube usam salvamentos independentes", () => {
  const ui = read("components/branding-settings-section.tsx");
  assert.match(ui, /action=\{saveBrandVisual\}/);
  assert.match(ui, /action=\{saveClubPresentation\}/);
  assert.match(ui, /name="logoFile"/);
  assert.match(ui, /name="logoConsent"/);
  const actions = read("app/erp/[tenant]/branding-actions.ts");
  assert.match(actions, /authorizeBrandEditor/);
  assert.match(actions, /BRAND_VISUAL_UPDATED/);
  assert.match(actions, /CLUB_PRESENTATION_UPDATED/);
  assert.match(actions, /isolationLevel: "Serializable"/);
  assert.match(actions, /viewer\.role === "OWNER"/);
});

test("carrossel publicado usa somente imagens normalizadas e limita a três", () => {
  assert.match(read("components/public-business-carousel.tsx"), /images\.slice\(0, 3\)/);
  assert.match(read("app/barbearia/[tenant]/page.tsx"), /PublicBusinessCarousel/);
  assert.match(read("lib/erp-workspace.ts"), /\.slice\(0,3\)/);
});

test("nova navegação não substitui o módulo de assinatura operacional", () => {
  const nav = read("lib/erp-navigation.ts");
  assert.match(nav, /route: "assinaturas"/);
  assert.match(read("app/erp/[tenant]/page.tsx"), /moduleId === mode/);
});
