/* Onda 3 (ux) da tela Gestão de Vendas — caixas no lugar das janelas nativas, celular, valores fixos, um só "Ler documentos". Dados inventados. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const D = req("../../venda-dossie.js");
const A = req("../assinatura-ui.js");
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const vendas = fs.readFileSync(path.join(RAIZ, "vendas.html"), "utf8");
const dossie = fs.readFileSync(path.join(RAIZ, "venda-dossie.js"), "utf8");

test("item 1: com a caixa da tela, a assinatura pergunta por ela (verbo no botão) e nunca pelo confirmar do navegador", async () => {
  const pend = { papel: "Testemunha 1", assinou: false, situacao: "pendente", data: "" };
  const c0 = { contratoGerado: true, ocupado: null, testes: false, msg: "", faltas: null,
    estado: { situacao: "ENVIADO", envelope: true, signatarios: [pend, Object.assign({}, pend, { papel: "Testemunha 2" })] } };
  const caixas = [], chamadas = [];
  const deps = (sim) => ({ pageId: "p", confirmar: () => { throw new Error("não devia usar o confirmar nativo"); },
    caixa: async (o) => { caixas.push(o); return sim; }, chamar: async (x) => { chamadas.push(x); return { ok: true, situacao: "ENVIADO", pendentes: 2, signatarios: c0.estado.signatarios }; } });
  const nao = await A.executarAcaoAssinatura("a-reenviar", c0, deps(false));
  assert.equal(nao, c0, "cancelar na caixa não chama o servidor");
  assert.equal(chamadas.length, 0);
  await A.executarAcaoAssinatura("a-reenviar", c0, deps(true));
  assert.equal(caixas[1].ok, "Reenviar link");
  assert.match(caixas[1].itens[0], /As 2 pessoas que ainda não assinaram/);
  assert.deepEqual(chamadas.map((x) => x.action), ["assinaturaReenviar"]);
  const rasc = Object.assign({}, c0, { estado: { situacao: "RASCUNHO", envelope: true, signatarios: [pend] } });
  caixas.length = 0;
  await A.executarAcaoAssinatura("a-descartar", rasc, deps(false));
  assert.equal(caixas[0].perigo, true, "descartar apaga: estilo de perigo");
  assert.equal(caixas[0].ok, "Descartar rascunho");
});

test("item 1: venda-dossie.js e vendas.html só usam confirm()/prompt() nativos como reserva (sem a caixa)", () => {
  assert.equal((dossie.match(/window\.confirm\(/g) || []).length, 3, "caixaPagina (reserva) + 2 confirmar de reserva da assinatura");
  assert.equal((dossie.match(/window\.prompt\(/g) || []).length, 3);
  assert.doesNotMatch(vendas, /[^.\w]alert\(/, "nenhum alert() na tela");
  const semComentario = vendas.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal((semComentario.match(/[^.\w]confirm\(/g) || []).length, 0);
  assert.match(vendas, /function caixaSimNao\(o\)/);
  ["Excluir obra", "Apagar link", "Criar opção"].forEach((v) => assert.ok(vendas.includes('ok:"' + v + '"'), v));
  ["Gerar contrato", "Trocar documento", "Lançar no Mais Controle", "Confirmar recebimento"].forEach((v) => assert.ok(dossie.includes('ok: "' + v + '"'), v));
});

test("item 4: celular — alvos de 44 px, fonte de 12 px no mínimo, abas que rolam", () => {
  assert.match(vendas, /@media\(max-width:680px\)\{[\s\S]*?\.bt-mini\{min-height:44px\}/);
  assert.match(vendas, /\.pfechar\{[^}]*width:44px;height:44px/);
  assert.equal((vendas.match(/font-size:(9|9\.5|10|10\.5|11|11\.5)px/g) || []).length, 0, "nenhum texto abaixo de 12 px");
  assert.match(vendas, /\.pn-abas,\.cd-abas\{overflow-x:auto/);
  assert.match(vendas, /function abaAtivaVisivel\(raiz\)/);
});

test("item 4d: o editor de fluxo rotula as células por data-rot, não pela posição da coluna", () => {
  assert.doesNotMatch(vendas, /\.tbl-fx td:nth-child\(\d\)::before/);
  assert.match(vendas, /\.tbl-fx td\[data-rot\]::before\{content:attr\(data-rot\)/);
  const linhas = [{ t: "sinal", v: 10000, n: 1, d: "2026-10-30", i: 1, x: "" }, { t: "pre", v: 1000, n: 20, d: "2026-12-10", i: 1, x: "" },
                  { t: "fin", v: 70000, n: 1, d: "", i: 1, x: "" }];
  const ed = { valor: 100000, valorOriginal: 100000, entrega: "2028-12-01", linhas, padrao: { valor: 100000, linhas }, historico: [], alterado: false, motivo: "", motivoPreco: "" };
  const h = D.htmlFluxo({ coluna: true, alterado: false, trava: "", por: "", em: "", alteracoes: 0 }, { fluxoEd: ed }, "");
  ["Valor de cada (R$)", "Qtde", "1ª data", "A cada (meses)", "Última", "Descrição", "Total"].forEach((r) => assert.ok(h.includes('data-rot="' + r + '"'), r));
  assert.ok(h.includes('aria-label="Tirar a linha 2">✕<span class="bt-txt"> Tirar</span>'));
  assert.ok(h.includes('↻<span class="bt-txt"> Redistribuir</span>'));
});

test("item 4g: a conferência de documentos do painel da rua usa o mesmo empilhamento do cartão", () => {
  assert.match(vendas, /#pn-body \.vb-conf td\[data-rot\]::before/);
  assert.match(vendas, /#pn-body \.vb-conf table,#pn-body \.vb-conf tbody/);
});

test("item 4f: o cartão do condomínio prende o Tab dentro dele", () => {
  assert.match(vendas, /id="cd-fechar"/);
  assert.match(vendas, /o Tab fica preso dentro do cartão do condomínio/);
});

test("item 5: valores fixos do condomínio reunidos em CONDOMINIO_PADRAO; entrega é texto", () => {
  assert.match(vendas, /const CONDOMINIO_PADRAO=\{[\s\S]*?balaoRotulo:"Balão dez\/2027"[\s\S]*?sinal:10000[\s\S]*?entrega:"2028-11-30"/);
  assert.match(vendas, /add\(CONDOMINIO_PADRAO\.balaoRotulo,/);
  assert.match(vendas, /cdBRL\(CONDOMINIO_PADRAO\.sinal\)/);
  assert.match(vendas, /const COND_ENTREGA_PADRAO=CONDOMINIO_PADRAO\.entrega;/);
  assert.doesNotMatch(vendas, /id="cd-ent"/, "a data da entrega não é mais um campo desabilitado");
  assert.match(vendas, /Entrega: <b>'\+cdDia\(CONDOMINIO_PADRAO\.entrega\)/);
});

test("item 6: um só Ler documentos (o do topo); o do fim do imóvel fazia a mesma leitura e saiu", () => {
  const base = { tipoCasa: "CASA PRONTA", arquivos: {}, pendentes: [{ id: "s1", nome: "a.pdf", estado: "desconhecido", tipo: "OUTRO" }] };
  const h = D.html(base, {});
  assert.equal((h.match(/data-acao="ler-todos"/g) || []).length, 1);
  assert.match(h, /data-acao="ler-todos" data-onde="topo"/);
});
