/* app.js · Morais Engenharia — camada comum (sessão + offline + sync) */

const API   = "https://script.google.com/macros/s/AKfycbzYFHAodPoiS79pAqdGVEQmpMcAptrnGLtKoouN4n96L09djHViq467IH1wDLSh2920/exec";

/* ===================== SEGUNDA IMPLANTAÇÃO: ESCRITA (set/26) ==============
 * MEDIDO EM 03/09/2026: dois PROJETOS diferentes do Apps Script, publicados
 * pela mesma conta, executam em paralelo. Um doGet segurando 20 s num projeto
 * não atrasou nada num doGet do outro.
 *
 * Era essa a causa do "quando tem ação simultânea a criação fica
 * comprometida": tudo passava por uma implantação só, e o Apps Script atende
 * uma execução por vez por implantação. Uma criação de 1,4 s ficava atrás de
 * uma leitura de 12 s que a própria tela tinha pedido sozinha.
 *
 * Agora existem duas URLs. A de baixo é do projeto PORTAL-ESCRITA, que roda o
 * MESMO Code.gs com PAPEL = "ESCRITA". Escrita e leitura deixam de disputar a
 * mesma fila, no servidor e aqui no navegador (ver as duas faixas mais
 * abaixo).
 *
 * ENQUANTO A SEGUNDA IMPLANTAÇÃO NÃO EXISTIR, deixe a constante vazia (""):
 * tudo volta a sair pela URL única, exatamente como antes desta mudança.
 * =================================================================== */
const API_ESCRITA = "https://script.google.com/macros/s/AKfycbzYFHAodPoiS79pAqdGVEQmpMcAptrnGLtKoouN4n96L09djHViq467IH1wDLSh2920/exec";

/* Ações que devem sair pela implantação de ESCRITA. Precisa bater com
   ACOES_ESCRITA + ACOES_CRIACAO do Code.gs. Ação nova que grave entra aqui
   também — se esquecer, ela continua funcionando, só que pela fila errada. */
const ACOES_NA_ESCRITA = [
  "baixa", "updateVenda", "criarVenda", "excluirVenda", "distrato", "novaOpcao",
  /* out/26 — prévia e estado do distrato disparam/leem o robô do Mais Controle (GITHUB_TOKEN):
     só a ESCRITA precisa ter o código novo e o token */
  "distratoPrevia", "distratoEstado",
  "upload", "comentarioNovo", "gerarAtividadesGcap",
  "ligUpdate", "ligAnexar", "ligBaixa", "ligVendaUpdate", "ligExcluir", "ligCriar",
  "posObraServicoNovo", "posObraAtvUpdate", "posObraUpdate", "posObraAnexar",
  "posObraRetornoExcluir", "posObraAtvExcluir", "posObraNovo",
  "posObraEndereco",   /* 23/10/26: ADM troca endereço/casa (PosObraEndereco.gs, só na ESCRITA) */
  /* set/26 r2 — simsUnidadeUpdate NAO entra aqui, de proposito.
     Na rodada anterior ela foi movida para a faixa de ESCRITA e o "Salvar
     tudo" passou a devolver NAO_AUTORIZADO: a implantacao de LEITURA
     respondeu normalmente no diagnostico (HTTP 200 + JSON), a de ESCRITA
     recusou a sessao. Enquanto o SESSION_SECRET dos dois projetos nao for
     confirmado identico, a gravacao de unidade sai pela MESMA implantacao
     que ja funciona. Nao mover esta acao sem antes conferir o ping da
     implantacao de escrita. */
  /* opStatus e posObraValidarAdm NÃO gravam, mas acompanham uma criação e
     precisam da mesma faixa livre — perguntar "criou?" na fila das leituras
     seria esperar atrás da leitura que atrapalhou a criação. */
  "opStatus", "posObraValidarAdm",
  /* GESTÃO DE DOCUMENTOS (set/26). Mesma regra: ação que GRAVA sai pela
     implantação de ESCRITA, para não esperar atrás de uma leitura longa.
     Precisa bater com ACOES_DOCS_ESCRITA do documentos.gs. */
  "docUpdate", "docBaixa", "docAnexar", "docNovo", "docExcluir",
  /* OBRAS (23/09/26). As gravações da aba de obras estavam saindo pela
     LEITURA e ficavam atrás do checklist das atividades (a leitura mais pesada
     da tela) — era o "Não salvou: sem conexão" ao trocar o STATUS. Agora saem
     pela ESCRITA. Ficam na LEITURA, de propósito: "obraNova" e "obraLiberar",
     porque é lá que mora o ObrasSync.gs (atividades e Compatibilização).
     obraVivo e obraComentarios não gravam, mas são curtas e acompanham uma
     gravação: não podem esperar atrás do checklist. */
  "obraUpdate", "obraAtvUpdate", "obraAtvCheck", "obraAtvAcao", "obraLigacoes",
  /* 24/09/26: obraComentarios e obraComentarioNovo SAÍRAM daqui — os
     comentários ficam prontos no cache da LEITURA (aquecimento), e o
     comentário novo precisa apagar a cópia no MESMO projeto que a serve. */
  "obraConta", "obraVivo", "investidorUpdate",
  /* anexo das ligações: pedido curto (só assina o link); na fila das
     leituras ele esperava o ligSensiveis inteiro — era o PDF de 2 minutos */
  "ligArquivo"
  /* ===== POR QUE "agendaLink" E "docAgendaLink" SAÍRAM DAQUI (set/26) =====
     Os dois GRAVAM (a chave do link vai numa Propriedade do script), então
     por hábito estavam na faixa de ESCRITA. Só que a chave é gravada num
     projeto e LIDA no outro: as telas sem login (servicos.html do pós obra e
     demandas.html da gestão de documentos) chamam a URL padrão, que é a de
     LEITURA — e Propriedade do script é POR PROJETO.

     Resultado: o link era gerado na ESCRITA, a tela procurava a chave na
     LEITURA, não achava e respondia "Este link não vale mais". Era isso, e
     não link vencido nem falta de publicação.

     Gerar link é raro e rápido; ficar na fila das leituras não custa nada. */

  /* r33: "forcarAtualizacao" NÃO entra aqui, e não é esquecimento. O que ela
     limpa é o cache do CacheService, que é POR PROJETO do Apps Script — limpar
     na implantação de ESCRITA não mexeria em nada do que as telas leem, que
     sai da implantação de LEITURA. Ela precisa sair pela URL padrão. */
];
function ehAcaoDeEscrita(action){ return ACOES_NA_ESCRITA.indexOf(action) >= 0; }
function urlDe(action){
  return (API_ESCRITA && ehAcaoDeEscrita(action)) ? API_ESCRITA : API;
}
const LOGIN = "login.html";
const KEY   = "morais_sessao";
const FILA  = "morais_fila";
/* v2: o formato dos dados mudou (dist/*.json em vez do endpoint do Apps
   Script). Trocar o prefixo descarta o cache antigo em vez de pintar a tela
   com campos que não existem mais — era o "undefined trim." do dashboard. */
const CPRE  = "morais_cache_v2_";

/* ---------- sessão ---------- */
function sessao(){ try{ return JSON.parse(localStorage.getItem(KEY)||sessionStorage.getItem(KEY)||"null"); }catch(e){ return null; } }
function sair(){ localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); location.href = LOGIN; }
/* 01/10/26 — SESSÃO VENCIDA. O token vale 30 dias a partir do login, mas a leitura vem do dist/
   (sem passar pelo servidor): quem só olhava nunca percebia que tinha vencido, e a primeira gravação
   voltava "sessão expirada". Agora: (1) o servidor devolve um token novo (tokenNovo) faltando menos
   de 15 dias e esta tela troca sozinha; (2) token já vencido manda direto para o login, em vez de
   deixar a pessoa preencher e perder. */
function tokenExp(tok){
  try{
    const p=String(tok||"").split(".")[0]; if(!p) return 0;
    const b=p.replace(/-/g,"+").replace(/_/g,"/"); const pad=b+"===".slice((b.length+3)%4);
    const txt=decodeURIComponent(Array.prototype.map.call(atob(pad),c=>"%"+("00"+c.charCodeAt(0).toString(16)).slice(-2)).join(""));
    return Number(JSON.parse(txt).exp)||0;
  }catch(e){ return 0; }
}
function sessaoVencida(s){ const e=tokenExp(s&&s.token); return !!(e && Date.now()>e); }
function atualizarToken(novo){
  if(!novo) return;
  [localStorage, sessionStorage].forEach(st=>{
    try{ const raw=st.getItem(KEY); if(!raw) return; const o=JSON.parse(raw); if(o&&o.token){ o.token=novo; st.setItem(KEY, JSON.stringify(o)); } }catch(e){}
  });
}
/* Guarda onde a pessoa estava para o login devolvê-la ao mesmo lugar (só caminho
   do próprio site, terminando em .html, nunca o próprio login). */
function guardarVolta(){
  try{
    const p=location.pathname;
    if(!/\.html$/i.test(p) || /(^|\/)login\.html$/i.test(p)) return;
    sessionStorage.setItem("morais_volta", p+location.search+location.hash);
  }catch(e){}
}
function irParaLogin(){ guardarVolta(); localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); location.href=LOGIN; }
/* 20/11/26 — sessão vencida com a pessoa digitando: em vez de redirecionar em 3,5 s
   (e perder o texto sem aviso), a página avisa e só vai para o login no clique.
   A volta ao mesmo lugar já é guardada por irParaLogin(). */
let _avisoSessao=false;
function _avisarSessaoVencida(){
  if(_avisoSessao) return; _avisoSessao=true;
  const ir=()=>irParaLogin();
  if(typeof window.moraisPerguntar!=="function"){ setTimeout(ir,3500); return; }
  window.moraisPerguntar({titulo:"Sua sessão venceu",
    texto:"Sua sessão venceu. Copie o que estiver digitando antes de continuar — o que não foi salvo se perde.",
    sim:"Entrar de novo", nao:""}).then(ir,ir);
}
function exigirSessao(){ const s=sessao(); if(!s||!s.token||sessaoVencida(s)){ irParaLogin(); } return s; }
/* MASTER vê TODOS os sistemas do hub (Vendas etc.), como o ADM — é um perfil
   de diretor. O que ele não pode é MEXER: não edita endereço nem dá baixa em
   atividade (ver ehMaster no vendas.html). GERAL continua limitado ao que
   estiver na coluna ACESSOS do LOGINS.

   TESTES: perfil de conferência. Enxerga tudo, como o ADM, e a coluna ACESSOS
   pode ficar vazia — é justamente pra dar a volta na tela inteira. O que ele
   NÃO faz é gravar: os campos abrem normalmente (a ideia é ver o que apareceria
   como editável para cada perfil), mas o Apps Script recusa toda escrita com
   MODO_TESTE. A trava de verdade é lá no servidor; aqui é só o aviso. */
const TIPOS_VEEM_TUDO = ["ADM","MASTER","TESTES"];
function tipoDe(s){ return String((s&&s.tipo)||"").toUpperCase(); }
function podeAcessar(s, chave){
  if(!s) return false;
  /* 25/09/26: compara sem acento, caixa e espaço sobrando — uma opção
     "OBRAS " (com espaço) na coluna ACESSOS escondia o botão sem aviso */
  const nz=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ").trim();
  return TIPOS_VEEM_TUDO.indexOf(tipoDe(s))>=0 || (s.acessos||[]).some(a=>nz(a)===nz(chave));
}
/* ---------- ACESSO NOVO QUE NÃO CHEGAVA NA TELA (set/26) ----------
 * A sessão gravada no navegador (tipo + ACESSOS) era escrita UMA VEZ, no
 * login, e nunca mais. O servidor até relia os acessos frescos do Notion a
 * cada chamada (acessosFrescos_ no Code.gs), mas essa lista atualizada era
 * jogada fora: quem desenha os botões do hub é o podeAcessar() aqui, que lê
 * a cópia CONGELADA do localStorage.
 *
 * Resultado: marcar "RAS OBRAS" (ou qualquer acesso novo) na coluna ACESSOS
 * do banco LOGINS não fazia efeito nenhum para quem já estava logado — e sem
 * erro nenhum na tela, o que fazia parecer erro no nome da opção. O botão só
 * aparecia depois de SAIR e ENTRAR de novo, ou quando o token expirava.
 *
 * Esta função grava por cima o que o servidor acabou de dizer na ação "me".
 * Mantém o token (o servidor não devolve um novo) e grava no MESMO lugar em
 * que a sessão já estava — localStorage se a pessoa marcou "manter conectado",
 * sessionStorage se não. `alvo` é o objeto que a tela guardou em memória
 * (o S das páginas): sem ele, a gravação só valeria no próximo F5.
 * Devolve true quando tipo ou acessos realmente mudaram — é o sinal para a
 * tela se repintar. */
function atualizarSessaoLocal(nova, alvo){
  if(!nova) return false;
  const atual = sessao();
  if(!atual || !atual.token) return false;
  const antes  = JSON.stringify([String(atual.tipo||""), (atual.acessos||[]).slice().sort()]);
  const depois = JSON.stringify([String(nova.tipo ||""), (nova.acessos ||[]).slice().sort()]);
  if(antes === depois) return false;
  const merge = Object.assign({}, atual, nova, { token: atual.token });
  const onde = localStorage.getItem(KEY) ? localStorage : sessionStorage;
  try{ onde.setItem(KEY, JSON.stringify(merge)); }catch(e){ /* cheio: segue com a cópia em memória */ }
  if(alvo) Object.assign(alvo, merge);
  return true;
}

/* Perfil que só olha. Usado pelas telas pra mostrar a tarja de aviso e para
   dar uma mensagem clara em vez de deixar o usuário achando que salvou. */
function ehSomenteLeitura(s){ return tipoDe(s)==="TESTES"; }

/* ---------- cache de dados (para leitura offline) ----------
 * FALHA QUE ESTAVA AQUI (set/26): o catch vazio engolia o estouro de cota do
 * localStorage. O celular enchia (o dist/pos_obra.json e as páginas de obra
 * são grandes), toda gravação passava a falhar em silêncio e NINGUÉM ficava
 * sabendo — até a hora em que a FILA DE ENVIOS também não coube mais e o
 * usuário viu "a fila de envios offline está cheia" no meio de criar um
 * serviço. Era esse o print do erro.
 *
 * Agora, ao estourar, o cache de LEITURA é podado (ele é descartável — dá
 * para rebaixar do servidor) e a gravação é tentada de novo. A fila de
 * escritas nunca é podada: ela é a única coisa aqui que não dá para
 * recuperar de lugar nenhum. */
function cacheSet(k,v){
  const texto = JSON.stringify({t:Date.now(), v:v});
  try{ localStorage.setItem(CPRE+k, texto); return true; }
  catch(e){
    podarCache(CPRE+k);
    try{ localStorage.setItem(CPRE+k, texto); return true; }
    catch(e2){ console.warn("cache: não coube nem depois da poda —", k); return false; }
  }
}
function cacheGet(k){ try{ return JSON.parse(localStorage.getItem(CPRE+k)); }catch(e){ return null; } }

/* Joga fora as cópias de leitura mais VELHAS até liberar espaço. Nunca
   encosta na FILA nem na sessão. "menos a chave que estou gravando agora",
   senão a poda apagaria justamente o que se quer guardar. */
function podarCache(exceto){
  const itens = [];
  for(let i=0;i<localStorage.length;i++){
    const k = localStorage.key(i);
    if(!k || k.indexOf(CPRE)!==0 || k===exceto) continue;
    let t = 0;
    try{ t = (JSON.parse(localStorage.getItem(k))||{}).t || 0; }catch(e){}
    itens.push({k:k, t:t});
  }
  itens.sort((a,b)=>a.t-b.t);                 // mais velho primeiro
  const quantos = Math.max(1, Math.ceil(itens.length/2));
  for(let i=0;i<quantos;i++){ try{ localStorage.removeItem(itens[i].k); }catch(e){} }
  console.warn("cache: podei "+quantos+" cópias antigas para abrir espaço.");
}

/* ---------- fila offline (escritas pendentes) ---------- */
function fila(){ try{ return JSON.parse(localStorage.getItem(FILA)||"[]"); }catch(e){ return []; } }
function filaSet(a){
  try{ localStorage.setItem(FILA, JSON.stringify(a)); return true; }
  catch(e){
    /* A fila é a última coisa que pode ficar sem espaço: perder um item aqui
       é perder uma gravação que a pessoa acha que fez. Antes de desistir,
       abre espaço jogando fora cópias de LEITURA, que são recuperáveis. */
    podarCache(null);
    try{ localStorage.setItem(FILA, JSON.stringify(a)); return true; }
    catch(e2){ return false; }
  }
}
function enfileirar(item){ const a=fila(); a.push(item); const ok=filaSet(a); atualizarBadge(); return ok; }

