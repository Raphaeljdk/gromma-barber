const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source=fs.readFileSync(path.resolve(__dirname,"../lib/product-commission-rules.ts"),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;
const loaded={exports:{}};
new Function("require","module","exports",js)(require,loaded,loaded.exports);
const {
  isProductCommissionCategory, categoryName, resolveProductCommissionRate,
}=loaded.exports;

test("somente Cosméticos e Bebidas entram nas categorias comissionáveis",()=>{
  assert.equal(isProductCommissionCategory("COSMETICS"),true);
  assert.equal(isProductCommissionCategory("DRINKS"),true);
  assert.equal(isProductCommissionCategory("SERVICES"),false);
  assert.equal(isProductCommissionCategory("OTHER"),false);
  assert.equal(categoryName("COSMETICS"),"Cosméticos");
  assert.equal(categoryName("DRINKS"),"Bebidas");
});
test("regra fixa ignora volume vendido e usa percentual da categoria",()=>{
  const rule={mode:"FIXED",fixedPercent:12,tiers:[]};
  assert.equal(resolveProductCommissionRate(rule,0,30),12);
  assert.equal(resolveProductCommissionRate(rule,10000,30),12);
});
test("regra escalonada depende do faturamento agregado da categoria",()=>{
  const rule={mode:"SCALED",fixedPercent:0,tiers:[
    {min:0,percent:5},{min:500,percent:8},{min:1000,percent:12},
  ]};
  assert.equal(resolveProductCommissionRate(rule,250,30),5);
  assert.equal(resolveProductCommissionRate(rule,500,30),8);
  assert.equal(resolveProductCommissionRate(rule,900,30),8);
  assert.equal(resolveProductCommissionRate(rule,1000,30),12);
  assert.equal(resolveProductCommissionRate(rule,8000,30),12);
});
test("sem regra por categoria, mantém percentual anterior para não zerar comissões",()=>{
  assert.equal(resolveProductCommissionRate(undefined,500,30),30);
  assert.equal(resolveProductCommissionRate(undefined,500,0),0);
});
