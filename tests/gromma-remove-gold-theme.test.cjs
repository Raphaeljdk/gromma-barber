const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

const files=[
 "app/globals.css",
 "app/gromma-reference-theme.css",
 "app/gromma-unified-shell.css",
 "app/agenda-people-filters.css",
 "app/agenda-multiunit-history.css",
 "app/management-audit.css",
];
const legacyGolden=["#d7a84d","#f1cf80","#d7ae5a","#d2ac57","#a97924","#8a611b","#d4b279","#e2c38b","#e3c48a"];

test("A identidade GROMMA não mostra mais os antigos detalhes dourados",()=>{
 for(const file of files){
   const content=read(file).toLowerCase();
   for(const color of legacyGolden)assert.equal(content.includes(color),false,`${file}: cor dourada antiga ${color}`);
 }
 const css=read("app/globals.css");
 assert.match(css,/--gold:\s*#5fc5c1/);
 assert.match(css,/--gold-2:\s*#99d8d6/);
 assert.match(css,/--erp-gold:#379693/);
 assert.match(css,/rgba\(42,138,140/);
 assert.match(read("app/gromma-reference-theme.css"),/color:#80cdcb/);
});

test("Agenda, filtros e auditoria usam uma paleta sóbria sem alterar os dados",()=>{
 const agenda=read("app/agenda-people-filters.css");
 const units=read("app/agenda-multiunit-history.css");
 const audit=read("app/management-audit.css");
 assert.match(agenda,/--agenda-highlight:#2da8a4/);
 assert.match(agenda,/rgba\(42,138,140/);
 assert.match(units,/border-color:#44b1ad/);
 assert.match(audit,/\.mgmt-heat\.low \{background:#244952/);
 assert.match(audit,/\.mgmt-heat\.medium \{background:#367f85/);
 assert.match(audit,/\.mgmt-heat\.high \{background:#82ced0/);
});

test("Alertas e identificação dos atendimentos continuam semanticamente distintos",()=>{
 const css=read("app/globals.css");
 const plan=read("lib/plan-colors.ts");
 assert.match(css,/--warning:\s*#f0b85d/);
 assert.match(css,/\.badge\.pending \{ color:#ffd190/);
 assert.match(css,/\.agenda-interactive :is\(\.agenda-appointment,\.agenda-week-item,\.agenda-month-item\)\.service/);
 assert.match(css,/border-left-color:\s*#dea43b/);
 assert.match(css,/\.agenda-interactive :is\(\.agenda-appointment,\.agenda-week-item,\.agenda-month-item\)\.no-show/);
 assert.match(plan,/planColor/);
});