/* ---------- LEITURA ESTÁTICA (dist/*.json publicado pelo GitHub Actions) ----------
   É o caminho rápido: arquivo pronto, sem esperar o Apps Script paginar o Notion.
   Só as ESCRITAS continuam indo pro Apps Script. */
async function lerEstatico(arquivo, chaveCache){
  try{
    // cache-busting leve: o Pages serve com cache agressivo e seguraria dado velho
    const r=await fetch("dist/"+arquivo+"?v="+Math.floor(Date.now()/60000), {cache:"no-cache"});
    if(!r.ok) throw new Error("HTTP "+r.status);
    const j=await r.json();
    if(chaveCache) cacheSet(chaveCache, j);
    return Object.assign({online:true}, j);
  }catch(e){
    if(chaveCache){ const c=cacheGet(chaveCache); if(c) return Object.assign({online:false,offline:true,_ts:c.t}, c.v); }
    return { online:navigator.onLine, ok:false, erro: navigator.onLine ? "SEM_DADOS_PUBLICADOS" : "OFFLINE_SEM_CACHE" };
  }
}

/* ---------- LEITURA ESTÁTICA "instantânea" (stale-while-revalidate) ----------
   Pinta NA HORA com a última cópia salva no localStorage (0 ms, sem rede) e
   repinta sozinha quando o dist/ chegar. É isto que tira o "Carregando…".
   `pintar` é chamada 1x (só rede, primeiro acesso) ou 2x (cache e depois rede).
   Devolve a resposta da REDE, pra quem precisar esperar o dado definitivo. */
function lerEstaticoJa(arquivo, chaveCache, pintar){
  if(chaveCache && typeof pintar==="function"){
    const c=cacheGet(chaveCache);
    if(c) { try{ pintar(Object.assign({online:navigator.onLine, doCache:true, _ts:c.t}, c.v)); }catch(e){} }
  }
  return lerEstatico(arquivo, chaveCache).then(r=>{
    if(typeof pintar==="function"){ try{ pintar(r); }catch(e){} }
    return r;
  });
}

/* ===================== FILA DE REQUISIÇÕES AO APPS SCRIPT =====================
 * CAUSA DA LENTIDÃO E DAS FALHAS (set/26): o Apps Script publicado como
 * "Executar como: Eu" atende as requisições de TODO MUNDO como se fossem do
 * mesmo usuário — e o Google enfileira execuções simultâneas do mesmo usuário.
 * Abrir uma tela que dispara 5 chamadas de uma vez não deixa o carregamento
 * 5x mais rápido: deixa 5 execuções empilhadas, cada uma esperando a
 * anterior, e as do fim da fila estouram o tempo (era o "Em execução" que
 * ficava aparecendo na tela de Execuções).
 *
 * Aqui a fila passa a ser explícita e do lado do NAVEGADOR: no máximo
 * MAX_SIMULTANEAS pedidos em voo. O tempo total é o mesmo (o servidor já
 * serializava), mas nada mais estoura o tempo e a ordem fica previsível.
 * =================================================================== */
/* DUAS FAIXAS (set/26). Antes existia UMA fila com MAX_SIMULTANEAS = 1 e um
   "prioritário" que dava unshift. Isso nunca resolveu o caso real: a leitura
   que já estava EM VOO há 8 s não é cancelada por ninguém, então a criação
   entrava na frente da fila e mesmo assim esperava.
   Agora são duas filas independentes, uma por implantação. Cada uma continua
   com uma requisição por vez (o Apps Script serializa por implantação mesmo),
   mas leitura e escrita não se enxergam. */
/* 22/10/26 — MEDIDO AO VIVO: 4 chamadas juntas na implantação de LEITURA
   terminaram em 2,7–3,6 s; UMA sozinha leva 2,3–2,7 s. O servidor atende em
   paralelo; quem empilhava era esta fila (Ligações abria com 3 chamadas em
   fila ≈ 7 s). A LEITURA passa a ter 4 em voo. A ESCRITA continua curta (o
   rf-rotas.js a deixa em 2) para gravações do mesmo campo não trocarem de ordem. */
const _faixas = {
  leitura: { max: 4, emVoo: 0, fila: [] },
  escrita: { max: 1, emVoo: 0, fila: [] }
};
/* Sem a segunda implantação configurada, as duas faixas apontariam para a
   MESMA URL — e aí duas requisições em voo voltariam a se atrapalhar no
   servidor. Neste caso tudo volta a andar numa faixa só. */
function faixaDe(action){
  if(!API_ESCRITA) return _faixas.leitura;
  return ehAcaoDeEscrita(action) ? _faixas.escrita : _faixas.leitura;
}
function _proximoDaFaixa(f){
  if(f.emVoo >= f.max || !f.fila.length) return;
  f.emVoo++;
  const tarefa = f.fila.shift();
  tarefa().then(
    v => { f.emVoo--; _proximoDaFaixa(f); return v; },
    e => { f.emVoo--; _proximoDaFaixa(f); throw e; }
  );
}
/* PRIORIDADE (set/26) — criação fura a fila.
 * Só existe UMA requisição em voo (MAX_SIMULTANEAS=1), porque o Apps Script
 * serializa tudo mesmo. A consequência é que uma criação clicada no meio de
 * uma revalidação automática ficava atrás dela e podia estourar o tempo por
 * culpa de uma leitura que ninguém pediu. Agora quem cria entra na FRENTE:
 * não torna o servidor mais rápido, mas garante que a ação da pessoa não
 * espera trabalho de fundo. Leitura continua entrando pelo fim. */
function _enfileirarPedido(fn, prioritario, action){
  const f = faixaDe(action);
  return new Promise((ok, falha)=>{
    const tarefa = ()=> fn().then(ok, falha);
    if(prioritario) f.fila.unshift(tarefa); else f.fila.push(tarefa);
    _proximoDaFaixa(f);
  });
}

/* ---------- chamada crua ao backend (lança em erro de rede ou timeout) ---------- */
async function chamar(payload, timeoutMs, prioritario){
  return _enfileirarPedido(()=>_chamarDireto(payload, timeoutMs), prioritario, payload && payload.action);
}
async function _chamarDireto(payload, timeoutMs){
  const s=sessao(); if(s&&s.token&&!payload.token) payload.token=s.token;
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(), timeoutMs||45000); // evita "Carregando…" travado pra sempre
  /* 25/09/26 — O Google às vezes devolve uma PÁGINA DE ERRO (HTML, 404 na
     etapa "echo") em vez da resposta, mesmo com a execução concluída — é
     intermitente: repetido na hora, responde normal. Antes isso virava "não
     consegui falar com o servidor" e a gravação ia parar na fila. Agora a
     leitura e a gravação de campo (que dá no mesmo se repetir) são refeitas
     sozinhas até 2 vezes. Ação que NÃO pode repetir (criar, enviar e-mail,
     comentar, gerar link/PDF) continua falhando na primeira, como antes. */
  const acao=String((payload&&payload.action)||"");
  const repetivel=!/(Novo|Nova|Criar|criar|Email|Enviar|Acao|Ligacoes|Link|Pdf|Distrato|distrato|Refazer|Setup|aixa|pload|Anexar|xcluir|Liberar)/.test(acao);
  try{
    for(let tent=0;;tent++){
      const r=await fetch(urlDe(acao),{ method:"POST", headers:{ "Content-Type":"text/plain;charset=utf-8" }, body:JSON.stringify(payload), signal:ctrl.signal });
      const txt=await r.text();
      try{ const obj=JSON.parse(txt); if(obj&&obj.tokenNovo) atualizarToken(obj.tokenNovo); return obj; }
      catch(e){
        if(!repetivel||tent>=2) throw new Error("RESPOSTA_INVALIDA ("+r.status+")");
        await new Promise(ok=>setTimeout(ok, tent?1500:700));
      }
    }
  } finally { clearTimeout(timer); }
}

/* ---------- DEDUPE: dois pedidos iguais em voo viram um só ----------
   Duas partes da tela pedindo a mesma coisa ao mesmo tempo (o calendário e a
   lista pedindo a agenda, por exemplo) gastavam duas execuções do Apps
   Script para trazer exatamente o mesmo JSON. Agora a segunda espera na
   promessa da primeira. Vale só para LEITURA — escrita nunca é deduplicada. */
const _pedidosEmVoo = new Map();
function _assinatura(payload){
  const c = Object.assign({}, payload); delete c.token;
  return JSON.stringify(c);
}

/* ---------- LEITURA com cache (online → salva cache; offline → usa cache) ---------- */
async function ler(payload, chaveCache){
  const chave = _assinatura(payload);
  if(_pedidosEmVoo.has(chave)) return _pedidosEmVoo.get(chave);
  const pr = (async ()=>{
    try{
      const r=await chamar(payload);
      if(r && r.ok && chaveCache) cacheSet(chaveCache, r);
      return Object.assign({ online:true }, r);
    }catch(e){
      if(chaveCache){ const c=cacheGet(chaveCache); if(c) return Object.assign({ online:false, offline:true, _ts:c.t }, c.v); }
      // distingue "sem internet de verdade" de "API não respondeu/erro/timeout" — ajuda a diagnosticar
      const motivo = navigator.onLine ? (e && e.name==="AbortError" ? "TEMPO_ESGOTADO" : "ERRO_API") : "OFFLINE_SEM_CACHE";
      return { online:false, ok:false, erro:motivo };
    } finally {
      _pedidosEmVoo.delete(chave);
    }
  })();
  _pedidosEmVoo.set(chave, pr);
  return pr;
}

/* ===================== STORE DE SESSÃO (carrega 1x, revalida sozinho) ======
 * É o que você pediu: os dados são carregados uma vez, ficam guardados
 * enquanto a pessoa navega pelas abas (sem NENHUMA chamada nova ao servidor)
 * e são recarregados sozinhos de tempos em tempos.
 *
 * Diferença para o cacheGet/cacheSet que já existia: aquele é uma cópia de
 * segurança para funcionar offline — a tela pintava com ele e MESMO ASSIM
 * pedia tudo de novo ao servidor. Aqui o pedido só sai quando o dado está
 * VELHO (passou do ttl). Trocar de aba, voltar pro hub, abrir e fechar uma
 * obra: zero requisição.
 *
 * Quem chama passa `pintar`, que roda com o dado do cache na hora e de novo
 * quando a rede trouxer coisa nova — a tela nunca fica em branco esperando.
 * =================================================================== */
const STORE_PRE = "morais_store_v1_";
const STORE_TTL_PADRAO = 10*60*1000;    // 10 min: o "a cada x minutos"
const _storeMem = new Map();            // evita reler/reparsear o localStorage
const _storeReg = new Map();            // o que precisa ser revalidado sozinho

function storeLer(chave){
  if(_storeMem.has(chave)) return _storeMem.get(chave);
  try{
    const o=JSON.parse(localStorage.getItem(STORE_PRE+chave)||"null");
    if(o && o.v){ _storeMem.set(chave,o); return o; }
  }catch(e){}
  return null;
}
function storeGravar(chave, valor){
  const o={t:Date.now(), v:valor};
  _storeMem.set(chave,o);
  /* localStorage tem ~5 MB no total. Se estourar, o dado continua valendo em
     MEMÓRIA (a navegação entre abas segue instantânea), mas se perde ao
     recarregar a página — e aí a tela busca de novo. Quando isso acontecer
     o aviso aparece no console, para não virar um mistério silencioso:
     é o sinal de que a resposta daquela ação precisa ser enxugada no
     Code.gs, e não de que o cache "não está funcionando". */
  try{ localStorage.setItem(STORE_PRE+chave, JSON.stringify(o)); }
  catch(e){ console.warn("[store] \""+chave+"\" nao coube no localStorage — vale so nesta aba.", e && e.name); }
  return o;
}
/* Depois de GRAVAR alguma coisa: derruba o que ficou velho para o próximo
   lerStore ir buscar de verdade, em vez de repintar o estado anterior. */
function storeInvalidar(){
  for(const chave of arguments){
    _storeMem.delete(chave);
    try{ localStorage.removeItem(STORE_PRE+chave); }catch(e){}
  }
}
function storeIdade(chave){ const c=storeLer(chave); return c ? Date.now()-c.t : null; }

/* opts: { ttl, pintar, forcar } */
async function lerStore(payload, chave, opts){
  opts = opts || {};
  const ttl = opts.ttl || STORE_TTL_PADRAO;
  /* Só entra na revalidação automática quem tem `pintar` — ou seja, quem tem
     onde mostrar o dado novo. Sem esta condição, chaves de consulta pontual
     (o detalhe de um grupo de obras, por exemplo) iam se acumulando e a
     revalidação passaria a buscar dezenas delas de dez em dez minutos,
     recriando o empilhamento que estamos justamente tirando do caminho. */
  if(typeof opts.pintar==="function") _storeReg.set(chave, { payload:payload, ttl:ttl, pintar:opts.pintar });

  const cache = storeLer(chave);
  if(cache && typeof opts.pintar==="function"){
    try{ opts.pintar(Object.assign({ doCache:true, _ts:cache.t }, cache.v)); }catch(e){}
  }
  const fresco = cache && (Date.now()-cache.t) < ttl;
  if(fresco && !opts.forcar) return Object.assign({ doCache:true, _ts:cache.t }, cache.v);

  const r = await ler(payload);
  if(r && r.ok){
    storeGravar(chave, r);
    if(typeof opts.pintar==="function"){ try{ opts.pintar(r); }catch(e){} }
    return r;
  }
  /* Falhou e existe cópia: devolve a cópia marcada como velha, em vez de
     apagar a tela. "SESSÃO EXPIRADA" por causa de um soluço do servidor era
     justamente o que derrubava a pessoa pro login sem motivo. */
  /* set/26 — a cópia velha continua sendo devolvida (a tela não apaga), mas
     agora leva JUNTO o motivo da falha. Antes o erro sumia aqui: a tela
     mostrava "Do cache" de um dia atrás e ninguém sabia que o servidor estava
     recusando (foi o caso das Simulações em 23/09). */
  if(cache) return Object.assign({ doCache:true, velho:true, _ts:cache.t,
                                   erroAoVivo:(r && r.erro) || "SEM_RESPOSTA" }, cache.v);
  return r;
}

/* Revalidação automática: roda de minuto em minuto, mas só busca o que já
   passou do ttl. Uma coisa de cada vez, para não recriar o empilhamento. */
let _revalidando = false;
async function revalidarStore(){
  /* _criando > 0 significa que alguém está criando um registro AGORA. Enquanto
     isso, nada de trabalho de fundo: cada leitura nossa é uma execução a mais
     na fila do Apps Script disputando com a criação. */
  if(_revalidando || _criando > 0 || !navigator.onLine || document.hidden) return;
  _revalidando = true;
  try{
    for(const [chave, reg] of _storeReg){
      const c = storeLer(chave);
      if(c && (Date.now()-c.t) < reg.ttl) continue;
      await lerStore(reg.payload, chave, { ttl:reg.ttl, pintar:reg.pintar, forcar:true });
    }
  } finally { _revalidando = false; }
}
setInterval(revalidarStore, 60000);
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) revalidarStore(); });

/* ---------- ESCRITA com fila (tenta agora; senão enfileira) ----------
 * IDEMPOTÊNCIA (set/26) — a correção do "serviço em looping de criação".
 *
 * O Apps Script é POST -> 302 -> GET: ele EXECUTA (grava no Notion) e só
 * depois o navegador busca o resultado. Se a rede engasgar nesse meio, ou se
 * bater o timeout de 45 s do chamar(), a gravação ACONTECEU e esta função
 * cai no catch achando que falhou. Aí o item entra na fila e o sincronizar()
 * reenvia o MESMO payload — e, numa ação de criar, cada reenvio criava outra
 * página. Era o looping infinito.
 *
 * Agora toda escrita carrega um opId: um identificador da OPERAÇÃO, gerado
 * UMA vez aqui e preservado em todos os reenvios daquele mesmo item. O
 * backend lembra o que já fez com aquele opId e devolve o mesmo resultado em
 * vez de gravar de novo (ver opIdLer_/opIdGravar_ no Code.gs).
 *
 * Repare que o opId nasce ANTES da primeira tentativa e vai junto para a
 * fila. Gerar um novo a cada reenvio não resolveria nada — seria o mesmo
 * bug com outro nome. */
function novoOpId(){
  return Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,10);
}

/* Erros que significam "o servidor engasgou", NUNCA "seu pedido foi recusado".
   Quem cai aqui merece nova tentativa ou conferência por opId, jamais uma
   mensagem de erro definitiva na cara da pessoa.
   NAO_AUTORIZADO entra nesta lista de propósito: o token dura 30 dias e é HMAC
   puro, então ele não vence no meio do expediente. Um NAO_AUTORIZADO durante
   o uso normal é quase sempre falha interna do backend, não sessão vencida
   (ver verificar_ / _SESSAO_ERRO_ no Code.gs r32). Se for expiração real, o
   opStatus vai responder a mesma coisa e a criação termina em
   FALHOU_SEM_CRIAR, que é honesto: nada foi criado. */
