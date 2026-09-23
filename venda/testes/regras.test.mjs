import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const R = require("../RegrasVenda.js");

test("cpfValido aceita CPF de exemplo e recusa dígito errado e repetido", () => {
  assert.equal(R.cpfValido("529.982.247-25"), true);
  assert.equal(R.cpfValido("52998224725"), true);
  assert.equal(R.cpfValido("529.982.247-24"), false);
  assert.equal(R.cpfValido("111.111.111-11"), false);
  assert.equal(R.cpfValido("123"), false);
});

test("mascararCpf e formatarCpf", () => {
  assert.equal(R.mascararCpf("529.982.247-25"), "***-25");
  assert.equal(R.mascararCpf(""), "sem CPF");
  assert.equal(R.formatarCpf("52998224725"), "529.982.247-25");
});

test("chave ignora acento, caixa, espaço sobrando e troca travessão por hífen", () => {
  assert.equal(R.chave("  Dossiê  - observação "), "DOSSIE - OBSERVACAO");
  assert.equal(R.chave("LIDO PELA IA – CONFERIR"), R.chave("lido pela ia - conferir"));
});

test("contemNome acha nome inteiro dentro de CLIENTES de casal", () => {
  assert.equal(R.contemNome("ANA TESTE E BRUNO TESTE", "bruno teste"), true);
  assert.equal(R.contemNome("ANA TESTE", "ANA"), true);
  assert.equal(R.contemNome("ANA TESTEIRA", "ANA TESTE"), false);
  assert.equal(R.contemNome("ANA TESTE", ""), false);
});

test("dataDoc e diasEntre", () => {
  assert.equal(R.dataDoc("05/08/2026"), "2026-08-05");
  assert.equal(R.dataDoc("2026-08-05T10:00"), "2026-08-05");
  assert.equal(R.dataDoc("agosto de 2026"), "");
  assert.equal(R.diasEntre("2026-06-01", "2026-09-23"), 114);
});

test("valorBR entende R$, milhar com ponto e vírgula decimal", () => {
  assert.equal(R.valorBR("R$ 180.000,00"), 180000);
  assert.equal(R.valorBR("180.000"), 180000);
  assert.equal(R.valorBR("12500,5"), 12500.5);
  assert.equal(R.valorBR("0,00"), 0);
  assert.equal(R.valorBR(""), null);
  assert.equal(R.valorBR("-"), null);
  assert.equal(R.valorBR(3500), 3500);
});

test("resolverColunas acha nomes com espaço sobrando, sem acento e hífen no lugar do travessão", () => {
  const schema = {};
  for (const canon of Object.values(R.COL)) schema[canon] = { tipo: R.TIPOS[canon] };
  delete schema["CLIENTES"]; schema["CLIENTES "] = { tipo: "rich_text" };
  delete schema["CPF"]; schema["CPF "] = { tipo: "rich_text" };
  delete schema["DOSSIÊ"]; schema["DOSSIE"] = { tipo: "select" };
  const r = R.resolverColunas(schema);
  assert.deepEqual(r.faltando, []);
  assert.deepEqual(r.tipoErrado, []);
  assert.equal(r.mapa["CLIENTES"], "CLIENTES ");
  assert.equal(r.mapa["DOSSIÊ"], "DOSSIE");
});

test("resolverColunas lista a que falta e a de tipo errado", () => {
  const schema = {};
  for (const canon of Object.values(R.COL)) schema[canon] = { tipo: R.TIPOS[canon] };
  delete schema["VALOR DO SUBSÍDIO"];
  schema["APROVAÇÃO DA CAIXA"] = { tipo: "rich_text" };
  const r = R.resolverColunas(schema);
  assert.deepEqual(r.faltando, ["VALOR DO SUBSÍDIO"]);
  assert.deepEqual(r.tipoErrado, ["APROVAÇÃO DA CAIXA"]);
});

test("resolverOpcao devolve a grafia real da opção", () => {
  assert.equal(R.resolverOpcao(["LIDO PELA IA - CONFERIR", "CONFERIDO"], "LIDO PELA IA – CONFERIR"), "LIDO PELA IA - CONFERIR");
  assert.equal(R.resolverOpcao([], "CONFERIDO"), "CONFERIDO");
});

test("manterArquivo reenvia arquivo do Notion como type file e externo como external", () => {
  assert.deepEqual(R.manterArquivo({ name: "a.pdf", type: "file", file: { url: "https://s3/x", expiry_time: "t" } }),
    { type: "file", name: "a.pdf", file: { url: "https://s3/x" } });
  assert.deepEqual(R.manterArquivo({ name: "b", type: "external", external: { url: "https://e" } }),
    { type: "external", name: "b", external: { url: "https://e" } });
});

test("mimeDoArquivo e conferirArquivo", () => {
  assert.equal(R.mimeDoArquivo("x.JPG", "binary/octet-stream"), "image/jpeg");
  assert.equal(R.mimeDoArquivo("x", "application/pdf; charset=x"), "application/pdf");
  assert.deepEqual(R.conferirArquivo({ mime: "image/heic", base64: "AAAA" }), { ok: false, erro: "TIPO_DE_ARQUIVO_NAO_SUPORTADO" });
  const seisMega = "A".repeat(Math.ceil(6 * 1024 * 1024 * 4 / 3));
  assert.deepEqual(R.conferirArquivo({ mime: "image/jpeg", base64: seisMega }), { ok: false, erro: "ARQUIVO_GRANDE" });
  assert.deepEqual(R.conferirArquivo({ mime: "application/pdf", base64: seisMega }), { ok: true });
  assert.deepEqual(R.conferirArquivo(null), { ok: false, erro: "SEM_ARQUIVO" });
});

test("juntarObservacoes acrescenta com data e login e corta em 1900 caracteres", () => {
  assert.equal(R.juntarObservacoes("", ["x"], "23/09", "ana"), "[23/09 ana] x");
  assert.equal(R.juntarObservacoes("antes", ["x", "y"], "23/09", "ana"), "antes\n[23/09 ana] x\n[23/09 ana] y");
  const longo = R.juntarObservacoes("z".repeat(3000), ["fim"], "23/09", "ana");
  assert.equal(longo.length, 1900);
  assert.ok(longo.endsWith("[23/09 ana] fim"));
});

test("temDoisCompradores, contarArquivos e estadoAposLeitura", () => {
  const um = { [R.COL.C1_IDENT]: [{}], [R.COL.C1_COMPROV]: [{}] };
  assert.equal(R.temDoisCompradores(um), false);
  const arq1 = R.contarArquivos(um);
  assert.equal(arq1.C1_IDENTIDADE, 1);
  assert.equal(arq1.APROVACAO, 0);
  assert.deepEqual(R.estadoAposLeitura(arq1, false), { estado: "LIDO PELA IA – CONFERIR", faltam: [] });
  const dois = Object.assign({}, um, { [R.COL.C2_NOME]: "BRUNO TESTE" });
  assert.equal(R.temDoisCompradores(dois), true);
  assert.deepEqual(R.estadoAposLeitura(R.contarArquivos(dois), true),
    { estado: "FALTA DOCUMENTO", faltam: ["C2_IDENTIDADE", "C2_COMPROVANTE"] });
});
