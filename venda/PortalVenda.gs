/* PORTAL-VENDA — dossiê do comprador (entrega 1).
 * Projeto do Apps Script SEPARADO do PORTAL-LEITURA/ESCRITA: um upload do
 * Code.gs do portal não apaga este, e vice-versa.
 * Arquivos do projeto: RegrasVenda.gs, ClaudeLeitor.gs, PortalVenda.gs.
 * Propriedades do script: NOTION_TOKEN, SESSION_SECRET (os MESMOS do portal
 * daquele ambiente), ANTHROPIC_API_KEY, DB_VENDAS.
 * Nenhum log com nome, CPF, endereço ou conteúdo de documento. */
var VERSAO_VENDA = "venda-v1";
var NOTION_VERSION = "2022-06-28";
var ERROS_CONHECIDOS = /^(COLUNA_FALTANDO|TIPO_DE_COLUNA_ERRADO|BACKEND_SEM_CONFIG)/;

function prop_(n) { return PropertiesService.getScriptProperties().getProperty(n) || ""; }

function doGet(e) { return responder_(tratar_(lerPedido_(e))); }
function doPost(e) { return responder_(tratar_(lerPedido_(e))); }

function lerPedido_(e) {
  var p = {};
  try { if (e && e.postData && e.postData.contents) p = JSON.parse(e.postData.contents); } catch (_) {}
  if (e && e.parameter) for (var k in e.parameter) if (!(k in p)) p[k] = e.parameter[k];
  return p;
}
function responder_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function tratar_(p) {
  try {
    if (p.action === "ping") return { ok: true, versao: VERSAO_VENDA, papel: "VENDA" };
    var sess = verificarToken_(p.token);
    if (!sess) return { ok: false, erro: "NAO_AUTORIZADO" };
    if (!temAcessoVendas_(sess)) return { ok: false, erro: "SEM_PERMISSAO" };
    var grava = ["tipoCasa", "lerDocumento", "conferir", "devolver"].indexOf(p.action) >= 0;
    if (grava && String(sess.t || "").toUpperCase() === "TESTES") return { ok: false, erro: "SEM_PERMISSAO_TESTES" };
    var col = colunas_();
    switch (p.action) {
      case "estado":       return estado_(col, p);
      case "tipoCasa":     return tipoCasa_(col, p);
      case "lerDocumento": return lerDocumento_(col, sess, p);
      case "conferir":     return mudarDossie_(col, sess, p, RegrasVenda.ESTADOS.CONFERIDO, "Conferido");
      case "devolver":
        if (!String(p.motivo || "").trim()) return { ok: false, erro: "MOTIVO_OBRIGATORIO" };
        return mudarDossie_(col, sess, p, RegrasVenda.ESTADOS.DEVOLVIDO, "Devolvido: " + String(p.motivo).trim());
      default: return { ok: false, erro: "ACAO_DESCONHECIDA" };
    }
  } catch (err) {
    var m = String((err && err.message) || err);
    console.error("PORTAL-VENDA " + String(p.action || "") + " falhou: " + m.slice(0, 160));
    return { ok: false, erro: ERROS_CONHECIDOS.test(m) ? m : "ERRO_INTERNO" };
  }
}

/* ---- sessão: MESMO algoritmo do assinar_/verificar_ do Code.gs do portal ---- */
function verificarToken_(token) {
  var partes = String(token || "").split(".");
  if (partes.length !== 2) return null;
  var seg = prop_("SESSION_SECRET");
  if (!seg) throw new Error("BACKEND_SEM_CONFIG");
  var esperado = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(partes[0], seg));
  if (esperado !== partes[1]) return null;
  var payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(partes[0])).getDataAsString("UTF-8"));
  } catch (e) { return null; }
  if (payload.exp && Date.now() > payload.exp) return null;
  return payload;
}
function temAcessoVendas_(sess) {
  var t = String(sess.t || "").toUpperCase();
  if (t === "ADM" || t === "MASTER" || t === "TESTES") return true;
  return (sess.a || []).indexOf("VENDAS") >= 0;
}

/* ---- Notion ---- */
function notion_(method, path, body) {
  var opt = { method: method, muteHttpExceptions: true, contentType: "application/json",
              headers: { Authorization: "Bearer " + prop_("NOTION_TOKEN"), "Notion-Version": NOTION_VERSION } };
  if (body) opt.payload = JSON.stringify(body);
  var r = UrlFetchApp.fetch("https://api.notion.com/v1" + path, opt);
  var code = r.getResponseCode(), data = {};
  try { data = JSON.parse(r.getContentText()); } catch (_) {}
  if (code >= 300) throw new Error("NOTION_" + code + ": " + String((data && data.message) || "").slice(0, 120));
  return data;
}

