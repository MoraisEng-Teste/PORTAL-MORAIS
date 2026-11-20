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