const ERROS_TRANSITORIOS = ["NAO_AUTORIZADO", "BACKEND_OCUPADO", "BACKEND_SEM_CONFIG",
                            "TEMPO_ESGOTADO", "ERRO_API"];
/* Ações que NUNCA entram na fila offline — são as CRIAÇÕES de registro novo.
 *
 * POR QUÊ: enfileirar uma criação é o pior dos mundos. Se o pedido falhou
 * depois de o servidor já ter criado, o item fica na fila prometendo criar
 * algo que já existe; e se ninguém drenar a fila, ele fica pendurado para
 * sempre e a tela mente dizendo "vai ser criado quando a conexão voltar".
 *
 * Estas ações são TRATADAS COMO PRIORITÁRIAS: furam a fila do navegador,
 * pausam a revalidação de fundo, esperam mais tempo e, se a resposta se
 * perder, conferem pelo opId em vez de chutar. */
const SEM_FILA = ["posObraServicoNovo", "posObraNovo", "ligCriar", "criarVenda"];

/* Quantas criações estão em andamento (segura a revalidação de fundo). */
let _criando = 0;
const _pausa = ms => new Promise(r => setTimeout(r, ms));

/* ===================== CRIAÇÃO PROTEGIDA (set/26) =========================
 * Regra desta função: NUNCA declarar "não criou" sem ter perguntado ao
 * servidor, e NUNCA criar duas vezes. As duas garantias vêm do mesmo lugar —
 * o opId, gerado uma vez e repetido em toda tentativa.
 *
 * Sequência:
 *   1. envia (90 s de paciência — abortar antes não cancela nada no servidor,
 *      só faz a tela achar que falhou uma gravação que está acontecendo);
 *   2. se a resposta se perdeu, pergunta pelo opId de 5 em 5 s, por até 90 s.
 *      O servidor responde uma de TRÊS coisas: criou (devolve o registro),
 *      está criando (esperamos), ou nada consta;
 *   3. "nada consta" com o servidor respondendo bem = a execução não chegou a
 *      começar. Aí sim reenvia — o mesmo opId torna isso seguro, porque se
 *      tiver criado no meio tempo o backend devolve o registro existente em
 *      vez de criar outro.
 * =================================================================== */
async function criarProtegido(payload){
  _criando++;
  try{
    for(let tentativa = 0; tentativa < 2; tentativa++){
      let bruto = null;
      try{
        bruto = await chamar(payload, 90000, true);   // true = fura a fila
      }catch(e){ /* timeout ou rede: cai na conferência */ }

      if(bruto && bruto.ok)   return { ok:true, enviado:true, resposta:bruto };
      /* BURACO QUE ISTO FECHA (set/26): antes QUALQUER erro saía aqui, sem
         nunca consultar o opStatus. Um NAO_AUTORIZADO transitório (soluço do
         PropertiesService no servidor) abortava a criação e a tela dizia
         "sessão expirada" — com o chamado JÁ criado no Notion. Era o "cria no
         banco e se perde no sistema".
         Erro transitório NÃO é recusa: ele agora cai na conferência por opId,
         igual ao timeout. Só recusa lógica de verdade sai daqui. */
      if(bruto && bruto.erro && !ERROS_TRANSITORIOS.includes(bruto.erro))
        return { ok:false, erro:bruto.erro, resposta:bruto };

      let nadaConsta = false;
      /* r33: a primeira conferência sai em 2 s, não em 5. Com a tela já
         desenhada (registro otimista no pos-obra.html), quem espera aqui é só
         o acerto do id — quanto antes ele chegar, antes o chamado fica
         editável. */
      for(let i = 0; i < 20; i++){                    // ~2 s + 19 x 4 s
        await _pausa(i === 0 ? 2000 : 4000);
        let c = null;
        try{ c = await chamar({ action:"opStatus", opId: payload.opId }, 15000, true); }
        catch(e){ continue; }                          // sem resposta: insiste
        if(c && c.ok && c.achado && c.resultado)
          return { ok:true, enviado:true, recuperado:true, resposta:c.resultado };
        if(c && c.ok && c.andando) continue;           // está criando: espera
        if(c && c.ok){ nadaConsta = true; break; }     // servidor respondeu: não começou
        /* c.ok false com erro transitório: o servidor engasgou na CONFERÊNCIA,
           não na criação. Insistir é a única resposta certa — declarar
           "não criou" aqui é exatamente o que fazia a tela mentir. */
      }
      if(!nadaConsta) break;                           // servidor mudo: não reenvia às cegas
    }
    return { ok:false, erro:"FALHOU_SEM_CRIAR" };
  } finally { _criando--; }
}

/* 08/10/26 — CONFERÊNCIA DA SESSÃO ANTES DE DESLOGAR
 * Um NAO_AUTORIZADO isolado no meio de várias gravações não prova que o token
 * venceu (o token dura 30 dias; ver ERROS_TRANSITORIOS). Esta função pergunta
 * "quem sou eu?" (ação "me") na MESMA implantação que recusou, fora da fila
 * das faixas, até 3 vezes com pausa. Só devolve false (= sessão inválida de
 * verdade) quando o token já venceu no relógio ou o servidor recusar duas
 * vezes seguidas. Na dúvida (rede caiu, servidor ocupado), NÃO desloga.
 * Várias gravações falhando juntas dividem a MESMA conferência. */
let _confSessao = null;
function confirmarSessao(action){
  if(_confSessao) return _confSessao;
  _confSessao = (async ()=>{
    const s = sessao();
    if(!s || !s.token || sessaoVencida(s)) return false;
    let recusas = 0;
    for(let t=0; t<3; t++){
      if(t) await new Promise(ok=>setTimeout(ok, 2500*t));
      const ctrl = new AbortController(), timer = setTimeout(()=>ctrl.abort(), 25000);
      try{
        const resp = await fetch(urlDe(action||"me"), { method:"POST", headers:{ "Content-Type":"text/plain;charset=utf-8" },
                                 body:JSON.stringify({ action:"me", token:(sessao()||s).token }), signal:ctrl.signal });
        const o = JSON.parse(await resp.text());
        if(o && o.ok) return true;
        if(o && o.erro==="NAO_AUTORIZADO"){ if(++recusas>=2) return false; }
        else recusas = 0;
      }catch(e){ /* página de erro do Google / rede: não conta como recusa */ }
      finally{ clearTimeout(timer); }
    }
    return true;
  })();
  const p = _confSessao;
  p.finally(()=>setTimeout(()=>{ if(_confSessao===p) _confSessao=null; }, 20000));
  return p;
}

/* 13/10/26 — GRAVAÇÃO EM SEGUNDO PLANO (sair da página não perde mais nada)
 * O caso: na aba Obras a pessoa trocou o Liberar de várias obras e saiu da
 * página. Ao voltar, estavam "Não" de novo. Motivo: o pedido só ia para a
 * fila GUARDADA (localStorage) depois de FALHAR. Enquanto esperava a vez na
 * fila do navegador (uma por vez, e o Liberar demora porque cria as
 * atividades), ele vivia só na memória da página — fechar ou trocar de página
 * jogava fora. E 3 min depois a leitura ao vivo do Notion (ainda "Não")
 * derrubava o valor da tela.
 * Agora as ações de "gravar valor num campo" são guardadas na fila ANTES de
 * sair e só saem dela quando o servidor confirma. Se a página fechar no meio,
 * a próxima página aberta (qualquer uma do portal) termina o envio sozinha, e
 * a tela continua mostrando o valor novo enquanto ele estiver na fila.
 * Só entram aqui ações que dá para repetir sem estrago (gravar o mesmo valor
 * de novo; o Liberar confere se as atividades já existem antes de criar). */
const GRAVA_ANTES = ["obraUpdate", "obraLiberar", "obraConta", "obraAtvUpdate",
                     "updateVenda", "docUpdate", "posObraUpdate", "posObraAtvUpdate",
                     /* 05/11/26 — FALTAVAM as Ligações (e investidores). Eram as
                        únicas gravações de campo que ainda viviam só na memória
                        enquanto esperavam a vez: no CELULAR, travar a tela ou
                        trocar de app (WhatsApp) no meio do envio jogava a
                        gravação fora, e a edição local continuava mostrando o
                        valor novo SÓ naquele aparelho — no Notion e para os
                        outros ficava o antigo ("SANESC APROVADA? = NÃO"). */
                     "ligUpdate", "ligVendaUpdate", "investidorUpdate"];
const _emVooFila = new Set();          // itens da fila que ESTA página está enviando agora
function _chaveCampo(q){
  q = q || {};
  return [q.action, String(q.pageId||"").replace(/-/g,""), q.prop || q.campo || (q.conta!==undefined ? "#conta" : "")].join("|");
}
function _guardarAntes(payload, rotulo){
  if(GRAVA_ANTES.indexOf(payload.action) < 0) return null;
  if(payload.admSenha || payload.senha) return null;        // senha nunca vai para o localStorage
  const id = Date.now()+"_"+Math.random().toString(36).slice(2,7);
  const chave = _chaveCampo(payload);
  /* edição mais nova do MESMO campo substitui a antiga que ainda não saiu */
  const a = fila().filter(it => !(it && it.payload && _chaveCampo(it.payload)===chave && !_emVooFila.has(it.id)));
  a.push({ id:id, payload:payload, rotulo:rotulo||payload.action, ts:Date.now() });
  if(!filaSet(a)) return null;
  _emVooFila.add(id);
  atualizarBadge();
  return id;
}
function _tirarDaFila(id){
  if(!id) return;
  _emVooFila.delete(id);
  filaSet(fila().filter(it => it && it.id !== id));
  atualizarBadge();
}

async function escrever(payload, rotulo){
  if(!payload.opId) payload.opId = novoOpId();

  if(SEM_FILA.indexOf(payload.action) >= 0) return criarProtegido(payload);

  const guardado = _guardarAntes(payload, rotulo);
  if(guardado){
    try{ return await _escreverGuardado(payload, guardado); }
    finally{ _emVooFila.delete(guardado); }
  }

  if(navigator.onLine){
    try{
      const r=await chamar(payload);
      // "resposta" leva o corpo devolvido pelo backend. Sem isto, quem chama
      // escrever() só sabe que deu certo — e algumas ações precisam do que
      // veio junto (ex.: a baixa cruzada das ligações informa qual obra foi
      // marcada como TRANSFERIDO, ou que não achou o endereço).
      if(r && r.ok) return { ok:true, enviado:true, resposta:r };
      /* Rejeição lógica (SEM_PERMISSAO, OPCAO_INEXISTENTE, DOMINGO_BLOQUEADO):
         enfileirar não adianta, a fila bateria na mesma recusa pra sempre. */
      if(r && r.erro && !ERROS_TRANSITORIOS.includes(r.erro)) return { ok:false, erro:r.erro };
      /* Sessão realmente inválida também não vira "salvo": a pessoa precisa
         relogar, e a fila só empurraria o problema. */
      /* 08/10/26 — antes daqui saía direto para o login. Com várias edições
         seguidas (Atividades: conteúdo, checklist, campos), UMA resposta
         NAO_AUTORIZADO perdida no meio da rajada derrubava a pessoa, mesmo com
         o token valendo. Agora a sessão é CONFERIDA antes (ver
         confirmarSessao): só desloga se o servidor recusar o token de novo,
         com calma. Se a sessão estiver boa, a gravação vai para a fila e sobe
         sozinha, como os outros soluços do servidor. */
      if(r && r.erro==="NAO_AUTORIZADO"){
        const valida = await confirmarSessao(payload.action);
        if(!valida){ _avisarSessaoVencida(); return { ok:false, erro:"NAO_AUTORIZADO" }; }
      }
      /* BACKEND_OCUPADO / BACKEND_SEM_CONFIG: o servidor engasgou, a gravação
         é válida. Cai pra fila e sobe sozinha depois. */
      // resposta estranha (sem ok e sem erro): cai pra fila
    }catch(e){ /* rede caiu: enfileira */ }
  }
  const ok=enfileirar({ id:Date.now()+"_"+Math.random().toString(36).slice(2,7), payload:payload, rotulo:rotulo||payload.action, ts:Date.now() });
  if(!ok) return { ok:false, erro:"FILA_CHEIA" };
  return { ok:true, enfileirado:true };
}

/* caminho da gravação já guardada na fila (ver GRAVA_ANTES) */
async function _escreverGuardado(payload, id){
  if(!navigator.onLine) return { ok:true, enfileirado:true };
  let r;
  try{ r = await chamar(payload); }
  catch(e){ return { ok:true, enfileirado:true }; }          // rede caiu: fica na fila e sobe sozinha
  if(r && r.ok){ _tirarDaFila(id); return { ok:true, enviado:true, resposta:r }; }
  if(r && r.erro && !ERROS_TRANSITORIOS.includes(r.erro)){ _tirarDaFila(id); return { ok:false, erro:r.erro }; }
  if(r && r.erro==="NAO_AUTORIZADO"){
    const valida = await confirmarSessao(payload.action);
    if(!valida){ _tirarDaFila(id); _avisarSessaoVencida(); return { ok:false, erro:"NAO_AUTORIZADO" }; }
  }
  return { ok:true, enfileirado:true };                      // servidor engasgou: fica na fila
}

/* ---------- SINCRONIZAÇÃO da fila ---------- */
let _sinc=false;
async function sincronizar(){
  if(_sinc || !navigator.onLine) return;
  _sinc=true;
  let feitos=[], saiu=0;   // saiu: itens que deixaram a fila (gravados OU recusados de vez)
  try{
    /* 13/10/26: anda pelos itens por id (a fila agora também recebe itens da
       gravação em segundo plano enquanto esta rodada acontece) e pula o que
       esta própria página já está enviando, para não mandar duas vezes */
    const tentados=new Set();
    for(;;){
      const item=fila().find(it=>it && !tentados.has(it.id) && !_emVooFila.has(it.id));
      if(!item) break;
      tentados.add(item.id);
      _emVooFila.add(item.id);
      try{
        const r=await chamar(item.payload);
        /* BURACO QUE ISTO FECHA: até aqui a resposta do reenvio era jogada
           fora — a fila só olhava se deu ok. Quem criou um serviço sem sinal
           ficava sem saber o ID do chamado que acabou de nascer, então a tela
           não conseguia desenhá-lo e a pessoa via "criou no banco mas não
           aparece na página" até o próximo build. Agora o que voltou é
           entregue para a tela decidir o que fazer. */
        if(r && r.ok) feitos.push({ payload:item.payload, resposta:r });
        /* BACKEND_SEM_CONFIG é o servidor engasgado (SESSION_SECRET
           indisponível na execução), não uma recusa da gravação. Descartar o
           item aqui perderia a escrita de vez; melhor parar e tentar depois,
           igual ao NAO_AUTORIZADO. */
        const transitorio = r && r.erro && (r.erro==="NAO_AUTORIZADO" || r.erro==="BACKEND_SEM_CONFIG");
        if(r && (r.ok || (r.erro && !transitorio))){ _emVooFila.delete(item.id); _tirarDaFila(item.id); saiu++; }
        else { _emVooFila.delete(item.id); break; }
      }catch(e){ _emVooFila.delete(item.id); break; }        // rede caiu de novo → para
    }
  } finally {
    _sinc=false; atualizarBadge();
    /* 22/10/26 — só avisa a tela quando algum item SAIU da fila (gravou ou foi recusado). Antes rodava a cada
       tentativa, mesmo com o item preso na fila: em Ligações isso rebaixava o
       ligacoes.json (1,3 MB), redesenhava tudo e forçava a leitura ao vivo a
       cada 20–30 s (146 chamadas "ligacoes" de uma pessoa só, numa hora). */
    if(saiu && typeof window.aoSincronizar==="function") window.aoSincronizar(feitos);
  }
}

/* ---------- indicadores de status/fila (se existirem no HTML) ---------- */
function atualizarBadge(){
  const el=document.getElementById("fila-badge"); if(!el) return;
  const n=fila().length; el.textContent=n; el.style.display=n?"inline-flex":"none";
  const b=document.getElementById("btn-sync"); if(b) b.style.display=n?"inline-flex":"none";
}
function atualizarStatus(){
  const el=document.getElementById("net-status"); if(!el) return;
  const on=navigator.onLine; el.textContent=on?"online":"offline"; el.className="net "+(on?"on":"off");
}
window.addEventListener("online",  ()=>{ atualizarStatus(); sincronizar(); });
/* A fila era drenada SÓ no evento "online" (ou no botão ↻). Um pedido que
   estoura o tempo com a internet funcionando nunca dispara esse evento, então
   o item ficava parado indefinidamente. Estas duas linhas cobrem o buraco:
   tenta de tempos em tempos e ao voltar para a aba. Só faz algo quando há
   fila (ver tentarSincronizar). */