function colunas_() {
  var cache = CacheService.getScriptCache(), k = "venda_schema_v1", txt = cache.get(k), schema;
  if (txt) schema = JSON.parse(txt);
  else {
    var db = notion_("GET", "/databases/" + prop_("DB_VENDAS"), null);
    schema = {};
    for (var nome in db.properties) {
      var pr = db.properties[nome];
      schema[nome] = { tipo: pr.type, opcoes: pr.type === "select" ? (pr.select.options || []).map(function (o) { return o.name; }) : [] };
    }
    cache.put(k, JSON.stringify(schema), 1800);
  }
  var r = RegrasVenda.resolverColunas(schema);
  if (r.faltando.length) { cache.remove(k); throw new Error("COLUNA_FALTANDO: " + r.faltando.join(", ")); }
  if (r.tipoErrado.length) { cache.remove(k); throw new Error("TIPO_DE_COLUNA_ERRADO: " + r.tipoErrado.join(", ")); }
  return { mapa: r.mapa, schema: schema };
}

function valorProp_(pr) {
  if (!pr) return null;
  switch (pr.type) {
    case "title": case "rich_text":
      return (pr[pr.type] || []).map(function (t) { return t.plain_text || (t.text && t.text.content) || ""; }).join("");
    case "number": return pr.number;
    case "select": return pr.select ? pr.select.name : null;
    case "email": return pr.email;
    case "phone_number": return pr.phone_number;
    case "files": return pr.files || [];
    default: return null;
  }
}
function lerPagina_(col, pageId) {
  var pg = notion_("GET", "/pages/" + pageId, null), atuais = {};
  for (var canon in col.mapa) atuais[canon] = valorProp_(pg.properties[col.mapa[canon]]);
  return atuais;
}
function propNotion_(tipo, valor) {
  switch (tipo) {
    case "number": return { number: Number(valor) };
    case "select": return { select: valor ? { name: String(valor) } : null };
    case "email": return { email: String(valor) };
    case "phone_number": return { phone_number: String(valor) };
    default: return { rich_text: [{ type: "text", text: { content: String(valor).slice(0, 1900) } }] };
  }
}
function gravar_(col, pageId, porCanonico) {
  var props = {};
  for (var canon in porCanonico) {
    var real = col.mapa[canon], tipo = col.schema[real].tipo, v = porCanonico[canon];
    if (tipo === "select") v = RegrasVenda.resolverOpcao(col.schema[real].opcoes, v);
    props[real] = propNotion_(tipo, v);
  }
  notion_("PATCH", "/pages/" + pageId, { properties: props });
}
function hoje_(fmt) { return Utilities.formatDate(new Date(), "America/Sao_Paulo", fmt); }

/* ---- ações ---- */
function estado_(col, p) {
  var a = lerPagina_(col, p.pageId), C = RegrasVenda.COL;
  return { ok: true, tipoCasa: a[C.TIPO_CASA] || "", arquivos: RegrasVenda.contarArquivos(a),
           dossie: a[C.DOSSIE] || "", observacao: a[C.OBS] || "", doisCompradores: RegrasVenda.temDoisCompradores(a) };
}
function tipoCasa_(col, p) {
  if (RegrasVenda.TIPOS_CASA.indexOf(p.valor) < 0) return { ok: false, erro: "TIPO_DE_CASA_INVALIDO" };
  var g = {}; g[RegrasVenda.COL.TIPO_CASA] = p.valor;
  gravar_(col, p.pageId, g);
  return { ok: true };
}
function mudarDossie_(col, sess, p, estado, nota) {
  var C = RegrasVenda.COL, a = lerPagina_(col, p.pageId), g = {};
  g[C.DOSSIE] = estado;
  g[C.OBS] = RegrasVenda.juntarObservacoes(a[C.OBS], [nota], hoje_("dd/MM"), sess.u);
  gravar_(col, p.pageId, g);
  return { ok: true };
}

