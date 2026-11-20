/* Onda 2 (ux) da tela Gestão de Vendas — textos e avisos visíveis. Dados inventados. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const D = req("../../venda-dossie.js");
const A = req("../assinatura-ui.js");
const tudo = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("item 3a: casa sem tipo mostra o motivo junto dos botões de documento e do Ler documentos", () => {
  const h = D.html({ tipoCasa: "", arquivos: {}, pendentes: [] }, {});
  assert.ok((h.match(/class="dz-motivo"/g) || []).length >= 2);
  assert.match(tudo(h), /Escolha o tipo de casa\./);
  const ok = D.html({ tipoCasa: "CASA PRONTA", arquivos: {}, pendentes: [] }, {});
  assert.doesNotMatch(ok, /dz-motivo[^>]*>Escolha o tipo/);
});

test("item 3e: Lançar no Mais Controle apagado antes da prévia diz 'Veja a prévia primeiro.'", () => {
  const h = D.htmlMC({ situacao: "", vendaId: "" }, {});
  assert.match(h, /data-acao="mc-lancar" disabled>Lançar no Mais Controle<\/button>/);
  assert.match(tudo(h), /Veja a prévia primeiro\./);
  const liberado = D.htmlMC({ situacao: "PRÉVIA OK", vendaId: "" }, {});
  assert.doesNotMatch(tudo(liberado), /Veja a prévia primeiro\./);
});

test("item 3: o motivo é texto visível (span), nunca só title", () => {
  const h = D.htmlLerTodos({ tipoCasa: "", pendentes: [] }, {}, "topo");
  assert.match(h, /<span class="dz-motivo" role="note">Escolha o tipo de casa\.<\/span>/);
});

const uic = (x = {}) => Object.assign({ ocupadoContrato: null, faltas: null, msg: "", testes: false }, x);
const PRE = (x = {}) => ({ gerado: false, etapa: "PRE", pre: Object.assign({ nome: "PREVIA X.pdf", url: "https://drive.example/p", em: "", conferido: false, desatualizado: false }, x) });

test("item 4: prévia desatualizada → UMA faixa no topo com o botão que resolve; sem faixa quando está em dia", () => {
  const h = D.htmlContrato(PRE({ desatualizado: true }), uic());
  assert.equal((h.match(/class="dz-faixa"/g) || []).length, 1);
  assert.ok(h.indexOf("dz-faixa") < h.indexOf("Visualizar prévia"), "a faixa vem antes do resto");
  assert.match(h, /<div class="dz-faixa"[^>]*>.*data-acao="c-pre"[^>]*>Gerar prévia do contrato de novo<\/button>/);
  assert.equal((h.match(/Os dados mudaram depois desta prévia do contrato/g) || []).length, 1, "texto não repete lá embaixo");
  assert.doesNotMatch(D.htmlContrato(PRE(), uic()), /dz-faixa/);
});

test("item 4: contrato final com envio desatualizado mostra a faixa; ocupado apaga o botão e diz por quê", () => {
  const e = { gerado: true, nome: "Contrato.pdf", etapa: "FINAL", envioDesatualizado: true };
  const h = D.htmlContrato(e, uic());
  assert.match(tudo(h), /Contrato desatualizado\. O fluxo ou as condições especiais mudaram depois do contrato/);
  const o = D.htmlContrato(e, uic({ ocupadoContrato: "pre" }));
  assert.match(o, /<div class="dz-faixa"[^>]*>.*data-acao="c-pre" disabled>Gerar prévia do contrato de novo<\/button> <span class="dz-motivo"/);
  assert.doesNotMatch(D.htmlContrato({ gerado: true, nome: "C.pdf", etapa: "FINAL" }, uic()), /dz-faixa/);
});

import fs from "node:fs";
const vendas = fs.readFileSync(new URL("../../vendas.html", import.meta.url), "utf8");
const dossie = fs.readFileSync(new URL("../../venda-dossie.js", import.meta.url), "utf8");

test("item 5: Resumo (rua e condomínio) tem a caixa 'Faltam N dados' alimentada pela última lista do servidor", () => {
  assert.match(vendas, /faltasContratoBox\(l\.id,"cond"\)/);
  assert.match(vendas, /sec\.resumo\+=faltasContratoBox\(pageId,"rua"\)/);
  assert.match(dossie, /avisarFaltas\(pageId, r\.faltas\.map\(String\)\)/);
  assert.match(dossie, /avisarFaltas\(pageId, \[\]\)/, "contrato gerado limpa a lista");
  const i = vendas.indexOf("const FALTAS_CONTRATO={}"), j = vendas.indexOf("function faltasContratoRepintar");
  assert.ok(i > 0 && j > i);
  const f = new Function("esc", vendas.slice(i, j) + "\nreturn { FALTAS_CONTRATO, faltasContratoBox };")((s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"));
  assert.equal(f.faltasContratoBox("abc-1", "rua"), '<div class="faltas-box" data-faltas-pid="abc1" data-modo="rua"></div>'.replace("abc1", "abc-1"));
  f.FALTAS_CONTRATO["abc1"] = { lista: ["Comprador 1: CPF", "Imóvel: matrícula individual"], origem: "tentativa" };
  const h = f.faltasContratoBox("abc-1", "rua");
  assert.match(h, /Faltam 2 dados para o contrato <small>\(da última tentativa de gerar\)<\/small>/);
  assert.equal((h.match(/class="faltas-ir"/g) || []).length, 2);
  f.FALTAS_CONTRATO["abc1"] = { lista: ["Fiador 1: nome"], origem: "cadastro" };
  assert.match(f.faltasContratoBox("abc-1", "cond"), /Faltam 1 dado de compradores e fiadores para o contrato/);
});

/* ---- item 6: endereço e botão Voltar (histórico) — navegador simulado ---- */
function navegador(hashInicial = "") {
  const ini = vendas.indexOf("let _navMudo=0;"), fim = vendas.indexOf("/* ---------- SETOR ---------- */", ini);
  assert.ok(ini > 0 && fim > ini);
  const fonteNorm = [vendas.slice(vendas.indexOf("const _NORM_CACHE="), vendas.indexOf("\n", vendas.indexOf("const _NORM_CACHE=")) + 1),
    vendas.slice(vendas.indexOf("function _normNomeBruto("), vendas.indexOf("\n", vendas.indexOf("function _normNomeBruto(")) + 1),
    vendas.slice(vendas.indexOf("function normNome(s){"), vendas.indexOf("\n}", vendas.indexOf("function normNome(s){")) + 2)].join("\n");
  const corpo = `
    const pilha = [{ state: null, url: "/vendas.html" + ${JSON.stringify(hashInicial)} }]; let pos = 0; const ouvintes = {};
    const location = { pathname: "/vendas.html", search: "", get hash() { const u = pilha[pos].url; const i = u.indexOf("#"); return i < 0 ? "" : u.slice(i); } };
    const history = {
      get state() { return pilha[pos].state; },
      pushState(s, _t, u) { pilha.length = pos + 1; pilha.push({ state: s, url: u }); pos++; },
      replaceState(s, _t, u) { pilha[pos] = { state: s, url: u }; },
      back() { pos = Math.max(0, pos - 1); disparar(); }
    };
    function disparar() { (ouvintes.popstate || []).forEach(f => f({ state: pilha[pos].state })); }
    const window = { history, addEventListener(n, f) { (ouvintes[n] = ouvintes[n] || []).push(f); } };
    const tela = { setor: false, aba: null, painel: false, card: false, sujo: false, perguntou: 0 };
    const SETORES_AREA = [{ nome: "Secretaria de Vendas", ativo: true }, { nome: "Gestor de Vendas", ativo: true }];
    const ABAS = { "Secretaria de Vendas": ["atividades", "alertas", "planilha"], "Gestor de Vendas": ["vendidas", "estoque"] };
    const abasDoSetor = n => ABAS[n];
    let SETOR_ATUAL = "Secretaria de Vendas", OBRA_ABERTA = null, COND_ABERTA = null; const COND = { linhas: [{ id: "u1" }] };
    const document = { getElementById(id) {
      if (id === "view-setor") return { style: { get display() { return tela.setor ? "block" : "none"; } } };
      if (id === "cd-card") return { style: { get display() { return tela.card ? "block" : "none"; } }, get innerHTML() { return tela.card ? "x" : ""; } };
      if (id === "painel") return { classList: { contains: () => tela.painel } };
      return null; },
      querySelector() { return tela.aba ? { dataset: { t: tela.aba } } : null; } };
    function abrirSetor(n) { SETOR_ATUAL = n; tela.setor = true; navMudo(() => abaSetor(abasDoSetor(n)[0])); navPush(null); }
    function abaSetor(t) { tela.aba = t; navPush(null); }
    function irHubTela() { tela.setor = false; }
    function irHub() { irHubTela(); navPush(null); }
    function abrirObra(id) { OBRA_ABERTA = id; tela.painel = true; navPush("painel", id); }
    function fecharObra() { const estava = tela.painel; OBRA_ABERTA = null; tela.painel = false; if (estava) navFechouOverlay("painel"); }
    function condAbrir(id) { COND_ABERTA = id; tela.card = true; navPush("card", id); }
    function condFechar() { if (tela.sujo) { tela.perguntou++; return; } COND_ABERTA = null; tela.card = false; navFechouOverlay("card"); }
    ${vendas.slice(ini, fim)}
    return { tela, pilha, get pos() { return pos; }, history, window, location, abrirSetor, abaSetor, irHub, abrirObra, fecharObra, condAbrir, condFechar,
             voltar: () => history.back(), navIniciar, get SETOR_ATUAL() { return SETOR_ATUAL; } };`;
  return new Function(fonteNorm + "\n" + corpo)();
}