/* 22/10/26: o setInterval de 30 s e o visibilitychange que ficavam aqui eram
   duplicata dos de baixo (20 s) — a fila era tentada nos dois ritmos. */
window.addEventListener("offline", atualizarStatus);

/* CAUSA DO "PREENCHI E SUMIU DE NOVO": quando a chamada ao Apps Script falha
   uma vez (tempo esgotado, oscilação, aba em segundo plano), o item vai pra
   fila e escrever() devolve ok — a pessoa vê "salvo". Só que o reenvio
   dependia do evento "online", que só dispara se o navegador tiver ficado
   OFFLINE. Estando online o tempo todo, o evento nunca vinha: a fila ficava
   parada pra sempre, o Notion nunca recebia a data e cada publicação do site
   apagava o que tinha sido digitado. Daí o ciclo de preencher de novo.
   Agora a fila é reenviada sozinha: ao abrir a página, a cada 20 s enquanto
   houver item, e toda vez que a aba volta pro primeiro plano. */
function tentarSincronizar(){ if(fila().length) sincronizar(); }
setInterval(tentarSincronizar, 20000);

/* ===================== 05/11/26 — CELULAR =====================
 * Dois buracos que só aparecem no toque (relato de quem preenche pelo
 * celular: "às vezes não salva"):
 *  1) DATA que grava ao SAIR do campo (onblur — feito assim para o
 *     computador, onde o "change" avisa com o ano pela metade enquanto a
 *     pessoa digita). No celular a data vem pronta do seletor, mas o campo
 *     continua com o foco: se a pessoa fecha o painel arrastando, trava a
 *     tela ou troca de app, o blur nunca vem e a data não é enviada.
 *     Agora, no toque, escolher a data já encerra o campo (e grava).
 *     Só type="date": no datetime-local o iPhone escolhe dia e hora em dois
 *     passos — fechar no primeiro cortaria a hora (e lá já grava no change).
 *  2) TEXTO digitado (observação, UC) só grava no "change", que só vem ao
 *     sair do campo. Trocar de app com o teclado aberto perdia o texto.
 *     Agora, ao a página ir para segundo plano, o campo em edição é
 *     encerrado: o change dispara e a gravação vai para a fila guardada
 *     (GRAVA_ANTES) antes de o celular congelar a página. */
(function(){
  const toque = () => { try{ return matchMedia("(pointer: coarse)").matches; }catch(e){ return false; } };
  document.addEventListener("change", e => {
    const el = e.target;
    if(!toque() || !el || el.tagName !== "INPUT" || el.type !== "date" || !el.value) return;
    setTimeout(() => { if(document.activeElement === el) el.blur(); }, 0);   // depois dos onchange da própria tela
  }, true);
  const encerrarCampo = () => {
    if(!toque()) return;
    const el = document.activeElement;
    if(!el || el === document.body) return;
    const t = el.tagName;
    if(t === "INPUT" || t === "TEXTAREA" || t === "SELECT"){ try{ el.blur(); }catch(err){} }
  };
  document.addEventListener("visibilitychange", () => { if(document.hidden) encerrarCampo(); });
  window.addEventListener("pagehide", encerrarCampo);
})();
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) tentarSincronizar(); });
window.addEventListener("load", tentarSincronizar);
/* renova a sessão em segundo plano quando faltar menos de 15 dias (ver tokenExp) */
window.addEventListener("load", ()=>{
  setTimeout(()=>{
    const s=sessao(); if(!s||!s.token||!navigator.onLine) return;
    const e=tokenExp(s.token); if(!e || e-Date.now() > 15*24*3600*1000) return;
    if(Date.now()>e){ return; }
    try{ chamar({ action:"renovarSessao" }, 30000).catch(()=>{}); }catch(err){}
  }, 4000);
});

/* Tem escrita esperando envio? Enquanto tiver, nenhuma edição local pode ser
   descartada por tempo — ela ainda não chegou ao Notion, então o arquivo
   publicado vir sem ela não significa nada (ver aplicarEdicoesLocais). */
function filaPendente(){ return fila().length > 0; }

/* ---------- textos de erro amigáveis ---------- */
const ERROS_TEXTO = {
  OFFLINE_SEM_CACHE: "sem internet e sem dados salvos ainda",
  SEM_DADOS_PUBLICADOS: "os dados ainda não chegaram — tente de novo em alguns minutos; se continuar, avise o suporte",
  ERRO_API: "não consegui falar com o servidor — confira sua internet e tente de novo",
  TEMPO_ESGOTADO: "o servidor demorou demais pra responder — tente de novo",
  NAO_AUTORIZADO: "sua sessão venceu — abrindo o login para você entrar de novo (o que não foi salvo se perde)",
  /* devolvido quando o Apps Script não conseguiu ler as Propriedades do
     script (acontece sob concorrência). NÃO é sessão expirada — a tela não
     deve deslogar ninguém por causa disso. */
  BACKEND_SEM_CONFIG: "o servidor está sobrecarregado — tente de novo em alguns segundos",
  BACKEND_OCUPADO: "o servidor está ocupado — tente de novo em alguns segundos",
  /* devolvidos pelo Code.gs quando a ação existe mas o perfil não pode */
  MODO_TESTE: "modo teste — este login só visualiza, nada é gravado",
  SEM_PERMISSAO: "seu login não tem permissão para esta ação",
  APENAS_ADM: "só um ADM pode fazer isso",
  MASTER_NAO_EDITA_ENDERECO: "o perfil MASTER não edita o endereço",
  /* cadastro de opção nova (corretor, tipo de serviço, responsável) — antes
     estes códigos apareciam crus na tela, e ninguém entendia o que fazer */
  SEM_VIRGULA: "o nome não pode ter vírgula (o Notion separa opções por vírgula)",
  NOME_MUITO_LONGO: "o nome passou de 60 caracteres",
  CAMPO_NAO_LIBERADO: "esta coluna não aceita cadastro de item novo pelo site",
  CAMPO_INEXISTENTE: "esta coluna não existe mais no Notion",
  CAMPO_NAO_EDITAVEL: "esta coluna é calculada pelo Notion — não dá para gravar",
  TIPO_NAO_SUPORTA_OPCAO: "só colunas do tipo Seleção aceitam item novo",
  STATUS_NAO_ACEITA_NOVA_OPCAO: "coluna do tipo Status é fechada — crie a opção no próprio Notion",
  OPCAO_INEXISTENTE: "essa opção não existe na coluna",
  BASE_DESCONHECIDA: "erro interno: base não reconhecida pelo servidor",
  USE_UPLOAD_PARA_ARQUIVOS: "use o botão de anexar para colunas de arquivo",
  SEM_PAGINA: "erro interno: a tela não informou qual registro gravar",
  FALTA_PARAM: "erro interno: faltou informação na chamada",
  FILA_CHEIA: "a fila de envios offline está cheia — reconecte para esvaziar",
  // MELHORIAS item 7: chamado com SERVIÇO FINALIZADO só o ADM reescreve
  CHAMADO_FINALIZADO: "este chamado está FINALIZADO — só um ADM pode alterá-lo. "
    + "Para reabrir, mude o ANDAMENTO DA SOLICITAÇÃO"
};
function erroTexto(codigo){
  if(!codigo) return "erro desconhecido";
  if(ERROS_TEXTO[codigo]) return ERROS_TEXTO[codigo];
  /* o backend às vezes devolve o código com um detalhe colado
     ("APENAS_ADM: RESPONSÁVEL", "CAMPO_NAO_LIBERADO: OBRA") — sem isto a tela
     mostrava o código cru, que não diz nada pra quem está usando */
  const i=String(codigo).indexOf(":");
  if(i>0){
    const base=String(codigo).slice(0,i).trim(), det=String(codigo).slice(i+1).trim();
    if(ERROS_TEXTO[base]) return ERROS_TEXTO[base]+(det?" ("+det+")":"");
  }
  /* código sem tradução: não mostrar o código cru sozinho. Só embrulha o que
     parece código (MAIÚSCULAS_COM_UNDERLINE); texto já legível passa como veio. */
  if(/^[A-Z0-9_ÁÀÂÃÉÊÍÓÔÕÚÇ ]+(:.*)?$/.test(String(codigo)) && /[A-Z]{3}/.test(String(codigo)))
    return "Algo deu errado (código "+codigo+"). Tente de novo; se continuar, avise o suporte.";
  return codigo;
}

/* ---------- TELEFONE BRASILEIRO ----------
   O Notion devolve o número como a pessoa digitou: "62993636381", "62 99363
   6381", "+5562993636381". Na tela isso virava uma tira de dígitos ilegível.
   fmtTel normaliza para (DDD) XXXXX-XXXX (celular, 11 dígitos) ou
   (DDD) XXXX-XXXX (fixo, 10 dígitos).

   Regras de borda que importam:
   - "+55" / "0055" na frente é código do país e é descartado antes de contar
     os dígitos, senão 5562993636381 (13) não casaria com nenhum formato;
   - "0" de operadora na frente (0xx) também sai;
   - o que NÃO for 10 nem 11 dígitos volta como veio. Número estrangeiro,
     ramal ou campo com anotação ("62 99363-6381 (recado)") não pode ser
     mutilado só porque não coube na máscara — melhor exibir o original. */
function telDigitos(v){
  let d = String(v==null?"":v).replace(/\D/g,"");
  if(d.length > 11 && d.indexOf("00") === 0) d = d.slice(2);   // 00 + país
  if(d.length > 11 && d.indexOf("55") === 0) d = d.slice(2);   // +55
  if(d.length === 11 && d.charAt(0) === "0") d = d.slice(1);   // 0 de operadora
  if(d.length === 12 && d.charAt(0) === "0") d = d.slice(1);
  return d;
}
function fmtTel(v){
  if(v == null || v === "") return "";
  const d = telDigitos(v);
  if(d.length === 11) return "(" + d.slice(0,2) + ") " + d.slice(2,7) + "-" + d.slice(7);
  if(d.length === 10) return "(" + d.slice(0,2) + ") " + d.slice(2,6) + "-" + d.slice(6);
  return String(v);   // não reconhecido: devolve como está, sem estragar
}
/* Só os dígitos, para href="tel:" e para o WhatsApp (que exige o 55). */
function telLink(v){
  const d = telDigitos(v);
  return d ? "+55" + d : String(v||"").replace(/[^\d+]/g,"");
}

/* ---------- utilidades ---------- */
const brl = n => (Number(n)||0).toLocaleString("pt-BR",{ style:"currency", currency:"BRL", maximumFractionDigits:0 });
const num = n => (Number(n)||0).toLocaleString("pt-BR");
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c])); }
/* ---------- DINHEIRO EM REAIS (máscara ao digitar) ----------
   O bug: o campo era <input type="number"> e a pessoa digitava "350000"
   esperando R$ 350.000,00. Quando o valor era colado ou digitado com ponto
   ("350.000"), o navegador lia o ponto como separador DECIMAL e gravava 350
   no Notion — daí o "R$ 350,00".
   Solução: campo de TEXTO com máscara visível. Regra combinada:
     - o ponto de milhar entra sozinho enquanto digita;
     - centavos só se a pessoa escrever a vírgula: 350000,25 -> R$ 350.000,25.
   O que vai pro Notion é sempre número puro (moedaParse). */
const MOEDA_FRAG = ["VALOR","VGV","COMISS","AVALIA","PRECO","PREÇO","CUSTO",
                    "ENTRADA","SUBSIDIO","SUBSÍDIO","FGTS","SALDO","TOTAL",
                    "PARCELA","FINANCIAMENT","RECURSO","TAXA","GCAP","ITBI","MULTA"];
/* Coluna de dinheiro? Só faz sentido para colunas numéricas — uma coluna de
   texto chamada "OBS. VALOR" não deve virar campo de moeda. */
function ehColunaMoeda(nome, tipo){
  if(tipo && tipo!=="number") return false;
  const n=String(nome||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
  return MOEDA_FRAG.some(f=>n.indexOf(f.normalize("NFD").replace(/[\u0300-\u036f]/g,""))>=0);
}
/* Número -> "R$ 350.000,00" (para mostrar). Vazio continua vazio: forçar
   "R$ 0,00" num campo em branco faria a pessoa gravar zero sem querer. */
function moedaFormatar(v){
  if(v===null||v===undefined||v==="") return "";
  const n=Number(v); if(isNaN(n)) return "";
  return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:2,maximumFractionDigits:2});
}
/* Texto digitado -> número. Aceita o que a pessoa escrever: "350000",
   "350.000", "R$ 350.000,25", "350000,25". A VÍRGULA é o decimal; ponto é
   sempre milhar (é assim que se escreve dinheiro em português). */
function moedaParse(txt){
  if(txt===null||txt===undefined) return null;
  let s=String(txt).replace(/[^\d,.-]/g,"").trim();
  if(!s) return null;
  const neg = s.indexOf("-")===0;
  s=s.replace(/-/g,"");
  const iv=s.lastIndexOf(",");
  if(iv>=0){ s=s.slice(0,iv).replace(/[.,]/g,"")+"."+s.slice(iv+1).replace(/[^\d]/g,""); }
  else{ s=s.replace(/\./g,""); }
  const n=parseFloat(s);
  if(isNaN(n)) return null;
  return neg?-n:n;
}
/* Máscara enquanto digita: põe o ponto de milhar na parte inteira e deixa a
   vírgula (e o que vier depois dela) como a pessoa escreveu — sem isso, o
   cursor pularia e não daria pra digitar os centavos. */
function moedaMascara(txt){
  let s=String(txt==null?"":txt).replace(/[^\d,]/g,"");
  if(!s) return "";
  const iv=s.indexOf(",");
  let inteiro = iv<0 ? s : s.slice(0,iv);
  let dec     = iv<0 ? null : s.slice(iv+1).replace(/,/g,"").slice(0,2);
  inteiro=inteiro.replace(/^0+(?=\d)/,"");
  const milhar=inteiro.replace(/\B(?=(\d{3})+(?!\d))/g,".");
  return "R$ "+(milhar||"0")+(dec===null?"":","+dec);
}
/* Liga a máscara num <input> já criado. Devolve o próprio input. */
function ligarMascaraMoeda(el){
  if(!el||el.dataset.moeda==="1") return el;
  el.dataset.moeda="1";
  el.setAttribute("inputmode","decimal");
  el.addEventListener("input",()=>{
    const fim = el.selectionStart===el.value.length;
    el.value=moedaMascara(el.value);
    if(fim){ try{ el.setSelectionRange(el.value.length,el.value.length); }catch(e){} }
  });
  el.addEventListener("blur",()=>{
    const n=moedaParse(el.value);
    el.value = n===null?"":moedaFormatar(n);
  });
  return el;
}

/* ---------- "última atualização" (todas as páginas) ----------
   Preenche qualquer elemento com id="updated" ou classe .updated. Recebe o
   updated_at publicado no dist/*.json; quando não vier, mostra a hora local
   e avisa que é a hora da leitura, não a da publicação. */
function pintarAtualizado(updatedAt, offline, tsCache){
  const alvos=[];
  const byId=document.getElementById("updated"); if(byId) alvos.push(byId);
  document.querySelectorAll(".updated").forEach(el=>{ if(alvos.indexOf(el)<0) alvos.push(el); });
  if(!alvos.length) return;
  const d=dataPublicacao(updatedAt) || (tsCache?new Date(tsCache):null);
  let txt;
  if(offline && tsCache) txt="Sem internet — últimos dados salvos em "+new Date(tsCache).toLocaleString("pt-BR");
  else if(d)             txt="Última atualização: "+d.toLocaleString("pt-BR");
  else                   txt="Última atualização: "+new Date().toLocaleString("pt-BR")+" (hora desta consulta)";
  alvos.forEach(el=>{ el.textContent=txt; });
}

/* Carimbo automático, em TODA página que tenha um elemento #updated ou .updated.
   POR QUE ISTO EXISTE: antes cada tela carimbava a hora dentro da sua própria
   rotina de pintura — e essas rotinas nem sempre rodam. No vendas.html, por
   exemplo, a hora só era escrita dentro de carregarPlanilha(), então quem
   ficasse na tela inicial (cards de setor) nunca via hora nenhuma.
   Aqui a hora vem do dist/updated.json, que o fetch_vendas.py grava em toda
   publicação e é minúsculo. Roda uma vez ao abrir, independente de qual
   view está aberta. Quem tiver dado mais específico depois sobrescreve — é o
   mesmo instante do mesmo build, então não conflita. */
