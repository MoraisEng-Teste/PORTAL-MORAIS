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
  assert.doesNotMatch(ok, /Escolha o tipo de casa\./.source ? /dz-motivo[^>]*>Escolha o tipo/ : /x/);
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
