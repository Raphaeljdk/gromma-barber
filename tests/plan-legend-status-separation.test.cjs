const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
const moduleObject={exports:{}};
new Function("module","exports",ts.transpileModule(read("lib/plan-colors.ts"),{
 fileName:"lib/plan-colors.ts",compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText)(moduleObject,moduleObject.exports);
const {planColor}=moduleObject.exports;

test("Seis planos diferentes recebem seis cores sem conflitar com clientes sem plano",()=>{
 const names=["Premium","Start","Basic","Master","Vip","Essencial"];
 const colors=names.map(name=>planColor(name,names));
 assert.equal(new Set(colors).size,6);
 assert.ok(!colors.includes(planColor(null,names)));
 assert.equal(planColor("Premium",names),"#945de8");
 assert.equal(planColor("Start",names),"#329cfa");
 assert.equal(planColor("Basic",names),"#21b580");
 assert.equal(planColor("Master",names),planColor("Master",names.slice().reverse()));
});
test("Dashboard tem somente legenda horizontal sem contagens ou consulta por plano",()=>{
 const page=read("app/erp/[tenant]/page.tsx");
 const css=read("app/globals.css");
 assert.match(page,/<div className="gromma-dashboard-plan-legend" aria-label="Legenda de cores dos planos">/);
 assert.match(page,/<strong>Legenda dos planos<\/strong>/);
 assert.doesNotMatch(page,/dashboardPlanCount|dashboardPlanAppointments|Agendamentos por plano · Hoje/);
 assert.match(page,/planColor\(name,dashboardPlanNames\)/);
 assert.match(css,/\.gromma-dashboard-plan-legend \{/);
 assert.match(css,/\.gromma-dashboard-plan-legend \.gromma-plan-legend-item/);
});
test("Agenda diferencia faixa da cor do plano da etiqueta textual do status nas três visualizações",()=>{
 const board=read("components/erp-agenda-board.tsx");
 const css=read("app/globals.css");
 assert.match(board,/borderLeft:\x604px solid \$\{planColor\(item\.planName,planNames\)\}\x60/);
 assert.match(board,/className="agenda-card-status"/);
 assert.match(board,/gromma-appointment-status/);
 assert.match(board,/STATUS_LABELS\[item\.status\]/);
 assert.match(board,/Status do atendimento: /);
 assert.match(board,/agenda-detail-status/);
 assert.match(css,/--gromma-status-color/);
 assert.match(css,/\.agenda-week-item > \.gromma-appointment-status/);
 assert.match(css,/\.agenda-month-item > \.gromma-appointment-status/);
 assert.match(css,/\.agenda-appointment\.compact \.agenda-card-status/);
});
test("Comanda mostra mesma cor do plano e o status permanece um campo próprio",()=>{
 const page=read("app/erp/[tenant]/page.tsx");
 const component=read("components/command-checkout.tsx");
 assert.match(page,/operationalBadge\(command\.status\)/);
 assert.match(page,/planNames=\{dashboardPlanNames\}/);
 assert.match(component,/checkout-status is-paid/);
 assert.match(component,/planColor\(command\.plan,planNames\)/);
});
