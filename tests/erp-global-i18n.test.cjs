const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root=path.resolve(__dirname,"..");
const read=path=>fs.readFileSync(require("node:path").join(root,path),"utf8");
const source=read("lib/erp-i18n.ts");
const compiled=ts.transpileModule(source,{
  fileName:"erp-i18n.ts",
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const moduleObject={exports:{}};
new Function("module","exports",compiled)(moduleObject,moduleObject.exports);
const {ERP_LOCALES,ERP_UI_TRANSLATIONS,normalizeErpLocale,translateErpText}=moduleObject.exports;

test("ERP mantém os seis idiomas e permite retornar ao português sem perder o original",()=>{
  assert.deepEqual(ERP_LOCALES.map(x=>x.id),["pt-BR","en","es","fr","de","it"]);
  assert.equal(normalizeErpLocale("fr"),"fr");
  assert.equal(normalizeErpLocale("anything"),"pt-BR");
  assert.equal(translateErpText("Agenda","en"),"Appointments");
  assert.equal(translateErpText("Agenda","pt-BR"),"Agenda");
  assert.equal(translateErpText("  Agenda ","en"),"  Appointments ");
  assert.equal(translateErpText("Cliente João","en"),"Cliente João");
});

test("Todos os rótulos de navegação cadastrados possuem traduções, exceto marcas",()=>{
  const nav=read("lib/erp-navigation.ts");
  const names=[...new Set([...nav.matchAll(/\b(?:label|description):\s*"([^"]+)"/g)].map(x=>x[1]))];
  const brands=new Set(["Gromma NF","Gromma I.A.","Performance"]);
  const missing=names.filter(name=>!brands.has(name)&&!Object.hasOwn(ERP_UI_TRANSLATIONS,name));
  assert.deepEqual(missing,[]);
  for(const [label,values] of Object.entries(ERP_UI_TRANSLATIONS)){
    assert.equal(values.length,5,label);
    assert.ok(values.every(value=>typeof value==="string"&&Boolean(value.trim())),label);
  }
});

test("Seletor traduz todo o ERP, inclusive opções e atributos acessíveis",()=>{
  const picker=read("components/erp-language-picker.tsx");
  assert.match(picker,/document\.querySelector\("\.tenant-erp"\)/);
  assert.match(picker,/NodeFilter\.SHOW_TEXT/);
  for(const prop of ["title","placeholder","aria-label","aria-placeholder","alt"])
    assert.ok(picker.includes('"'+prop+'"'),prop);
  assert.match(picker,/MutationObserver/);
  assert.match(picker,/translateErpText\(source,locale\)/);
  assert.match(picker,/originalTexts/);
  assert.match(picker,/originalAttributes/);
  assert.match(picker,/gromma-locale/);
  assert.doesNotMatch(picker,/scopeSelector/);
  assert.match(picker,/gromma-sidebar-business-copy/);
});

test("Agenda reformata datas e valores quando o idioma da interface muda",()=>{
  const picker=read("components/erp-language-picker.tsx");
  const board=read("components/erp-agenda-board.tsx");
  assert.match(picker,/gromma-locale-change/);
  assert.match(board,/addEventListener\("gromma-locale-change"/);
  assert.match(board,/new Intl\.DateTimeFormat\(locale/);
  assert.match(board,/value\.toLocaleString\(locale/);
  assert.match(board,/localizedDateLabel\(value,options,uiLocale\)/);
  assert.match(board,/localizedMoney\(value,uiLocale\)/);
});
