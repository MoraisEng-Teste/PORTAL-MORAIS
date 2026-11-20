/* Onda 3 (ux) — Andamento da casa de rua em blocos recolhíveis por etapa (vendas.html: pnEtapasHtml). Só nomes de coluna, nenhum dado. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fonte = fs.readFileSync(path.join(RAIZ, "vendas.html"), "utf8");
const ini = fonte.indexOf("let PN_ET=");
const fim = fonte.indexOf("/* 04/11/2026 (dono): o que falta para gerar o contrato");
assert.ok(ini > 0 && fim > ini, "bloco das etapas não achado");

const COLS = {
  "ITBI PAGO": { nome: "ITBI PAGO", tipo: "select", opcoes: ["SIM", "NÃO"] },
  "DATA DO ITBI": { nome: "DATA DO ITBI", tipo: "date" },
  "OBS ITBI": { nome: "OBS ITBI", tipo: "rich_text" },
  "AGUA TRANSFERIDA": { nome: "AGUA TRANSFERIDA", tipo: "select", opcoes: ["SIM", "NÃO"] },
  "ENERGIA TRANSFERIDA": { nome: "ENERGIA TRANSFERIDA", tipo: "select", opcoes: ["SIM", "NÃO"] },
  "CAMPO NOVO": { nome: "CAMPO NOVO", tipo: "rich_text" },
};
function montar(valores) {
  const ctx = {
    campoPorNome: (n) => COLS[n] || null,
    getV: (V, n) => V[n],
    ehSimNao: (o) => Array.isArray(o) && o.length > 0 && o.length <= 2 && o.every((x) => x === "SIM" || x === "NÃO"),
    esc: (x) => String(x),
    document: { getElementById: () => null },
  };
  vm.createContext(ctx);
  vm.runInContext(fonte.slice(ini, fim) + "\nthis.pnEtapasHtml = pnEtapasHtml; this.pnEtapaResumo = pnEtapaResumo; this.getEt = () => PN_ET;", ctx);
  return { ctx, V: valores };
}
const grade = (campos) => "<g>" + campos.join("|") + "</g>";
const GRUPOS = () => [
  { titulo: "1 · A", etapa: "A", campos: ["ITBI PAGO", "DATA DO ITBI", "OBS ITBI"] },
  { titulo: "2 · B", etapa: "B", campos: ["AGUA TRANSFERIDA"] },
  { titulo: "3 · C", etapa: "C", campos: ["ENERGIA TRANSFERIDA"] },
  { titulo: "4 · OUTROS CAMPOS", etapa: "OUTROS CAMPOS", campos: ["CAMPO NOVO"] },
];

test("conta preenchidos e só dá o selo quando todo sim/não e data da etapa está preenchido", () => {
  const { ctx } = montar({});
  const r1 = ctx.pnEtapaResumo(["ITBI PAGO", "DATA DO ITBI", "OBS ITBI"], { "ITBI PAGO": "SIM", "DATA DO ITBI": "2026-01-02" }, false);
  assert.deepEqual({ ...r1 }, { preenchidos: 2, total: 3, concluida: true }, "texto livre vazio não impede o selo");
  const r2 = ctx.pnEtapaResumo(["ITBI PAGO", "DATA DO ITBI"], { "ITBI PAGO": "SIM" }, false);
  assert.equal(r2.concluida, false);
  const r3 = ctx.pnEtapaResumo(["OBS ITBI"], { "OBS ITBI": "x" }, false);
  assert.equal(r3.concluida, false, "etapa sem sim/não nem data nunca fica concluída");
});

test("ao abrir ficam abertas a primeira não concluída e a seguinte; OUTROS fecha; concluídas fecham", () => {
  const { ctx } = montar({});
  const V = { "ITBI PAGO": "SIM", "DATA DO ITBI": "2026-01-02" };
  const html = ctx.pnEtapasHtml(GRUPOS(), grade, V, "pg1", false);
  const abertas = [...html.matchAll(/<details class="pn-etapa" data-etapa="([^"]+)"( open)?>/g)].map((m) => [m[1], !!m[2]]);
  assert.deepEqual(abertas, [["A", false], ["B", true], ["C", true], ["OUTROS CAMPOS", false]]);
  /* etapa concluída com caixa opcional vazia não mostra "2 de 3" ao lado de "concluída" (confundia na tela) */
  assert.doesNotMatch(html, /2 de 3/);
  assert.match(html, /<span class="chip ok">concluída<\/span>/);
  assert.match(html, /id="pn-et-todas"[^>]*>Fechar todas</);
});

test("o estado aberto/fechado lembrado vale ao redesenhar a mesma obra e zera em outra", () => {
  const { ctx } = montar({});
  ctx.pnEtapasHtml(GRUPOS(), grade, {}, "pg1", false);
  ctx.getEt().abertas["C"] = false;
  ctx.getEt().abertas["OUTROS CAMPOS"] = true;
  const h2 = ctx.pnEtapasHtml(GRUPOS(), grade, {}, "pg1", false);
  assert.match(h2, /data-etapa="OUTROS CAMPOS" open/);
  assert.doesNotMatch(h2, /data-etapa="C" open/);
  const h3 = ctx.pnEtapasHtml(GRUPOS(), grade, {}, "pg2", false);
  assert.doesNotMatch(h3, /data-etapa="OUTROS CAMPOS" open/);
  assert.match(h3, /data-etapa="A" open/);
});

test("campo sensível ainda carregando conta como vazio e impede o selo", () => {
  const { ctx } = montar({});
  COLS["ITBI PAGO"].sensivel = true;
  try {
    const r = ctx.pnEtapaResumo(["ITBI PAGO"], { "ITBI PAGO": "SIM" }, true);
    assert.equal(r.concluida, false);
    assert.equal(r.preenchidos, 0);
  } finally { delete COLS["ITBI PAGO"].sensivel; }
});

test("cartão do condomínio: grupos recolhíveis, contagem lida da tela e estado zerado ao fechar", () => {
  assert.match(fonte, /<details class="cd-and cd-etapa" data-etapa=/);
  assert.match(fonte, /function condEtapaContar\(d\)/);
  assert.match(fonte, /COND_ABERTA=null; CD_ET=\{id:null,abertas:\{\}\};/);
});
