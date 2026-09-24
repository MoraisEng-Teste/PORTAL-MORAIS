/* RegrasVenda — regras puras do dossiê do comprador (entrega 1).
 * Roda igual no Apps Script (arquivo RegrasVenda.gs do projeto PORTAL-VENDA)
 * e no node (testes em venda/testes). Sem rede, sem Notion, sem Claude.
 * Repositório público: nenhum dado real aqui nem nos testes. */
var RegrasVenda = (function () {
  "use strict";

  var COL = {
    TIPO_CASA: "TIPO DE CASA",
    C1_IDENT: "COMPRADOR 1 - IDENTIDADE",
    C1_COMPROV: "COMPRADOR 1 - COMPROVANTE DE ENDEREÇO",
    C2_IDENT: "COMPRADOR 2 - IDENTIDADE",
    C2_COMPROV: "COMPRADOR 2 - COMPROVANTE DE ENDEREÇO",
    APROVACAO: "APROVAÇÃO DA CAIXA",
    CLIENTES: "CLIENTES",
    CPF1: "CPF",
    C1_DOC: "COMPRADOR 1 - DOCUMENTO",
    C1_NAC: "COMPRADOR 1 - NACIONALIDADE",
    C1_ESTCIV: "COMPRADOR 1 - ESTADO CIVIL",
    C1_PROF: "COMPRADOR 1 - PROFISSÃO",
    C1_END: "COMPRADOR 1 - ENDEREÇO",
    C2_NOME: "COMPRADOR 2 - NOME",
    C2_CPF: "COMPRADOR 2 - CPF",
    C2_DOC: "COMPRADOR 2 - DOCUMENTO",
    C2_NAC: "COMPRADOR 2 - NACIONALIDADE",
    C2_ESTCIV: "COMPRADOR 2 - ESTADO CIVIL",
    C2_PROF: "COMPRADOR 2 - PROFISSÃO",
    C2_END: "COMPRADOR 2 - ENDEREÇO",
    C2_EMAIL: "COMPRADOR 2 - E-MAIL",
    C2_TEL: "COMPRADOR 2 - TELEFONE",
    FINANCIADO: "VALOR FINANCIADO",
    FGTS: "VALOR DO FGTS",
    SUBSIDIO: "VALOR DO SUBSÍDIO",
    DOSSIE: "DOSSIÊ",
    OBS: "DOSSIÊ - OBSERVAÇÃO DO COMPRADOR"
  };

  var TIPOS = {};
  Object.keys(COL).forEach(function (k) { TIPOS[COL[k]] = "rich_text"; });
  [COL.C1_IDENT, COL.C1_COMPROV, COL.C2_IDENT, COL.C2_COMPROV, COL.APROVACAO]
    .forEach(function (c) { TIPOS[c] = "files"; });
  [COL.TIPO_CASA, COL.DOSSIE].forEach(function (c) { TIPOS[c] = "select"; });
  [COL.FINANCIADO, COL.FGTS, COL.SUBSIDIO].forEach(function (c) { TIPOS[c] = "number"; });
  TIPOS[COL.C2_EMAIL] = "email";
  TIPOS[COL.C2_TEL] = "phone_number";

  var ESPACOS = {
    C1_IDENTIDADE:  { coluna: COL.C1_IDENT,   tipo: "identidade",  comprador: 1, rotulo: "Identidade do comprador 1", esperado: "uma identidade (CNH ou RG)" },
    C1_COMPROVANTE: { coluna: COL.C1_COMPROV, tipo: "comprovante", comprador: 1, rotulo: "Comprovante do comprador 1", esperado: "um comprovante de endereço" },
    C2_IDENTIDADE:  { coluna: COL.C2_IDENT,   tipo: "identidade",  comprador: 2, rotulo: "Identidade do comprador 2", esperado: "uma identidade (CNH ou RG)" },
    C2_COMPROVANTE: { coluna: COL.C2_COMPROV, tipo: "comprovante", comprador: 2, rotulo: "Comprovante do comprador 2", esperado: "um comprovante de endereço" },
    APROVACAO:      { coluna: COL.APROVACAO,  tipo: "aprovacao",   comprador: 0, rotulo: "Aprovação da Caixa",        esperado: "a aprovação da Caixa" }
  };

  var ESTADOS = { FALTA: "FALTA DOCUMENTO", LIDO: "LIDO PELA IA – CONFERIR", CONFERIDO: "CONFERIDO", DEVOLVIDO: "DEVOLVIDO" };
  var TIPOS_CASA = ["CASA DE RUA", "CASA DE CONDOMÍNIO"];

  var ACEITOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  var POR_EXTENSAO = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  var LIMITE_IMAGEM = 5 * 1024 * 1024, LIMITE_PDF = 10 * 1024 * 1024;

  function texto(s) { return s === null || s === undefined ? "" : String(s); }
  function chave(s) {
    return texto(s).normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[–—]/g, "-").toUpperCase().replace(/\s+/g, " ").trim();
  }
  function soDigitos(s) { return texto(s).replace(/\D/g, ""); }
  function cpfValido(cpf) {
    var d = soDigitos(cpf);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    for (var t = 9; t < 11; t++) {
      var soma = 0;
      for (var i = 0; i < t; i++) soma += Number(d[i]) * (t + 1 - i);
      if ((soma * 10) % 11 % 10 !== Number(d[t])) return false;
    }
    return true;
  }
  function mascararCpf(cpf) { var d = soDigitos(cpf); return d ? "***-" + d.slice(-2) : "sem CPF"; }
  function formatarCpf(cpf) {
    var d = soDigitos(cpf);
    return d.length === 11 ? d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6, 9) + "-" + d.slice(9) : d;
  }
  function contemNome(textoMaior, nome) {
    var b = chave(nome);
    return !!b && (" " + chave(textoMaior) + " ").indexOf(" " + b + " ") >= 0;
  }
  function dataDoc(s) {
    var t = texto(s).trim(), m;
    if ((m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t))) return m[3] + "-" + m[2] + "-" + m[1];
    if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t))) return m[1] + "-" + m[2] + "-" + m[3];
    return "";
  }
  function diasEntre(isoA, isoB) {
    return Math.round((Date.parse(isoB + "T00:00:00Z") - Date.parse(isoA + "T00:00:00Z")) / 86400000);
  }
  function valorBR(s) {
    if (typeof s === "number") return isFinite(s) ? s : null;
    var t = texto(s).replace(/[^\d,.\-]/g, "");
    if (!t) return null;
    if (t.indexOf(",") >= 0) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    var n = Number(t);
    return isFinite(n) ? n : null;
  }
  function vazio(v) {
    return v === null || v === undefined || (typeof v === "string" && v.trim() === "") ||
      (Array.isArray(v) && v.length === 0);
  }
  function iguais(a, b, modo) {
    if (modo === "number") return Number(a) === Number(b);
    if (modo === "cpf") return soDigitos(a) === soDigitos(b);
    return chave(a) === chave(b);
  }
  function resolverColunas(schema) {
    var porChave = {};
    Object.keys(schema).forEach(function (n) { porChave[chave(n)] = n; });
    var mapa = {}, faltando = [], tipoErrado = [];
    Object.keys(COL).forEach(function (k) {
      var canon = COL[k], real = porChave[chave(canon)];
      if (!real) { faltando.push(canon); return; }
      mapa[canon] = real;
      if (schema[real].tipo !== TIPOS[canon]) tipoErrado.push(canon);
    });
    return { mapa: mapa, faltando: faltando, tipoErrado: tipoErrado };
  }
  function resolverOpcao(opcoes, desejada) {
    var k = chave(desejada);
    for (var i = 0; i < (opcoes || []).length; i++) if (chave(opcoes[i]) === k) return opcoes[i];
    return desejada;
  }
  function manterArquivo(f) {
    if (f.type === "external") return { type: "external", name: f.name, external: { url: f.external.url } };
    return { type: "file", name: f.name, file: { url: f.file.url } };
  }
  function mimeDoArquivo(nome, ct) {
    var c = texto(ct).split(";")[0].trim().toLowerCase();
    if (ACEITOS.indexOf(c) >= 0) return c;
    var ext = texto(nome).split(".").pop().toLowerCase();
    return POR_EXTENSAO[ext] || c || "application/octet-stream";
  }
  function tamanhoBase64(b64) {
    var s = texto(b64), pad = s.slice(-2) === "==" ? 2 : (s.slice(-1) === "=" ? 1 : 0);
    return Math.floor(s.length * 3 / 4) - pad;
  }
  function conferirArquivo(a) {
    if (!a || !a.base64) return { ok: false, erro: "SEM_ARQUIVO" };
    if (ACEITOS.indexOf(a.mime) < 0) return { ok: false, erro: "TIPO_DE_ARQUIVO_NAO_SUPORTADO" };
    var lim = a.mime === "application/pdf" ? LIMITE_PDF : LIMITE_IMAGEM;
    if (tamanhoBase64(a.base64) > lim) return { ok: false, erro: "ARQUIVO_GRANDE" };
    return { ok: true };
  }
  function juntarObservacoes(atual, novas, dataCurta, login) {
    var linhas = (novas || []).map(function (t) { return "[" + dataCurta + " " + (login || "") + "] " + t; });
    var tudo = (vazio(atual) ? "" : texto(atual) + "\n") + linhas.join("\n");
    return tudo.length > 1900 ? "…" + tudo.slice(-1899) : tudo;
  }
  function temDoisCompradores(atuais) {
    return !vazio(atuais[COL.C2_NOME]) || !vazio(atuais[COL.C2_IDENT]) || !vazio(atuais[COL.C2_COMPROV]);
  }
  function contarArquivos(atuais) {
    var r = {};
    Object.keys(ESPACOS).forEach(function (id) { r[id] = (atuais[ESPACOS[id].coluna] || []).length; });
    return r;
  }
  function estadoAposLeitura(arquivos, dois) {
    var obrig = ["C1_IDENTIDADE", "C1_COMPROVANTE"].concat(dois ? ["C2_IDENTIDADE", "C2_COMPROVANTE"] : []);
    var faltam = obrig.filter(function (id) { return !(arquivos[id] > 0); });
    return { estado: faltam.length ? ESTADOS.FALTA : ESTADOS.LIDO, faltam: faltam };
  }

  var TIPOS_DOC = { identidade: ["CNH", "RG"], comprovante: ["COMPROVANTE"], aprovacao: ["APROVACAO"] };

  function planejarGravacao(espacoId, leitura, atuais, hojeISO) {
    var esp = ESPACOS[espacoId];
    if (!esp) throw new Error("ESPACO_DESCONHECIDO: " + espacoId);
    leitura = leitura || {};
    atuais = atuais || {};
    var plano = { props: {}, observacoes: [], preenchidos: [] };
    function obs(t) { plano.observacoes.push(esp.rotulo + ": " + t); }
    function gravar(col, valor) { plano.props[col] = valor; plano.preenchidos.push(col); }
    function propor(col, valor, modo) {
      if (vazio(valor)) return;
      var atual = atuais[col];
      if (vazio(atual)) { gravar(col, valor); return; }
      if (iguais(atual, valor, modo)) return;
      obs("o campo " + col + " já tem outro valor e o documento diz diferente" +
        (modo === "cpf" ? " (documento " + mascararCpf(valor) + ", campo " + mascararCpf(atual) + ")" : "") +
        " — conferir");
    }

    var tipoLido = texto(leitura.tipo_documento).toUpperCase().trim();
    if (TIPOS_DOC[esp.tipo].indexOf(tipoLido) < 0) {
      obs("o arquivo não parece ser " + esp.esperado + " — nada foi preenchido");
      return plano;
    }

    if (esp.tipo === "identidade") {
      var nome = texto(leitura.nome).trim();
      var cpf = soDigitos(leitura.cpf);
      if (cpf && !cpfValido(cpf)) {
        obs("o CPF lido (" + mascararCpf(cpf) + ") não fecha o dígito verificador — não foi gravado, conferir");
        cpf = "";
      }
      var numero = texto(leitura.numero_documento).trim();
      var doc = numero ? [tipoLido, numero, texto(leitura.orgao_emissor).trim()].filter(function (x) { return x; }).join(" ") : "";
      var cli = atuais[COL.CLIENTES];
      if (esp.comprador === 1) {
        if (nome) {
          if (vazio(cli)) gravar(COL.CLIENTES, vazio(atuais[COL.C2_NOME]) ? nome : nome + " E " + texto(atuais[COL.C2_NOME]).trim());
          else if (!contemNome(cli, nome)) obs("o nome lido não aparece em CLIENTES — conferir");
        }
        propor(COL.CPF1, cpf ? formatarCpf(cpf) : "", "cpf");
        propor(COL.C1_DOC, doc, "texto");
        propor(COL.C1_NAC, leitura.nacionalidade, "texto");
      } else {
        propor(COL.C2_NOME, nome, "texto");
        if (nome && !vazio(cli) && !contemNome(cli, nome)) {
          if ((" " + chave(cli) + " ").indexOf(" E ") < 0) gravar(COL.CLIENTES, texto(cli).trim() + " E " + nome);
          else obs("o nome lido não aparece em CLIENTES — conferir");
        }
        propor(COL.C2_CPF, cpf ? formatarCpf(cpf) : "", "cpf");
        propor(COL.C2_DOC, doc, "texto");
        propor(COL.C2_NAC, leitura.nacionalidade, "texto");
      }
    } else if (esp.tipo === "comprovante") {
      propor(esp.comprador === 2 ? COL.C2_END : COL.C1_END, leitura.endereco_completo, "texto");
      var dono = esp.comprador === 2 ? atuais[COL.C2_NOME] : atuais[COL.CLIENTES];
      if (!vazio(leitura.titular) && !vazio(dono) && !contemNome(dono, leitura.titular))
        obs("o comprovante está em nome de outra pessoa — conferir (se for de parente, pedir a declaração)");
      var d = dataDoc(leitura.data_emissao);
      if (!d) obs("não consegui ler a data do comprovante — conferir se tem menos de 90 dias");
      else {
        var dias = diasEntre(d, hojeISO);
        if (dias > 90) obs("o comprovante tem " + dias + " dias (mais de 90) — pedir um mais recente");
      }
    } else {
      propor(COL.FINANCIADO, valorBR(leitura.valor_financiado), "number");
      propor(COL.FGTS, valorBR(leitura.valor_fgts), "number");
      propor(COL.SUBSIDIO, valorBR(leitura.valor_subsidio), "number");
      var cpfP = soDigitos(leitura.cpf_proponente);
      var cpfs = [soDigitos(atuais[COL.CPF1]), soDigitos(atuais[COL.C2_CPF])].filter(function (x) { return x; });
      if (cpfP && cpfs.length && cpfs.indexOf(cpfP) < 0)
        obs("o CPF do proponente (" + mascararCpf(cpfP) + ") não é o de nenhum comprador — conferir");
    }
    return plano;
  }

  return {
    COL: COL, TIPOS: TIPOS, ESPACOS: ESPACOS, ESTADOS: ESTADOS, TIPOS_CASA: TIPOS_CASA,
    chave: chave, soDigitos: soDigitos, cpfValido: cpfValido, mascararCpf: mascararCpf,
    formatarCpf: formatarCpf, contemNome: contemNome, dataDoc: dataDoc, diasEntre: diasEntre,
    valorBR: valorBR, vazio: vazio, iguais: iguais, resolverColunas: resolverColunas,
    resolverOpcao: resolverOpcao, manterArquivo: manterArquivo, mimeDoArquivo: mimeDoArquivo,
    conferirArquivo: conferirArquivo, juntarObservacoes: juntarObservacoes,
    temDoisCompradores: temDoisCompradores, contarArquivos: contarArquivos,
    estadoAposLeitura: estadoAposLeitura, planejarGravacao: planejarGravacao
  };
})();
if (typeof module !== "undefined" && module.exports) module.exports = RegrasVenda;