async function carimbarAtualizacao(){
  if(!document.getElementById("updated") && !document.querySelector(".updated")) return;
  try{
    const r=await fetch("dist/updated.json?v="+Math.floor(Date.now()/60000),{cache:"no-cache"});
    if(!r.ok) throw new Error("HTTP "+r.status);
    const j=await r.json();
    cacheSet("updated", j);
    pintarAtualizado(j.updated_at, false, null);
  }catch(e){
    // sem rede: mostra a última que foi vista, em vez de ficar em branco
    const c=cacheGet("updated");
    if(c && c.v && c.v.updated_at) pintarAtualizado(c.v.updated_at, true, c.t);
    else pintarAtualizado(null, false, null);
  }
}
window.addEventListener("load", carimbarAtualizacao);

/* lookup tolerante (nomes do Notion às vezes têm espaço no fim, ex.: "CPF ") */
function getV(obj, nome){
  if(obj[nome]!==undefined) return obj[nome];
  const alvo=nome.trim().toUpperCase();
  for(const k in obj){ if(k.trim().toUpperCase()===alvo) return obj[k]; }
  return undefined;
}
/* grava no MESMO nome de chave que já existe (não cria chave duplicada com espaço) */
function setV(obj, nome, valor){
  if(obj[nome]!==undefined){ obj[nome]=valor; return; }
  const alvo=nome.trim().toUpperCase();
  for(const k in obj){ if(k.trim().toUpperCase()===alvo){ obj[k]=valor; return; } }
  obj[nome]=valor;
}

/* ---------- EDIÇÕES LOCAIS (o que você acabou de salvar) ----------
   PROBLEMA QUE ISTO RESOLVE: as telas pintam a partir do dist/*.json, que só
   é regerado quando o workflow roda. A escrita vai pro Notion na hora, mas o
   arquivo publicado continua com o valor ANTIGO até a próxima publicação.
   As páginas atualizavam só a cópia em memória — então bastava recarregar a
   página (ou voltar pra ela pela navegação, ou a pintura da rede chegar
   depois da pintura do cache) pra o valor digitado sumir da tela e parecer
   que não tinha salvo. Era exatamente o caso das DATAS da aba de ligações,
   mas valia pra QUALQUER campo editável (UC, status, observação, responsável).

   Aqui o que foi salvo fica guardado no localStorage e é reaplicado por cima
   de toda cópia nova que chegar do dist/, até uma destas coisas acontecer:
     - o arquivo publicado já vier com aquele valor (o Notion assumiu);
     - o arquivo tiver sido publicado DEPOIS da edição e vier diferente
       (alguém mudou no Notion, ou a escrita foi recusada) — o Notion manda;
     - passar o prazo de segurança (EDITS_TTL).
   Ou seja: é uma ponte para cobrir a janela entre salvar e republicar, não
   um banco paralelo. */
const EDITS       = "morais_edits_v1";
const EDITS_TTL   = 24*3600*1000;     // teto de segurança: 24 h (era 7 dias; ver "DADOS GUARDADOS")
const EDITS_FOLGA = 3*60*1000;        // publicação só "vence" a edição 3 min depois

/* O fetch_vendas.py grava updated_at em UTC SEM o "Z" ("2026-08-25T13:04:00").
   String de data-hora sem fuso é lida pelo JS como hora LOCAL: em UTC-3 a
   publicação vinha 3 h no futuro, o que sozinho já descartaria toda edição
   feita nas últimas 3 h. Por isso o "Z" é acrescentado quando falta. */
function tsPublicacao(iso){
  if(!iso) return 0;
  const s = String(iso).trim();
  const t = Date.parse(/(Z|[+\-]\d{2}:?\d{2})$/.test(s) ? s : s+"Z");
  return isNaN(t) ? 0 : t;
}
/* Mesma correção para exibir "Atualizado em ..." na tela. */
function dataPublicacao(iso){ const t=tsPublicacao(iso); return t?new Date(t):null; }

let _EDITS=null;
function edicoes(){
  if(_EDITS) return _EDITS;
  try{ _EDITS=JSON.parse(localStorage.getItem(EDITS)||"{}"); }catch(e){ _EDITS={}; }
  return _EDITS;
}
function edicoesGravar(o){ _EDITS=o; _EDITS_IDX=null; try{ localStorage.setItem(EDITS, JSON.stringify(o)); }catch(e){} }
// outra aba do mesmo navegador salvou: joga fora a cópia em memória
window.addEventListener("storage", e => { if(e.key===EDITS){ _EDITS=null; _EDITS_IDX=null; } });

/* Índice base+linha -> edições daquela linha. Existe por causa da LEITURA:
   getL() consulta as edições a cada célula, filtro e cálculo — varrer o mapa
   inteiro toda vez custaria caro numa tabela de centenas de linhas. */
let _EDITS_IDX=null;
function _indiceEdicoes(){
  if(_EDITS_IDX) return _EDITS_IDX;
  const o=edicoes(), idx={};
  for(const k in o){
    const e=o[k]; if(!e||!e.id) continue;
    const ch=e.b+"\u0001"+e.id;
    (idx[ch]=idx[ch]||[]).push(e);
  }
  _EDITS_IDX=idx; return idx;
}

/* Edição pendente de UMA coluna de UMA linha, ou undefined.
   `norm` é opcional: quando vem, o nome da coluna é comparado normalizado
   (sem acento/caixa/espaço sobrando). Isso é essencial porque quem GRAVA usa
   o nome do schema e quem LÊ costuma usar o nome fixo no código da tela —
   as duas grafias precisam casar. Devolve o registro inteiro (e.v é o valor)
   pra dar pra distinguir "não tem edição" de "edição com valor vazio". */
function edicaoLocal(base,pageId,prop,norm){
  if(!pageId||!prop) return undefined;
  const lista=_indiceEdicoes()[base+"\u0001"+pageId];
  if(!lista) return undefined;
  for(let i=0;i<lista.length;i++) if(lista[i].p===prop) return lista[i];
  if(typeof norm==="function"){
    const alvo=norm(prop);
    for(let i=0;i<lista.length;i++) if(norm(lista[i].p)===alvo) return lista[i];
  }
  return undefined;
}

function chaveEdicao(base,pageId,prop){ return base+"\u0001"+pageId+"\u0001"+prop; }

/* Chamar SEMPRE com o nome REAL da coluna (o do schema), o mesmo que vai pro
   Apps Script — senão a reaplicação erra a coluna. */
function registrarEdicao(base,pageId,prop,valor){
  if(!pageId||!prop) return;
  const o=edicoes();
  o[chaveEdicao(base,pageId,prop)]={b:base,id:pageId,p:prop,v:valor,ts:Date.now()};
  edicoesGravar(o);
}
/* Servidor recusou: a edição não existe: tirar da ponte, senão a tela ficaria
   mostrando pra sempre um valor que o Notion nunca aceitou. */
function esquecerEdicao(base,pageId,prop){
  const o=edicoes(), k=chaveEdicao(base,pageId,prop);
  if(o[k]!==undefined){ delete o[k]; edicoesGravar(o); }
}
function temEdicaoLocal(base,pageId,prop){ return edicoes()[chaveEdicao(base,pageId,prop)]!==undefined; }

/* Comparação tolerante: data do Notion às vezes volta com hora
   ("2026-08-25T00:00:00.000-03:00") e vazio ora é "", ora null. */
function _valEdicao(v){
  if(v===undefined||v===null) return "";
  if(Array.isArray(v)) return v.map(x=>String(x==null?"":x)).join("|");
  if(typeof v==="number") return String(v);
  if(typeof v==="boolean") return v?"SIM":"";
  const s=String(v);
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? s.slice(0,10) : s.trim();
}
function iguaisEdicao(a,b){ return _valEdicao(a)===_valEdicao(b); }

/* Aplica (e faz a faxina) das edições de uma base sobre a cópia recém-chegada.
     base      -> "ligacoes" | "vendas" (a mesma string usada ao registrar)
     updatedAt -> updated_at do JSON publicado
     ler(id,prop)          -> valor publicado; undefined = a linha não está
                              nesta tela (ex.: edição de vendas numa cópia só
                              de ligações) — nesse caso não mexe nem apaga
     gravar(id,prop,valor) -> escreve o valor na linha em memória
   Devolve quantas edições continuaram valendo. */
function aplicarEdicoesLocais(base, updatedAt, ler, gravar){
  const pub=tsPublicacao(updatedAt), agora=Date.now();
  const o=edicoes(); let mudou=false, aplicadas=0;
  for(const k in o){
    const e=o[k];
    if(!e||e.b!==base) continue;
    if(agora-e.ts>EDITS_TTL){ delete o[k]; mudou=true; continue; }
    const publicado=ler(e.id,e.p);
    if(publicado===undefined) continue;                       // linha não está aqui
    if(iguaisEdicao(publicado,e.v)){ delete o[k]; mudou=true; continue; }   // já publicou
    // publicou depois e veio diferente -> o Notion mandou. MENOS se ainda
    // houver escrita na fila: nesse caso o valor sequer chegou ao Notion, e
    // descartar aqui apagaria da tela um trabalho que ainda vai ser enviado.
    if(pub && pub>e.ts+EDITS_FOLGA && !filaPendente()){ delete o[k]; mudou=true; continue; }
    gravar(e.id,e.p,e.v); aplicadas++;
  }
  if(mudou) edicoesGravar(o);
  return aplicadas;
}

/* =======================================================================
 * 24/09/26 — DADOS GUARDADOS NO NAVEGADOR NÃO FICAM VELHOS
 * -----------------------------------------------------------------------
 * O portal guarda cópias no localStorage para abrir rápido e funcionar sem
 * sinal: cache das leituras (morais_cache_v2_*), store de sessão
 * (morais_store_v1_*), edições ainda não publicadas (morais_edits_v1),
 * conteúdo das atividades e lista de contas (obras_*). Isso é bom, mas não
 * pode sobreviver a uma atualização do sistema nem a uma troca de usuário.
 * Três regras, todas automáticas:
 *
 *  1. VERSÃO DOS DADOS. Quando DADOS_VERSAO muda (sobe junto com mudanças de
 *     formato/regra), tudo que é cópia é apagado na primeira abertura. Ficam
 *     só a sessão (não desloga ninguém) e a fila de gravações pendentes (é
 *     trabalho de alguém que ainda vai subir).
 *  2. TROCA DE USUÁRIO / SAIR. Ao sair, as cópias vão embora junto — o
 *     próximo que usar o navegador não herda dados do anterior.
 *  3. IDADE MÁXIMA. Cópia com mais de 24 h é apagada, mesmo sem versão nova.
 *     Edição local (a "ponte" entre salvar e o Notion publicar) vale no
 *     máximo 24 h — antes eram 7 dias.
 *
 * E um botão de emergência: limparDadosLocais() (também no console) apaga
 * todas as cópias e recarrega. As telas mostram o atalho Ctrl+Shift+L.
 * ===================================================================== */
const DADOS_VERSAO = "2026-09-24a";
const _PREFIXOS_COPIA = ["morais_cache_", "morais_store_", "obras_cont_", "obras_contas_", "obras_coms_", "morais_edits_"];
function _ehCopia(k){ return _PREFIXOS_COPIA.some(p=>k.indexOf(p)===0); }
/* 28/09/26 — CÓPIAS DO PAINEL QUE NÃO SOMEM
 * Medido: ao entrar de manhã (cópia com mais de 24 h), depois do "Recarregar"
 * ou de sair e entrar, o painel abria SEM Mural, SEM aniversários e com
 * "Nenhuma atividade" até o Apps Script responder — parecia quebrado.
 *   - DA EMPRESA (iguais para todos): aniversários e Mural. Nunca são
 *     apagadas; a tela pinta com elas e troca quando o servidor responde.
 *   - DA PESSOA (atividades, sino): sobrevivem ao "Recarregar" e à faxina
 *     de 24 h (a tela sempre relê do servidor por cima), mas saem no "Sair" —
 *     outra pessoa pode entrar no mesmo computador. */
const _COPIAS_EMPRESA = ["morais_cache_v2_aniversariantes","morais_cache_v2_atv_mural"];
const _COPIAS_PESSOA  = ["morais_cache_v2_atv_minhas","morais_cache_v2_atv_outras","morais_cache_v2_atv_alertas","morais_cache_v2_atv_cks","morais_cache_v2_atv_modelos"];
function _copiaFica(k, saindo){ return _COPIAS_EMPRESA.indexOf(k)>=0 || (!saindo && _COPIAS_PESSOA.indexOf(k)>=0); }
function limparDadosLocais(recarregar, saindo){
  try{
    const ks=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&_ehCopia(k)&&!_copiaFica(k,saindo)) ks.push(k); }
    ks.forEach(k=>localStorage.removeItem(k));
  }catch(e){}
  try{ if(typeof _storeMem!=="undefined") _storeMem.clear(); }catch(e){}
  try{ _EDITS=null; _EDITS_IDX=null; }catch(e){}
  try{ if(window.caches) caches.keys().then(ks=>ks.filter(k=>k.indexOf("portal-morais-")===0).forEach(k=>caches.delete(k))); }catch(e){}
  if(recarregar!==false) location.reload();
}
(function faxina(){
  try{
    if(localStorage.getItem("morais_dados_versao")!==DADOS_VERSAO){
      limparDadosLocais(false);
      localStorage.setItem("morais_dados_versao",DADOS_VERSAO);
      return;
    }
    const lim=Date.now()-24*3600*1000;
    for(let i=localStorage.length-1;i>=0;i--){
      const k=localStorage.key(i); if(!k||!_ehCopia(k)||k==="morais_edits_v1"||_copiaFica(k,false)) continue;
      let t=0; try{ const o=JSON.parse(localStorage.getItem(k)); t=(o&&(o.t||o.ts))||0; }catch(e){}
      if(t&&t<lim) localStorage.removeItem(k);
    }
    const ed=JSON.parse(localStorage.getItem("morais_edits_v1")||"{}"); let mudou=false;
    for(const k in ed){ if(!ed[k]||!ed[k].ts||ed[k].ts<lim){ delete ed[k]; mudou=true; } }
    if(mudou) localStorage.setItem("morais_edits_v1",JSON.stringify(ed));
  }catch(e){}
})();
/* sair também leva as cópias embora */
const _sairOriginal = sair;
/* 20/11/26 — Sair com gravação pendente pergunta antes. Só quando o "Sair" vem de
   um clique da pessoa: as telas também chamam sair() sozinhas quando o servidor
   recusa a sessão, e aí não há o que perguntar. */
function _sairAgora(){ limparDadosLocais(false, true); _sairOriginal(); }
sair = function(){
  let n=0; try{ n=fila().length; }catch(e){}
  const ev=window.event, clique=!!(ev && ev.type==="click");
  if(n>0 && clique && typeof window.moraisPerguntar==="function"){
    window.moraisPerguntar({titulo:"Gravações pendentes",
      texto:"Há "+n+(n===1?" alteração que ainda não subiu":" alterações que ainda não subiram")+". Sair agora descarta.",
      sim:"Sair mesmo assim", nao:"Esperar", perigo:true}).then(ok=>{ if(ok) _sairAgora(); });
    return;
  }
  _sairAgora();
};
document.addEventListener("keydown",e=>{
  if(e.ctrlKey&&e.shiftKey&&(e.key==="L"||e.key==="l")){
    e.preventDefault();
    moraisConfirmar("Apagar os dados guardados", "Apagar os dados guardados neste navegador e recarregar do servidor?\n(Você continua logado; gravações pendentes são mantidas.)", "Apagar e recarregar", true).then(ok=>{ if(ok) limparDadosLocais(); });
  }
});

/* =======================================================================
 * 24/09/26 — BOTÃO "RECARREGAR" EM TODAS AS TELAS
 * -----------------------------------------------------------------------
 * Aparece sozinho no cabeçalho, ao lado do "Sair", em toda tela que carrega
 * o app.js. O que ele faz:
 *   - para TODOS: apaga as cópias guardadas no navegador (menos as edições
 *     ainda não publicadas e as gravações pendentes) e recarrega a tela direto
 *     do servidor;
 *   - para ADM, antes disso: limpa o cache do Apps Script daquele setor e
 *     pede ao GitHub a republicação do site (o mesmo "Atualizar dados agora"
 *     que existia só no Pós Obra e nas Ligações) — aí o dado novo chega para
 *     todo mundo em 1-2 min, e não só para quem clicou.
 * O botão antigo de ADM do Pós Obra e das Ligações some: este faz o mesmo.
 * ===================================================================== */