test("item 6: setor e aba entram no histórico; Voltar volta de aba e de setor; sem passo repetido", () => {
  const n = navegador();
  n.navIniciar();
  n.abrirSetor("Secretaria de Vendas");
  assert.equal(n.pilha.at(-1).url, "/vendas.html#setor/secretaria-de-vendas");
  n.abaSetor("alertas"); n.abaSetor("alertas");
  assert.equal(n.pilha.at(-1).url, "/vendas.html#setor/secretaria-de-vendas/alertas");
  assert.equal(n.pilha.length, 3, "hub, setor, aba (a mesma aba duas vezes não empilha)");
  n.voltar(); assert.equal(n.tela.aba, "atividades");
  n.voltar(); assert.equal(n.tela.setor, false, "Voltar do setor leva ao início");
  assert.equal(n.pos, 0);
});

test("item 6: cartão e painel abertos são um passo; Voltar fecha o cartão antes de voltar de aba", () => {
  const n = navegador();
  n.navIniciar(); n.abrirSetor("Secretaria de Vendas"); n.abaSetor("planilha");
  n.condAbrir("u1");
  assert.equal(n.pilha.at(-1).url, "/vendas.html#setor/secretaria-de-vendas/planilha", "mesmo endereço, sem id");
  assert.equal(n.pilha.at(-1).state.ov, "card");
  n.voltar();
  assert.equal(n.tela.card, false, "o cartão fechou");
  assert.equal(n.tela.aba, "planilha", "e continua na mesma aba");
  assert.equal(n.history.state.ov, null);
  n.abrirObra("p1"); n.fecharObra();
  assert.equal(n.history.state.ov, null, "fechar pelo botão tira o passo do painel");
  n.voltar(); assert.equal(n.tela.aba, "atividades", "depois do cartão, Voltar volta de aba");
});

