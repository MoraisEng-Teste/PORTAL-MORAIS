/* 20/11/2026 (usabilidade) — planilha de casas de rua: lista curta, colunas do processo, todas. Só nomes de coluna. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const P = require("../painel-casa.js");
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const vendas = fs.readFileSync(path.join(RAIZ, "vendas.html"), "utf8");

const NOMES = ["ENDEREÇO", "CLIENTES", "CPF", "Email", "DATA DA VENDA", "VALOR DE COMPRA E VENDA NO CONTRATO (VENDIDA)", "CORRETOR",
  "TELEFONE CORRETOR", "IMOBILIÁRIA", "CORRESPONDENTE", "BANCO", "SITUAÇÃO DO PROCESSO", "ITBI PAGO", "AVALIAÇÃO", "COLUNA NOVA QUALQUER", "ANOTAÇÕES"];

test("lista curta: título primeiro, só as colunas combinadas, situação do processo junto", () => {
  const c = P.colunasRua(NOMES, false, false);
  assert.deepEqual(c, ["ENDEREÇO", "CLIENTES", "DATA DA VENDA", "VALOR DE COMPRA E VENDA NO CONTRATO (VENDIDA)", "CORRETOR", "IMOBILIÁRIA",
    "CORRESPONDENTE", "BANCO", "SITUAÇÃO DO PROCESSO"]);
});

test("lista curta usa só o que existe", () => {
  assert.deepEqual(P.colunasRua(["ENDEREÇO", "BANCO", "XYZ"], false, false), ["ENDEREÇO", "BANCO"]);
  assert.deepEqual(P.colunasRua([], true, true), []);
});

test("colunas do processo: curta + etapas na ordem; coluna fora das etapas não entra", () => {
  const c = P.colunasRua(NOMES, true, false);
  assert.ok(c.indexOf("AVALIAÇÃO") > c.indexOf("SITUAÇÃO DO PROCESSO"));
  assert.ok(c.indexOf("AVALIAÇÃO") < c.indexOf("ITBI PAGO"), "avaliação é a 1ª etapa, ITBI vem depois");
  assert.ok(c.includes("BANCO"));
  assert.ok(!c.includes("COLUNA NOVA QUALQUER") && !c.includes("CPF"));
});

test("todas: tudo, sem repetir, título em primeiro", () => {
  const c = P.colunasRua(NOMES, false, true);
  assert.equal(c.length, NOMES.length);
  assert.equal(new Set(c).size, NOMES.length);
  assert.equal(c[0], "ENDEREÇO");
});

test("vendas.html: caixas nas duas planilhas e chaves próprias da rua", () => {
  for (const id of ["hub-proc", "hub-todas", "set-proc", "set-todas"]) assert.ok(vendas.includes('id="' + id + '"'), id);
  assert.ok(vendas.includes("rua_proc") && vendas.includes("rua_todas"));
  assert.ok(/renderTabela\(ctx\)\{\s*const cols=ruaColunas\(ctx\)/.test(vendas));
});