function _escopoDaTela(){
  const p=(location.pathname.split("/").pop()||"").toLowerCase();
  if(p.indexOf("pos-obra")===0) return "POS_OBRA";
  if(p.indexOf("ligacoes")===0) return "LIGACOES";
  if(p.indexOf("vendas")===0||p.indexOf("casas-vendidas")===0) return "VENDAS";
  if(p.indexOf("documentos")===0) return "DOCUMENTOS";
  if(p.indexOf("analise")===0) return "ANALISES";
  return "TUDO";
}
async function recarregarTela(bt){
  if(bt){ bt.disabled=true; bt.textContent="🔄 Recarregando…"; }
  const s=sessao()||{};
  let msg="";
  if(String(s.tipo||"").toUpperCase()==="ADM"){
    try{
      const r=await _chamarDireto({action:"forcarAtualizacao",escopo:_escopoDaTela()},60000);
      msg = r&&r.ok ? (r.build?"Servidor atualizado; a publicação para todos sai em 1-2 min.":"Servidor atualizado (a publicação para todos não foi disparada).")
                    : "Não consegui limpar o servidor — recarregando só este navegador.";
    }catch(e){ msg="Servidor não respondeu — recarregando só este navegador."; }
  }
  /* cópias do navegador, menos edições não publicadas (morais_edits_) e fila */
  try{
    const ks=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&_ehCopia(k)&&k.indexOf("morais_edits_")!==0) ks.push(k); }
    ks.forEach(k=>localStorage.removeItem(k));
  }catch(e){}
  try{ _storeMem.clear(); }catch(e){}
  try{ if(msg) sessionStorage.setItem("morais_msg_recarga",msg); }catch(e){}
  location.reload();
}
(function botaoRecarregar(){
  if(typeof document==="undefined") return;
  const css=document.createElement("style");
  /* contraste dos cinzas de texto no tema CLARO (as páginas definem --text3/--text4 claros
     demais para letra de 10-11 px): >= 4,5:1 sobre #fff e sobre #EAF1F3. Escuro não muda. */
  css.textContent="html:not([data-tema=\"escuro\"]){--text3:#3f6278;--text4:#4a6e86}"+
    "@media(max-width:680px){.bt-recarregar{min-height:44px;min-width:44px}}"+
    "#bt-atualizar{display:none!important}"+
    ".bt-recarregar{margin-right:8px;background:transparent;border:1px solid rgba(255,255,255,.45);color:inherit;border-radius:8px;padding:6px 10px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}"+
    ".bt-recarregar:hover{background:rgba(255,255,255,.12)}.bt-recarregar:disabled{opacity:.6;cursor:wait}"+
    "#msg-recarga{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:9999;background:#1d5433;color:#fff;padding:8px 14px;border-radius:10px;font-size:13px;box-shadow:0 6px 18px rgba(0,0,0,.2)}";
  document.head.appendChild(css);
  function por(){
    const sair=document.querySelector("button.sair");
    if(!sair||document.querySelector(".bt-recarregar")) return;
    const b=document.createElement("button");
    b.className="bt-recarregar"; b.type="button"; b.textContent="🔄 Recarregar";
    const adm=String((sessao()||{}).tipo||"").toUpperCase()==="ADM";
    b.title=adm?"Recarrega do servidor, limpa o cache do Apps Script e republica o site para todos (ADM)"
               :"Recarrega esta tela direto do servidor, sem as cópias guardadas no navegador";
    b.onclick=()=>recarregarTela(b);
    sair.parentNode.insertBefore(b, sair);
    try{
      const m=sessionStorage.getItem("morais_msg_recarga");
      if(m){ sessionStorage.removeItem("morais_msg_recarga"); const d=document.createElement("div"); d.id="msg-recarga"; d.textContent=m; document.body.appendChild(d); setTimeout(()=>d.remove(),6000); }
    }catch(e){}
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",por); else por();
})();

/* Rótulo de voltar igual em todas as páginas: links/botões que levam ao
   index.html com "Voltar para o Dashboard", "Voltar ao portal" ou "Portal"
   passam a dizer "← Início". Só o texto muda (destino, classe e posição ficam). */
(function rotuloVoltar(){
  if(typeof document==="undefined") return;
  const RX=/voltar para o dashboard|voltar ao portal|^←?\s*portal$/i;
  const VAI=/(^|\/)index\.html([?#]|$)/i;
  function aplicar(){
    document.querySelectorAll("a[href],button[onclick]").forEach(el=>{
      const alvo=el.tagName==="A"?(el.getAttribute("href")||""):(el.getAttribute("onclick")||"");
      if(!VAI.test(alvo)) return;
      if(el.tagName==="A" && /^https?:/i.test(alvo)) return;   // nunca um site de fora
      const t=(el.textContent||"").trim();
      if(!RX.test(t) || t==="← Início") return;
      if(!el.children.length){ el.textContent="← Início"; return; }
      const nos=Array.prototype.filter.call(el.childNodes,n=>n.nodeType===3&&RX.test(n.nodeValue.trim()));
      nos.forEach(n=>{ n.nodeValue="← Início"; });
    });
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",aplicar); else aplicar();
  window.addEventListener("load",aplicar);
})();

/* =======================================================================
 * 24/09/26 — AO VIVO (igual a um site "de verdade")
 * -----------------------------------------------------------------------
 * Quando alguém grava algo pelo portal, o Apps Script manda um aviso pelo
 * Realtime do Supabase (canal "portal"). Toda tela aberta recebe em ~1 s e
 * dispara o evento "portal-ao-vivo" com {tela, acao, id, obraId, quem}.
 *   - Telas que sabem se atualizar sozinhas (obras) tratam o evento e
 *     releem só o que mudou — sem recarregar a página.
 *   - As demais mostram uma faixa: "Fulano alterou dados desta tela —
 *     🔄 Atualizar", que recarrega com um clique.
 * A mensagem não carrega dado nenhum (só ids e o nome de quem gravou); o
 * dado novo vem pelo caminho normal, com login.
 * Sem a Propriedade SUPABASE_ANON_KEY no Apps Script, nada disso liga e o
 * portal funciona como antes.
 * ===================================================================== */
(function aoVivo(){
  if(typeof document==="undefined") return;
  const tela=(location.pathname.split("/").pop()||"index.html").replace(/\.html$/,"")||"index";
  const TELAS={obras:"obras",ligacoes:"ligacoes","pos-obra":"pos-obra",documentos:"documentos",simulacoes:"simulacoes",vendas:"vendas"};
  function faixa(d){
    if(window.AO_VIVO_TRATA===d.tela) return;                 // a tela cuida sozinha
    if(TELAS[tela]!==d.tela) return;
    const me=(sessao()||{}).nome||""; if(d.quem&&me&&d.quem===me) return;
    let f=document.getElementById("faixa-ao-vivo");
    if(!f){
      f=document.createElement("div"); f.id="faixa-ao-vivo";
      f.style.cssText="position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9998;background:#1f3b57;color:#fff;padding:9px 14px;border-radius:12px;font-size:13px;box-shadow:0 6px 18px rgba(0,0,0,.25);display:flex;gap:10px;align-items:center";
      document.body.appendChild(f);
    }
    f.innerHTML="<span>🟢 "+String(d.quem||"Alguém").replace(/</g,"&lt;")+" alterou dados desta tela.</span>"+
      "<button type='button' style='background:#4ade80;color:#0b2e1a;border:0;border-radius:8px;padding:5px 10px;font-weight:700;cursor:pointer' title='Recarrega esta tela com os dados novos'>🔄 Atualizar</button>"+
      "<button type='button' style='background:transparent;color:#fff;border:0;cursor:pointer;font-size:15px' title='Fechar'>×</button>";
    const [bAt,bX]=f.querySelectorAll("button");
    bAt.onclick=()=>{ if(typeof recarregarTela==="function") recarregarTela(bAt); else location.reload(); };
    bX.onclick=()=>f.remove();
  }
  window.addEventListener("portal-ao-vivo",e=>faixa(e.detail||{}));
  async function iniciar(){
    if(!sessao()) return;
    let cfg=null;
    try{ cfg=JSON.parse(sessionStorage.getItem("morais_aovivo")||"null"); }catch(e){}
    if(!cfg){
      let r=null; try{ r=await _chamarDireto({action:"aoVivoConfig"},20000); }catch(e){}
      if(!(r&&r.ok&&r.url&&r.anon)) return;                    // não configurado: segue sem ao vivo
      cfg={url:r.url,anon:r.anon,canal:r.canal||"portal"};
      try{ sessionStorage.setItem("morais_aovivo",JSON.stringify(cfg)); }catch(e){}
    }
    await new Promise((ok,err)=>{
      if(window.supabase&&window.supabase.createClient) return ok();
      const sc=document.createElement("script");
      sc.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
      sc.onload=ok; sc.onerror=err; document.head.appendChild(sc);
    }).catch(()=>null);
    if(!(window.supabase&&window.supabase.createClient)) return;
    const sb=window.supabase.createClient(cfg.url,cfg.anon,{auth:{persistSession:false,autoRefreshToken:false}});
    sb.channel(cfg.canal).on("broadcast",{event:"mudou"},msg=>{
      window.dispatchEvent(new CustomEvent("portal-ao-vivo",{detail:(msg&&msg.payload)||{}}));
    }).subscribe();
    window._aoVivo=sb;
  }
  /* espera a tela abrir e as primeiras leituras saírem, para não disputar a fila */
  window.addEventListener("load",()=>setTimeout(iniciar,2500));
})();

/* ---------- service worker (abre offline) ---------- */
if("serviceWorker" in navigator){ window.addEventListener("load", ()=>navigator.serviceWorker.register("sw.js").catch(()=>{})); }

/* =======================================================================
 * 23/09/26 — DICAS NOS BOTÕES E DESEMPENHO, EM TODAS AS TELAS
 * -----------------------------------------------------------------------
 * Vale para qualquer página que carregue o app.js. Duas coisas:
 *
 * 1) DICAS (tooltip + aria-label). Todo botão/aba/filtro sem `title` ganha
 *    uma dica ao passar o mouse, dizendo o que ele faz. Os textos comuns do
 *    portal ("Sair", "Cancelar", "↻ Sincronizar", "×"...) têm frases próprias;
 *    abas viram "Abre a aba X", filtros viram "Filtra: X", e o resto usa o
 *    próprio rótulo (útil quando ele está cortado numa tela pequena). Botão
 *    só com ícone ganha um nome para leitor de tela. Um observador aplica o
 *    mesmo aos botões desenhados depois (as telas montam o HTML por JS).
 *
 * 2) LISTAS GRANDES. Tabela com muitas linhas ganha `content-visibility`:
 *    o navegador só desenha as linhas visíveis e as demais quando rolar.
 *    Só entra em tabelas com 60+ linhas, para não mexer em nada pequeno.
 * ===================================================================== */
(function(){
  if(typeof document==="undefined") return;
  const DICAS={
    "SAIR":"Sai do portal e encerra a sessão neste navegador",
    "CANCELAR":"Fecha sem gravar nada",
    "FECHAR":"Fecha este painel",
    "X":"Fechar (Esc)",
    "SALVAR":"Grava",
    "SINCRONIZAR":"Busca os dados mais recentes",
    "ATUALIZAR":"Recarrega os dados",
    "ATUALIZAR DADOS AGORA":"Limpa o cache do servidor e pede um build do site — só ADM",
    "TENTAR DE NOVO":"Tenta carregar novamente",
    "VOLTAR":"Volta para a tela anterior",
    "VOLTAR PARA O DASHBOARD":"Volta para a página inicial do portal",
    "VOLTAR PARA POS OBRA":"Volta para a lista do pós obra",
    "MARCAR TODAS":"Marca todas as opções da lista",
    "ENVIAR":"Envia",
    "VISUALIZAR":"Abre o arquivo numa nova aba",
    "ARQ.":"Abre a obra para ver os arquivos",
    "ABRIR OBRA":"Abre o painel desta obra",
    "CONFIRMAR DISTRATO":"Limpa os dados da venda e arquiva as atividades — não tem desfazer",
    "CRIAR":"Grava",
    "CRIAR OBRA":"Grava a obra e fecha o formulário",
    "CRIAR E CONTINUAR":"Grava e deixa o formulário aberto para a próxima",
    "NOVA OBRA":"Abre o formulário de obra nova",
    "NOVO SERVICO":"Abre o formulário de chamado de pós obra",
    "SERVICO DE POS OBRA":"Cria um chamado de assistência para esta obra",
    "GERAR PDF":"Monta o PDF da proposta e guarda",
    "COPIAR":"Copia para a área de transferência",
    "WHATSAPP":"Abre a conversa no WhatsApp com o texto pronto",
    "IMPRIMIR":"Abre a versão para impressão",
    "EXPORTAR":"Baixa os dados em arquivo",
    "DIAGNOSTICO":"Confere as colunas das bases e mostra o que falta",
    "DAR BAIXA":"Marca a atividade como feita, gravando na obra",
    "EXCLUIR":"Remove — fica na lixeira por 30 dias",
    "ANEXAR":"Envia um arquivo"
  };
  const N=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase()
            .replace(/^[\s→←↻🔄✕×✓⚠📎👁🔓📷🌙+\-·•]+|[\s…:]+$/g,"").replace(/\s+/g," ").trim();
  const POR_CLASSE=[
    ["pfechar","Fechar (Esc)"],["hdr-fechar","Volta para a tela anterior"],["hdr-back","Volta para a tela anterior"],
    ["btema","Alterna entre tema claro e escuro"],["bt-graf","Mostra ou esconde o gráfico"],
    ["exp-toggle","Expande ou recolhe"],["gar-toggle","Mostra ou esconde os detalhes da garantia"],
    ["gar-cab","Mostra ou esconde os detalhes"],["scard","Abre os detalhes"],["btn-sync","Busca os dados mais recentes"],
    ["recarregar","Recarrega os dados"],["btn-volta-dash","Volta para a página inicial do portal"],
    ["btn-voltar","Volta para a tela anterior"],["sair","Sai do portal e encerra a sessão neste navegador"]
  ];
  function dicaDe(el){
    const cls=el.className||"";
    for(const [c,t] of POR_CLASSE) if(el.classList.contains(c)) return t;
    const txt=(el.innerText||el.textContent||"").trim(), n=N(txt);
    if(DICAS[n]) return DICAS[n];
    if(!txt||/^[^\wÀ-ÿ]{1,3}$/.test(txt)) return el.getAttribute("aria-label")||"";   // só ícone, sem rótulo conhecido
    if(/\btab\b|sub-tab|nav-btn/.test(cls)) return "Abre: "+txt;
    if(/seg-bt|\btg\b|\bsw\b|chip|filtro/.test(cls)) return "Filtra: "+txt;
    if(/\bth\b/.test(el.tagName.toLowerCase())) return "Ordena por "+txt;
    return txt;   // rótulo completo (útil quando cortado)
  }
  function aplicar(raiz){
    (raiz||document).querySelectorAll("button:not([title]),[role=button]:not([title]),th.ord:not([title]),.tab:not([title]),.seg-bt:not([title])").forEach(el=>{
      const t=dicaDe(el); if(!t) return;
      el.title=t;
      if(!el.getAttribute("aria-label")&&!(el.innerText||"").trim()) el.setAttribute("aria-label",t);
    });
    (raiz||document).querySelectorAll("table:not(.cv-rows)").forEach(tb=>{
      if(tb.tBodies[0]&&tb.tBodies[0].rows.length>=60) tb.classList.add("cv-rows");
    });
  }
  const css=document.createElement("style");
  css.textContent=".cv-rows tbody tr{content-visibility:auto;contain-intrinsic-size:auto 44px}";
  document.head.appendChild(css);
  let agendado=false;
  const obs=new MutationObserver(()=>{ if(agendado) return; agendado=true; requestAnimationFrame(()=>{ agendado=false; aplicar(); }); });
  function iniciar(){ aplicar(); obs.observe(document.body,{childList:true,subtree:true}); }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",iniciar); else iniciar();
})();

/* 16/10/26 — MODO ESCURO LEGÍVEL: confere o contraste dos textos no tema
   escuro e clareia a cor que ficou ruim (ver tema-escuro.js). Carregado aqui
   para valer em todas as páginas que usam o app.js. */
(function(){ try{ if(window.__temaEscuroOk||document.querySelector('script[src*="tema-escuro.js"]')) return;
  const s=document.createElement("script"); s.src="tema-escuro.js?v=1"; s.async=true; (document.head||document.documentElement).appendChild(s); }catch(e){} })();

/* =======================================================================
 * 20/11/26 — MENU COMUM, CAIXA DE PERGUNTA E FOCO (Onda 2 de usabilidade)
 * -----------------------------------------------------------------------
 * Tudo isto vive dentro de uma função para não colidir com nomes das telas.
 * Expõe só:
 *   window.MORAIS_SISTEMAS / MORAIS_GRUPOS_ORDEM — a lista de sistemas do portal
 *       (era do index.html; o início e o menu lateral usam a MESMA fonte);
 *   window.moraisSistemasLiberados(sessao) — itens que aquela sessão pode ver;
 *   window.moraisPerguntar({titulo,texto,sim,nao,perigo}) — caixa de pergunta.
 * Não age dentro de iframe, no início, no login nem com ?embutido=1.
 * ===================================================================== */
(function(){
  if(typeof document==="undefined") return;
  const SRC=(document.currentScript&&document.currentScript.src)||"";
  const BASE=SRC.replace(/[?#].*$/,"").replace(/[^/]*$/,"");   // pasta do app.js

/* "chave" tem que bater com o valor na coluna ACESSOS do banco LOGINS.
   externo:true = mora em outro repositório/site; o card só abre o link, e o
   controle de acesso do portal NÃO protege a página de destino (ver
   CONFIGURAR.md, seção "RAS").
   "grupo" decide em que bloco da barra lateral o botão cai — a ORDEM dos
   blocos é fixa (ver GRUPOS_ORDEM), não a ordem aqui no array. */
const SISTEMAS=[
  /* "LIGAÇÕES" tem que ser IGUAL à opção da coluna ACESSOS no banco LOGINS —
     com acento e em maiúsculas. Se não bater, o botão simplesmente não
     aparece pra quem tem o acesso, e sem mensagem de erro nenhuma. */

  /* Mesma regra da linha de cima: "PÓS OBRA" precisa existir, com acento e em
     maiúsculas, como opção da coluna ACESSOS no banco LOGINS. Se não bater, o
     botão simplesmente não aparece — e sem erro nenhum na tela. */

  /* "ANÁLISES" precisa existir, com acento e em maiúsculas, como opção da
     coluna ACESSOS no banco LOGINS — mesma regra dos outros setores. A
     página (analise.html) mora no próprio portal e lê o Supabase do Orçado x
     Realizado pelo Apps Script (ações analise*). Se a chave não bater, o
     botão não aparece e não dá erro nenhum. */
  /* "nome" e so o rotulo do card; "chave" continua ANÁLISES porque e a opcao
     da coluna ACESSOS no Notion e a permissao no Code.gs — renomear ela
     tiraria o acesso de todo mundo de uma vez. */
  /* GESTÃO DE DOCUMENTOS (set/26). "DOCUMENTOS" precisa existir, com
     maiúsculas, como opção da coluna ACESSOS no banco LOGINS — mesma regra
     dos outros setores. Se não bater, o botão simplesmente não aparece, e
     sem erro nenhum na tela. */

  /* r38 — SIMULAÇÕES (Reserva do Ipês). Exige a opção "SIMULAÇÕES" na coluna
     ACESSOS do banco LOGINS, como os demais setores (ADM/MASTER/TESTES passam
     sempre). A tela é a simulacoes.html, no próprio portal. */

  /* ORDEM DOS SETORES (set/26): Atividades, Obras, Vendas, Documentos,
     Ligações, Pós Obra, Simulações. "embreve" = botão aparece apagado, sem
     link, para todo mundo. */
  {chave:"ATIVIDADES",nome:"Atividades",desc:"Suas atividades, checklists e equipe",ico:"T",link:"atividades.html",grupo:"SETORES",publico:true},
  /* PROCESSOS E ARQUIVOS (25/09/26) — bloco próprio no menu; liberados para
     todos os logados (combinado). Arquivos = página ARQUIVOS do Notion. */
  {chave:"PROCESSOS",nome:"Processos",desc:"Regras, procedimentos e cultura da empresa",ico:"P",link:"processos.html",grupo:"PROCESSOS E ARQUIVOS",publico:true},
  {chave:"ARQUIVOS",nome:"Arquivos",desc:"Documentos e modelos da empresa",ico:"A",link:"arquivos.html",grupo:"PROCESSOS E ARQUIVOS",publico:true},
  /* OBRAS: exige a opção "OBRAS" na coluna ACESSOS do banco LOGINS. */
  {chave:"OBRAS",nome:"Obras",desc:"Solicitação de obras, atividades e cronograma",ico:"O",link:"obras.html",grupo:"SETORES"},
  {chave:"VENDAS",nome:"Gestão de Vendas",desc:"Atividades, alertas e planilhas de vendas",ico:"V",link:"vendas.html",conta:true,grupo:"SETORES"},
  {chave:"DOCUMENTOS",nome:"Gestão de Documentos",desc:"Documentação da obra, alvará, habite-se e prazos",ico:"D",link:"documentos.html",conta:true,grupo:"SETORES"},
  {chave:"LIGAÇÕES",nome:"Ligações de Água e Energia",desc:"Pedidos de ligação de água e energia, prazos e planilha",ico:"L",link:"ligacoes.html",conta:true,grupo:"SETORES"},
  {chave:"PÓS OBRA",nome:"Pós Obra",desc:"Garantias, chamados e serviços de assistência",ico:"P",link:"pos-obra.html",conta:true,grupo:"SETORES"},
  {chave:"SIMULAÇÕES",nome:"Reserva dos Ipês · vendas",desc:"Propostas, simulações, mapa e unidades do condomínio",ico:"S",link:"simulacoes.html",grupo:"SETORES"},
  {chave:"ANÁLISES",nome:"Orçado × Realizado",desc:"Compara o que foi orçado com o que foi gasto, por obra",ico:"$",link:"analise.html",grupo:"ANÁLISES"},

  /* ANÁLISE DE DADOS (set/26) — veio do repositório CONTROLES-INTERNOS.
     Exige a opção "ANÁLISE DE DADOS" (com acento, maiúsculas) na coluna
     ACESSOS do banco LOGINS. Chave PRÓPRIA de propósito, separada de
     "ANÁLISES": aqui aparece fluxo de caixa e pagamento por fornecedor, que
     não é para todo mundo que vê o Orçado × Realizado. */
  {chave:"ANÁLISE DE DADOS",nome:"Análise de Dados",desc:"Painel de metas, prazos e números por setor",ico:"A",link:"analise-dados.html",grupo:"ANÁLISES"},
  /* AUDITORIA FINANCEIRA (22/10/26) — classificação dos pagamentos contra o
     manual do plano de contas, juros/atrasos, fiscalização e o manual
     editável. Duas chaves na coluna ACESSOS do LOGINS: "FINANCEIRO" (vê tudo)
     e "GFINANCEIRO" (vê + valida + edita o manual). "chaves" = qualquer uma
     das duas mostra o botão; quem trava de verdade é o AuditoriaFin.gs. */
  {chave:"FINANCEIRO",chaves:["FINANCEIRO","GFINANCEIRO"],nome:"Auditoria Financeira",desc:"Confere pagamentos, juros, atrasos e o plano de contas",ico:"F",link:"auditoria-financeira.html",grupo:"ANÁLISES"},

  /* "MAPA DE VENDAS" é público: publico:true faz o botão aparecer pra
     qualquer usuário logado, sem precisar de liberação na coluna ACESSOS
     do banco LOGINS (diferente dos outros itens, que exigem a chave lá). */
  {chave:"MAPA DE VENDAS",nome:"Mapa de Vendas",desc:"Disponibilidade das casas e lotes, em mapa",ico:"M",link:"https://devmoraiseng.github.io/SITE-DE-VENDAS/",externo:true,grupo:"MAPAS",publico:true},

  /* público, igual ao Mapa de Vendas: aparece para qualquer usuário logado. */
  /* 28/09/26 — MAPA DE OBRAS (repositório OBRAS-GERAL): status das obras por
     lote, prazos 150/180 dias, medições da semana e calendários. Público como
     o Mapa de Vendas; quem tem acesso a DOCUMENTOS preenche o status lá. */
  {chave:"MAPA DE OBRAS",nome:"Mapa de Obras",desc:"Status das obras por lote, prazos e medições",ico:"M",link:"https://devmoraiseng.github.io/OBRAS-GERAL/",externo:true,grupo:"MAPAS",publico:true},
  {chave:"MAPA RESERVA DOS IPÊS",nome:"Mapa Reserva dos Ipês",desc:"Mapa de vendas e simulador do empreendimento",ico:"M",link:"https://moraiseng-teste.github.io/PORTAL-MORAIS/simulador/",externo:true,grupo:"MAPAS",publico:true},

  {chave:"RAS LÍDERES",nome:"RAS Líderes",desc:"Reunião de alinhamento — Líderes",ico:"R",link:"https://devmoraiseng.github.io/RAS-SEMANAL/",externo:true,grupo:"REUNIÕES"},
  {chave:"RAS FINANCEIRO",nome:"RAS Financeiro",desc:"Reunião de alinhamento — Financeiro",ico:"R",link:"https://devmoraiseng.github.io/RAS-FINANCEIRO/",externo:true,grupo:"REUNIÕES"},
  {chave:"RAS PROJETOS",nome:"RAS Projetos",desc:"Reunião de alinhamento — Projetos",ico:"R",link:"https://devmoraiseng.github.io/RAS-PROJETOS/",externo:true,grupo:"REUNIÕES"},
  {chave:"RAS PÓS OBRAS",nome:"RAS Pós-Obra",desc:"Reunião de alinhamento — Pós-Obra",ico:"R",link:"https://devmoraiseng.github.io/RAS-POS-OBRAS/",externo:true,grupo:"REUNIÕES"},
  {chave:"RAS COMPRAS",nome:"RAS Compras",desc:"Reunião de alinhamento — Compras",ico:"R",link:"https://devmoraiseng.github.io/RAS-COMPRAS/",externo:true,grupo:"REUNIÕES"},
  /* RAS OBRAS (03/09/2026). "RAS OBRAS" precisa existir, com acento e em
     maiúsculas, como opção da coluna ACESSOS no banco LOGINS — mesma regra
     dos outros itens acima. Se não bater, o botão não aparece e não dá erro
     nenhum na tela. */
  {chave:"RAS OBRAS",nome:"RAS Obras",desc:"Reunião de alinhamento — Execução de obras",ico:"R",link:"https://devmoraiseng.github.io/RAS-OBRAS/",externo:true,grupo:"REUNIÕES"},

  /* ---------- AUTOMAÇÕES ----------
     Mesma regra dos RAS: cada automação mora no PRÓPRIO repositório e entra
     aqui só como link (externo:true). O portal NÃO protege a página de
     destino — quem precisa de acesso restrito tem que ter login próprio.
     Lembrete que já custou caro uma vez: "chave" tem que ser IGUAL à opção da
     coluna ACESSOS no banco LOGINS do Notion, com acento e em maiúsculas.
     Se não bater, o botão não aparece e não dá erro nenhum.
     21/10/26: as duas automações ficaram públicas (publico:true) — o botão
     aparece para qualquer usuário logado, sem depender da coluna ACESSOS. */
  {chave:"PRANCHA HUMANIZADA",nome:"Prancha Humanizada",desc:"Gera a prancha de venda a partir da planta do Revit",ico:"A",link:"https://devmoraiseng.github.io/AUT-PRANCHA-HUMANIZADA/",externo:true,grupo:"AUTOMAÇÕES",publico:true},
  /* 28/09/26 — CONFERÊNCIA OC × NF (repositório CONFER-NCIA-COMPRAS), equipe
     de Compras. Diferente da Prancha, a página de destino TEM trava própria:
     ela usa a sessão deste portal e o Apps Script AUT-CONFERENCIA-NF recusa
     quem não tem "CONFERÊNCIA DE NF" na coluna ACESSOS do LOGINS (ADM,
     MASTER e TESTES passam sempre) — é ele que guarda a chave da OpenAI. */
  {chave:"CONFERÊNCIA DE NF",nome:"Conferência OC × NF",desc:"Compara a ordem de compra com a nota fiscal",ico:"C",link:"https://devmoraiseng.github.io/CONFER-NCIA-COMPRAS/",externo:true,grupo:"AUTOMAÇÕES",publico:true},
  /* 03/11/26 — ESCRITÓRIO DE ROBÔS: uma mesa por robô do servidor (horário,
     o que faz e o relatório de cada rodada, o mesmo do e-mail). Os dados são
     do bucket privado "analise" (servidor/escritorio_robos.py); o link
     assinado sai do Apps Script (apps-script/EscritorioRobos.gs), que confere
     a chave "ESCRITÓRIO DE ROBÔS" na coluna ACESSOS (ADM/MASTER veem sempre). */
  {chave:"ESCRITÓRIO DE ROBÔS",chaves:["ESCRITÓRIO DE ROBÔS","BOLETOS E FINANCEIRO"],nome:"Escritório de Robôs",desc:"Horário, função e relatório de cada robô do servidor",ico:"R",link:"escritorio-robos.html",grupo:"AUTOMAÇÕES"},
  /* 17/11/26 — ANALISTA DE PROJETOS: solta o PDF do projeto e a IA confere a
     prancha contra as correções que Goiânia e Senador Canedo já devolveram
     (regras separadas por prefeitura; a página identifica pelo carimbo). A
     chave da OpenAI fica no Apps Script (apps-script/AnalistaProjetos.gs), que
     confere "ANALISTA DE PROJETOS" na coluna ACESSOS (ADM/MASTER veem sempre). */
  {chave:"ANALISTA DE PROJETOS",nome:"Analista de Projetos",desc:"Lê o PDF do projeto e aponta o que corrigir antes da prefeitura",ico:"P",link:"analista-projetos.html",grupo:"AUTOMAÇÕES"},

  /* ---------- ENTRETENIMENTO (29/10/26) ----------
     Morais Royale: o servidor do jogo roda no servidor da empresa; a página
     entretenimento.html abre o jogo já logado com a sessão do portal.
     Público (todo usuário logado vê). */
  {chave:"ENTRETENIMENTO",nome:"Morais Royale",desc:"Jogo de tiro da obra, para a equipe (só na rede do escritório)",ico:"J",link:"entretenimento.html",grupo:"ENTRETENIMENTO",publico:true}
];
const GRUPOS_ORDEM=["SETORES","PROCESSOS E ARQUIVOS","ANÁLISES","MAPAS","REUNIÕES","AUTOMAÇÕES","ENTRETENIMENTO"]; // setores, análises, mapas, reuniões, automações e entretenimento — nessa ordem

  window.MORAIS_SISTEMAS=SISTEMAS;
  window.MORAIS_GRUPOS_ORDEM=GRUPOS_ORDEM;
  window.moraisSistemasLiberados=function(s){
    s=s||sessao();
    return SISTEMAS.filter(x=>x.publico||podeAcessar(s,x.chave)||(x.chaves||[]).some(k=>podeAcessar(s,k)));
  };

  /* ---------- CSS comum (menu, caixa de pergunta, foco) ---------- */
  const CSS=
    "html.mp-trava{overflow:hidden}"+
    /* caixa de pergunta */
    ".mp-dlg-fundo{position:fixed;inset:0;z-index:100000;background:rgba(6,14,20,.6);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto}"+
    ".mp-dlg{box-sizing:border-box;width:100%;max-width:420px;max-height:100%;overflow-y:auto;background:#fff;color:#1a3347;border:1px solid #b8d0da;border-radius:14px;padding:20px;box-shadow:0 18px 48px rgba(0,0,0,.35);font-family:Inter,-apple-system,\"Segoe UI\",Roboto,sans-serif;font-size:14px;line-height:1.5}"+
    ".mp-dlg:focus{outline:none}"+
    ".mp-dlg h2{margin:0 0 8px;font-size:17px;line-height:1.3}"+
    ".mp-dlg p{margin:0;white-space:pre-line;overflow-wrap:anywhere}"+
    ".mp-dlg-bts{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:18px}"+
    ".mp-dlg-bts button{min-height:44px;padding:8px 16px;border-radius:9px;font:inherit;font-weight:700;cursor:pointer;border:1px solid #295778;background:transparent;color:#295778}"+
    ".mp-dlg-bts button.mp-sim{background:#295778;color:#fff}"+
    ".mp-dlg-bts button.mp-sim.mp-perigo{background:#c0392b;border-color:#c0392b}"+
    "html[data-tema=\"escuro\"] .mp-dlg{background:#15222c;color:#e7eff5;border-color:#2d4757}"+
    "html[data-tema=\"escuro\"] .mp-dlg-bts button{border-color:#79c8bf;color:#79c8bf}"+
    "html[data-tema=\"escuro\"] .mp-dlg-bts button.mp-sim{background:#2f6e93;border-color:#2f6e93;color:#fff}"+
    "html[data-tema=\"escuro\"] .mp-dlg-bts button.mp-sim.mp-perigo{background:#c0392b;border-color:#c0392b}"+
    /* botão do cabeçalho e gaveta */
    ".mp-bt{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;margin-right:4px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.45);color:#fff;border-radius:8px;padding:6px 11px;min-height:36px;font:inherit;font-size:13px;font-weight:700;line-height:1;cursor:pointer}"+
    ".mp-bt:hover{background:rgba(255,255,255,.22)}"+
    "@media(max-width:680px){.mp-bt{min-height:44px;min-width:44px;justify-content:center}}"+
    ".mp-fundo{position:fixed;inset:0;z-index:99990;background:rgba(6,14,20,.55)}"+
    ".mp-gaveta{position:fixed;top:0;left:0;bottom:0;z-index:99991;box-sizing:border-box;width:min(320px,88vw);height:100%;display:flex;flex-direction:column;background:linear-gradient(160deg,var(--azul-esc,#1e3f58),var(--azul,#295778));color:#fff;box-shadow:6px 0 24px rgba(0,0,0,.35);font-family:Inter,-apple-system,\"Segoe UI\",Roboto,sans-serif;font-size:14px;line-height:1.35}"+
    "html[data-tema=\"escuro\"] .mp-gaveta{background:linear-gradient(160deg,#122430,#1b3a4f)}"+
    ".mp-gaveta:focus{outline:none}"+
    ".mp-topo{display:flex;align-items:center;gap:10px;padding:12px 8px 10px 16px;border-bottom:1px solid rgba(255,255,255,.18)}"+
    ".mp-quem{flex:1;min-width:0}.mp-nome{font-weight:700;font-size:15px;overflow-wrap:anywhere}"+
    ".mp-tipo{display:inline-block;margin-top:3px;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--teal,#8FDCD2)}"+
    ".mp-x{flex:0 0 auto;min-width:44px;min-height:44px;background:transparent;border:0;color:#fff;font-size:20px;line-height:1;border-radius:8px;cursor:pointer}"+
    ".mp-x:hover{background:rgba(255,255,255,.14)}"+
    ".mp-corpo{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding-bottom:8px}"+
    ".mp-grupo{padding:14px 16px 4px;font-size:11px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:var(--teal,#8FDCD2)}"+
    ".mp-item{display:block;box-sizing:border-box;min-height:44px;padding:9px 16px 9px 12px;border-left:4px solid transparent;color:#fff;text-decoration:none}"+
    ".mp-item:hover{background:rgba(255,255,255,.1)}"+
    ".mp-item[aria-current=\"page\"]{background:rgba(143,220,210,.18);border-left-color:var(--teal,#8FDCD2)}"+
    ".mp-it-nome{display:block;font-weight:700;font-size:14px}"+
    ".mp-it-desc{display:block;margin-top:2px;font-size:12px;color:rgba(255,255,255,.78)}"+
    ".mp-aqui{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;background:var(--teal,#8FDCD2);color:#122430;font-size:10.5px;font-weight:700;letter-spacing:.3px;vertical-align:1px}"+
    ".mp-item.mp-breve{opacity:.5;cursor:default}.mp-item.mp-breve:hover{background:none}"+
    ".mp-pe{padding:10px 16px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid rgba(255,255,255,.18)}"+
    ".mp-sair{width:100%;min-height:44px;border-radius:9px;border:1px solid rgba(255,255,255,.55);background:rgba(255,255,255,.1);color:#fff;font:inherit;font-weight:700;cursor:pointer}"+
    ".mp-sair:hover{background:rgba(255,255,255,.2)}"+
    "@media(prefers-reduced-motion:no-preference){.mp-gaveta{animation:mpEntra .18s ease-out}.mp-fundo{animation:mpFade .18s ease-out}}"+
    "@keyframes mpEntra{from{transform:translateX(-100%)}to{transform:none}}"+
    "@keyframes mpFade{from{opacity:0}to{opacity:1}}";
  let estiloPronto=false;
  function estilo(){
    if(estiloPronto||document.getElementById("mp-css")) return; estiloPronto=true;
    const st=document.createElement("style"); st.id="mp-css"; st.textContent=CSS;
    (document.head||document.documentElement).appendChild(st);
  }

  /* ---------- foco do teclado visível (todo o portal) ----------
     :where() deixa a regra com especificidade mínima e ela entra no COMEÇO do
     <head>: quem já define o próprio :focus-visible (classe ou :focus-visible
     puro, mais adiante no CSS) continua mandando; onde não há nada, vale este. */
  (function focoVisivel(){
    if(document.getElementById("mp-foco")) return;
    const st=document.createElement("style"); st.id="mp-foco";
    st.textContent=":where(a,button,[role=button],summary,[tabindex]):focus-visible{outline:3px solid var(--teal,#8FDCD2);outline-offset:2px}";
    const h=document.head||document.documentElement;
    h.insertBefore(st,h.firstChild);
  })();

  /* ---------- instalar como aplicativo ---------- */
  (function instalavel(){
    const h=document.head; if(!h||!BASE) return;
    if(!document.querySelector('link[rel="manifest"]')){
      const l=document.createElement("link"); l.rel="manifest"; l.href=BASE+"manifest.json"; h.appendChild(l);
    }
    if(!document.querySelector('link[rel="apple-touch-icon"]')){
      const l=document.createElement("link"); l.rel="apple-touch-icon"; l.href=BASE+"img/logo-192.png"; h.appendChild(l);
    }
  })();

  /* ---------- foco preso dentro de uma caixa ---------- */
  const FOCAVEIS='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function focaveis(cx){ return Array.prototype.filter.call(cx.querySelectorAll(FOCAVEIS),e=>e.getClientRects().length>0); }
  function prender(cx,ev){
    if(ev.key!=="Tab") return;
    const l=focaveis(cx);
    if(!l.length){ ev.preventDefault(); cx.focus(); return; }
    const a=l[0], z=l[l.length-1], at=document.activeElement;
    if(ev.shiftKey && (at===a||!cx.contains(at))){ ev.preventDefault(); z.focus(); }
    else if(!ev.shiftKey && (at===z||!cx.contains(at))){ ev.preventDefault(); a.focus(); }
  }
  let travas=0;
  function travar(){ if(++travas===1) document.documentElement.classList.add("mp-trava"); }
  function soltar(){ if(travas>0 && --travas===0) document.documentElement.classList.remove("mp-trava"); }
  function el(tag,cls,txt){ const e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; }

  /* ---------- caixa de pergunta ----------
   * moraisPerguntar({titulo, texto, sim, nao, perigo}) -> Promise<boolean>
   *   titulo  (opcional) título da caixa;  texto  mensagem (\n vira quebra de linha);
   *   sim     rótulo do botão que confirma (padrão "OK");
   *   nao     rótulo do botão que recusa (padrão "Cancelar"); passe "" para uma caixa
   *           de aviso com UM só botão — essa só fecha pelo botão (Esc e clique fora
   *           não fecham) e resolve true;
   *   perigo  true pinta o "sim" de vermelho e deixa o foco inicial no "nao".
   * Resolve true no "sim"; false no "nao", no Esc e no clique fora. Foco preso
   * dentro da caixa; ao fechar, o foco volta a quem o tinha. */
  let seq=0;
  window.moraisPerguntar=function(o){
    o=o||{}; estilo();
    return new Promise(resolve=>{
      const antes=document.activeElement, n=++seq;
      const um=(o.nao===""||o.nao===false);
      const fundo=el("div","mp-dlg-fundo"), cx=el("div","mp-dlg");
      cx.setAttribute("role","alertdialog"); cx.setAttribute("aria-modal","true"); cx.tabIndex=-1;
      if(o.titulo){ const t=el("h2",null,o.titulo); t.id="mp-t"+n; cx.appendChild(t); cx.setAttribute("aria-labelledby",t.id); }
      const p=el("p",null,o.texto||""); p.id="mp-x"+n; cx.appendChild(p); cx.setAttribute("aria-describedby",p.id);
      const bts=el("div","mp-dlg-bts"); cx.appendChild(bts);
      let bNao=null;
      if(!um){ bNao=el("button",null,o.nao||"Cancelar"); bNao.type="button"; bts.appendChild(bNao); }
      const bSim=el("button","mp-sim"+(o.perigo?" mp-perigo":""),o.sim||"OK"); bSim.type="button"; bts.appendChild(bSim);
      fundo.appendChild(cx); document.body.appendChild(fundo); travar();
      let aberta=true;
      function fechar(v){
        if(!aberta) return; aberta=false;
        document.removeEventListener("keydown",tecla,true);
        fundo.remove(); soltar();
        try{ if(antes&&antes.focus&&document.contains(antes)) antes.focus(); }catch(e){}
        resolve(v);
      }
      function tecla(ev){
        if(ev.key==="Escape"){
          ev.preventDefault(); ev.stopPropagation();
          if(!um) fechar(false);
        } else prender(cx,ev);
      }
      document.addEventListener("keydown",tecla,true);
      bSim.onclick=()=>fechar(true);
      if(bNao) bNao.onclick=()=>fechar(false);
      fundo.addEventListener("mousedown",ev=>{ if(ev.target===fundo && !um) fechar(false); });
      (o.perigo&&bNao?bNao:bSim).focus();
    });
  };
  /* Atalhos para as telas trocarem confirm()/alert() nativos (Onda 3):
   *   await moraisConfirmar(titulo, texto, verboDoBotao, perigo) -> boolean
   *   await moraisAviso(titulo, texto) -> true (uma caixa de um botão só)
   * Se moraisPerguntar não existir, cai no confirm()/alert() do navegador. */
  window.moraisConfirmar=function(titulo,texto,sim,perigo){
    if(typeof window.moraisPerguntar==="function") return window.moraisPerguntar({titulo:titulo,texto:texto,sim:sim||"OK",nao:"Cancelar",perigo:!!perigo});
    return Promise.resolve(window.confirm(texto));
  };
  window.moraisAviso=function(titulo,texto){
    if(typeof window.moraisPerguntar==="function") return window.moraisPerguntar({titulo:titulo,texto:texto,sim:"OK",nao:""});
    window.alert(texto); return Promise.resolve(true);
  };

  /* ---------- menu comum (gaveta lateral) ---------- */
  (function menuPortal(){
    try{ if(window.top!==window) return; }catch(e){ return; }      // dentro de iframe: sem menu
    const arq=(location.pathname.split("/").pop()||"").toLowerCase();
    if(arq===""||arq==="index.html"||arq==="login.html") return;   // início e login têm o próprio desenho
    if(/[?&]embutido=1(&|$)/.test(location.search)) return;       // aberto dentro de outra tela
    if(BASE && (location.origin+location.pathname).replace(/[^/]*$/,"")!==BASE) return; // só páginas ao lado do app.js
    function ehAtual(link){ return String(link||"").split(/[?#]/)[0].toLowerCase()===arq; }

    let gaveta=null, fundo=null, abrir=null, antes=null;
    function item(x){
      if(x.embreve){
        const sp=el("span","mp-item mp-breve"); sp.appendChild(el("span","mp-it-nome",x.nome+" · em breve")); return sp;
      }
      const a=el("a","mp-item"); a.href=x.link;
      if(x.externo){ a.target="_blank"; a.rel="noopener"; }
      const nome=el("span","mp-it-nome",x.nome+(x.externo?" ↗":"")); a.appendChild(nome);
      if(!x.externo && ehAtual(x.link)){
        a.setAttribute("aria-current","page");
        nome.appendChild(el("span","mp-aqui","você está aqui"));
      }
      if(x.desc) a.appendChild(el("span","mp-it-desc",x.desc));
      return a;
    }
    function construir(){
      const s=sessao()||{};
      const g=el("aside","mp-gaveta"); g.id="mp-gaveta"; g.tabIndex=-1;
      g.setAttribute("role","dialog"); g.setAttribute("aria-modal","true"); g.setAttribute("aria-label","Menu do portal");
      const topo=el("div","mp-topo"), quem=el("div","mp-quem");
      quem.appendChild(el("div","mp-nome",s.nome||s.login||"Usuário"));
      if(s.tipo) quem.appendChild(el("span","mp-tipo",s.tipo));
      const x=el("button","mp-x","✕"); x.type="button"; x.setAttribute("aria-label","Fechar o menu"); x.onclick=fechar;
      topo.appendChild(quem); topo.appendChild(x); g.appendChild(topo);
      const corpo=el("nav","mp-corpo"); corpo.setAttribute("aria-label","Sistemas do portal");
      const ini=el("a","mp-item"); ini.href="index.html"; ini.appendChild(el("span","mp-it-nome","Início"));
      ini.appendChild(el("span","mp-it-desc","Página inicial do portal")); corpo.appendChild(ini);
      const vis=window.moraisSistemasLiberados(s);
      GRUPOS_ORDEM.forEach(gr=>{
        const doGrupo=vis.filter(y=>(y.grupo||"SETORES")===gr);
        if(!doGrupo.length) return;
        corpo.appendChild(el("div","mp-grupo",gr));
        doGrupo.forEach(y=>corpo.appendChild(item(y)));
      });
      g.appendChild(corpo);
      const pe=el("div","mp-pe"), sa=el("button","mp-sair","Sair"); sa.type="button";
      sa.onclick=()=>{ if(typeof sair==="function") sair(); };
      pe.appendChild(sa); g.appendChild(pe);
      return g;
    }
    function tecla(ev){
      if(document.querySelector(".mp-dlg-fundo")) return;          // uma pergunta está por cima
      if(ev.key==="Escape"){ ev.preventDefault(); fechar(); }
      else if(gaveta) prender(gaveta,ev);
    }
    function abrirMenu(){
      if(gaveta) return; estilo();
      antes=document.activeElement;
      fundo=el("div","mp-fundo"); fundo.onclick=fechar;
      gaveta=construir();
      document.body.appendChild(fundo); document.body.appendChild(gaveta);
      travar(); document.addEventListener("keydown",tecla,true);
      if(abrir) abrir.setAttribute("aria-expanded","true");
      const x=gaveta.querySelector(".mp-x"); (x||gaveta).focus();
    }
    function fechar(){
      if(!gaveta) return;
      document.removeEventListener("keydown",tecla,true);
      gaveta.remove(); fundo.remove(); gaveta=fundo=null; soltar();
      if(abrir) abrir.setAttribute("aria-expanded","false");
      try{ const f=(antes&&document.contains(antes))?antes:abrir; if(f&&f.focus) f.focus(); }catch(e){}
    }
    function por(){
      if(document.getElementById("mp-abrir")) return true;
      const s=sessao(); if(!s||!s.token) return true;
      let ancora=null;
      ["header .hbar","header .pt-hbar","header .pt-bar","header",".hbar"].some(q=>(ancora=document.querySelector(q)));
      if(!ancora) return false;
      estilo();
      const b=el("button","mp-bt"); b.type="button"; b.id="mp-abrir";
      b.setAttribute("aria-haspopup","dialog"); b.setAttribute("aria-expanded","false"); b.setAttribute("aria-controls","mp-gaveta");
      b.setAttribute("aria-label","Abrir o menu do portal");
      const ic=el("span",null,"☰"); ic.setAttribute("aria-hidden","true"); b.appendChild(ic); b.appendChild(document.createTextNode(" Menu"));
      b.onclick=abrirMenu; abrir=b;
      ancora.insertBefore(b,ancora.firstChild);
      return true;
    }
    function iniciar(){ if(!por()) window.addEventListener("load",por); }
    if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",iniciar); else iniciar();
  })();
})();

/* 20/11/26 — TECLADO NOS CLICÁVEIS (Onda 3 de usabilidade)
   Todo elemento com onclick="..." que não seja link, botão, campo, label ou
   summary (div, span, td, tr…) vira "botão" para o teclado: role=button,
   tabindex=0 e Enter/Espaço fazem o clique. Vale também para o que a tela
   criar depois (mesmo observador de sempre). Pula o fundo de janela (o que
   fecha ao clicar fora: onclick com "event.target===this") e quem está dentro
   de um link ou botão. Não mexe em role/tabindex que a tela já definiu. */
(function tecladoNosClicaveis(){
  if(typeof document==="undefined") return;
  const PULAR=/^(A|BUTTON|INPUT|SELECT|TEXTAREA|LABEL|SUMMARY|OPTION|BODY|HTML)$/;
  const FUNDO=/\b(?:event|ev|e)\.target\s*===?\s*this\b/;
  function aplicar(raiz){
    (raiz||document).querySelectorAll("[onclick]:not([data-mp-kb])").forEach(el=>{
      if(PULAR.test(el.tagName)) return;
      el.setAttribute("data-mp-kb","0");
      if(FUNDO.test(el.getAttribute("onclick")||"")) return;
      if(el.closest("a,button,summary,label")) return;
      if(!el.hasAttribute("role")) el.setAttribute("role","button");
      if(!el.hasAttribute("tabindex")) el.setAttribute("tabindex","0");
      el.setAttribute("data-mp-kb","1");
    });
  }
  document.addEventListener("keydown",ev=>{
    if(ev.defaultPrevented||ev.altKey||ev.ctrlKey||ev.metaKey) return;
    if(ev.key!=="Enter"&&ev.key!==" "&&ev.key!=="Spacebar") return;
    const el=ev.target;
    if(!el||!el.getAttribute||el.getAttribute("data-mp-kb")!=="1") return;
    ev.preventDefault();
    el.click();
  });
  let agendado=false;
  const obs=new MutationObserver(()=>{ if(agendado) return; agendado=true; requestAnimationFrame(()=>{ agendado=false; aplicar(); }); });
  function iniciar(){ aplicar(); obs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["onclick"]}); }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",iniciar); else iniciar();
})();