test("item 6: Voltar com algo não salvo passa pela pergunta e, ao continuar editando, o cartão segue aberto no seu passo", () => {
  const n = navegador();
  n.navIniciar(); n.abrirSetor("Gestor de Vendas"); n.condAbrir("u1"); n.tela.sujo = true;
  n.voltar();
  assert.equal(n.tela.perguntou, 1, "perguntou 'Sair sem salvar?'");
  assert.equal(n.tela.card, true, "continua aberto");
  assert.equal(n.history.state.ov, "card", "o passo do cartão foi devolvido");
  n.tela.sujo = false; n.condFechar();
  assert.equal(n.tela.card, false); assert.equal(n.history.state.ov, null);
});

test("item 6: abrir a página com #setor/<slug>/<aba> reabre setor e aba, nunca o cartão; id não vai no endereço", () => {
  const n = navegador("#setor/secretaria-de-vendas/alertas");
  n.navIniciar();
  assert.equal(n.tela.setor, true); assert.equal(n.tela.aba, "alertas"); assert.equal(n.tela.card, false);
  assert.equal(n.pilha.length, 1, "não empilha nada ao carregar");
  const ruim = navegador("#setor/nao-existe/x"); ruim.navIniciar(); assert.equal(ruim.tela.setor, false);
  const m = navegador(); m.navIniciar(); m.abrirSetor("Secretaria de Vendas"); m.abrirObra("0123456789abcdef0123456789abcdef");
  assert.ok(m.pilha.every((p) => !/[0-9a-f]{32}/.test(p.url)), "nenhum endereço tem o id");
});