function anexarArquivo_(pageId, colReal, arq) {
  var fu = notion_("POST", "/file_uploads", { filename: arq.nome, content_type: arq.mime });
  var blob = Utilities.newBlob(Utilities.base64Decode(arq.base64), arq.mime, arq.nome);
  var r = UrlFetchApp.fetch(fu.upload_url, { method: "post", muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + prop_("NOTION_TOKEN"), "Notion-Version": NOTION_VERSION }, payload: { file: blob } });
  if (r.getResponseCode() >= 300) throw new Error("UPLOAD_FALHOU");
  var pg = notion_("GET", "/pages/" + pageId, null);
  /* Arquivo já hospedado pelo Notion só continua na coluna se for reenviado
     como {type:"file"} — a API substitui a lista inteira (doc "Page property
     values", seção Files). */
  var lista = ((pg.properties[colReal] || {}).files || []).map(RegrasVenda.manterArquivo);
  lista.push({ type: "file_upload", name: arq.nome, file_upload: { id: fu.id } });
  var props = {}; props[colReal] = { files: lista };
  notion_("PATCH", "/pages/" + pageId, { properties: props });
}
function baixarArquivo_(f) {
  var url = f.type === "external" ? f.external.url : f.file.url;
  var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (r.getResponseCode() >= 300) return null;
  var b = r.getBlob();
  return { mime: RegrasVenda.mimeDoArquivo(f.name, b.getContentType()), base64: Utilities.base64Encode(b.getBytes()) };
}

function lerDocumento_(col, sess, p) {
  var esp = RegrasVenda.ESPACOS[p.espaco];
  if (!esp) return { ok: false, erro: "ESPACO_DESCONHECIDO" };
  var C = RegrasVenda.COL, guardado = false;
  if (p.arquivo) {
    var chk = RegrasVenda.conferirArquivo(p.arquivo);
    if (!chk.ok) return { ok: false, erro: chk.erro, arquivoGuardado: false };
    try { anexarArquivo_(p.pageId, col.mapa[esp.coluna], p.arquivo); guardado = true; }
    catch (e) { console.error("PORTAL-VENDA upload falhou: " + String(e.message || e).slice(0, 120)); return { ok: false, erro: "UPLOAD_FALHOU", arquivoGuardado: false }; }
  }
  var a = lerPagina_(col, p.pageId);
  var arquivos = (a[esp.coluna] || []).slice(-4);
  if (!arquivos.length) return { ok: false, erro: "SEM_ARQUIVO", arquivoGuardado: guardado };
  var partes = [];
  arquivos.forEach(function (f) {
    var b = baixarArquivo_(f);
    if (b && RegrasVenda.conferirArquivo(b).ok) partes.push(b);
  });
  if (!partes.length) return { ok: false, erro: "ARQUIVO_NAO_LEGIVEL", arquivoGuardado: guardado };

  var pedido = ClaudeLeitor.montarPedido(esp.tipo, partes, prop_("ANTHROPIC_API_KEY"));
  if (pedido.erro) return { ok: false, erro: pedido.erro, arquivoGuardado: guardado };
  var res;
  try {
    var r = UrlFetchApp.fetch(pedido.url, { method: "post", contentType: "application/json", muteHttpExceptions: true,
                                           headers: pedido.headers, payload: JSON.stringify(pedido.corpo) });
    res = ClaudeLeitor.interpretarResposta(r.getResponseCode(), r.getContentText());
  } catch (e) { res = { ok: false, erro: "LEITURA_FALHOU" }; }
  if (!res.ok) return { ok: false, erro: res.erro, arquivoGuardado: guardado };
  console.log("PORTAL-VENDA leitura " + p.espaco + " tokens " + res.uso.entrada + "/" + res.uso.saida);

  var plano = RegrasVenda.planejarGravacao(p.espaco, res.leitura, a, hoje_("yyyy-MM-dd"));
  var depois = {};
  for (var k in a) depois[k] = a[k];
  for (var c in plano.props) depois[c] = plano.props[c];
  var est = RegrasVenda.estadoAposLeitura(RegrasVenda.contarArquivos(depois), RegrasVenda.temDoisCompradores(depois));
  var g = {};
  for (var c2 in plano.props) g[c2] = plano.props[c2];
  g[C.DOSSIE] = est.estado;
  if (plano.observacoes.length) g[C.OBS] = RegrasVenda.juntarObservacoes(a[C.OBS], plano.observacoes, hoje_("dd/MM"), sess.u);
  gravar_(col, p.pageId, g);
  return { ok: true, preenchidos: plano.preenchidos, observacoes: plano.observacoes, dossie: est.estado, faltam: est.faltam };
}
