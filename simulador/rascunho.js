/* Rascunho neste aparelho — peça única da proposta e do simulador.
   Guarda no localStorage os valores dos campos (texto, lista, rádio e caixa; nunca arquivos), uma chave por
   unidade, com data e validade de 7 dias. Só restaura se a pessoa escolher "Continuar de onde parou".
   Apaga ao enviar. Uso: var r=criarRascunho({...}); depois do envio, r.enviado().
   Opções:
     form()            -> o <form>
     prefixo           -> início da chave no localStorage (ex.: 'rascunhoProposta:')
     rotulo            -> 'proposta' ou 'simulação' (texto da faixa)
     textoRestaurado   -> frase que sai depois de "Rascunho restaurado."
     unidade()         -> unidade escolhida agora ('' se nenhuma)
     unidadeEl()       -> a lista de unidades (para oferecer o rascunho ao trocar de unidade)
     pronto()          -> true quando as unidades já carregaram
     excluir           -> seletor CSS de áreas que não entram no rascunho
     vindoDeFora()     -> true quando outro caminho preenche a tela (ex.: "Transformar em proposta")
     extra()           -> dados extras a guardar (ex.: diluição); aplicarExtra(d) devolve ao restaurar
     fim(d)            -> chamado ~0,45 s depois de restaurar, para recalcular a tela
     faixaId, apagarId -> ids da faixa e do link "Apagar rascunho"
     avisar(tipo,msg)  -> mostra um aviso na tela */
(function(){
  var VALIDADE=7*864e5;
  function ls(){ try{ return window.localStorage; }catch(e){ return null; } }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function p2(n){ return (n<10?'0':'')+n; }

  window.criarRascunho=function(o){
    var PFX=o.prefixo, timer=null, parado=false, enviado=false, un0='';
    function F(){ return o.form(); }
    function unidadeSel(){ return String(o.unidade()||''); }
    function campos(){
      var f=F(), cont={}, out=[];
      [].forEach.call(f.elements, function(el){
        var t=String(el.type||'').toLowerCase(), nome=el.name||'';
        if(!nome || nome==='unidade') return;
        if(t==='file'||t==='button'||t==='submit'||t==='reset'||t==='password'||t==='image'||t==='hidden') return;
        if(o.excluir && el.closest(o.excluir)) return;
        var i=cont[nome]||0; cont[nome]=i+1;
        out.push({k:nome+'#'+i, el:el, t:t});
      });
      return out;
    }
    function ler(un){
      var s=ls(); if(!s||!un) return null;
      try{
        var d=JSON.parse(s.getItem(PFX+un)||'null');
        if(!d || !d.ts || !d.v) return null;
        if(Date.now()-d.ts>VALIDADE){ s.removeItem(PFX+un); return null; }
        return d;
      }catch(e){ return null; }
    }
    function apagar(un){ var s=ls(); try{ if(s&&un) s.removeItem(PFX+un); }catch(e){} }
    function varrerVelhos(){
      var s=ls(); if(!s) return;
      try{
        var ks=[]; for(var i=0;i<s.length;i++){ var k=s.key(i); if(k && k.indexOf(PFX)===0) ks.push(k); }
        ks.forEach(function(k){ try{ var d=JSON.parse(s.getItem(k)||'null'); if(!d||!d.ts||Date.now()-d.ts>VALIDADE) s.removeItem(k); }catch(e){ s.removeItem(k); } });
      }catch(e){}
    }
    function salvar(){
      if(parado||enviado) return;
      var s=ls(), un=unidadeSel(); if(!s||!un) return;
      try{
        var v={}, tem=false;
        campos().forEach(function(c){
          if(c.t==='checkbox'||c.t==='radio'){ if(c.el.checked){ v[c.k]=1; tem=true; } }
          else if(String(c.el.value||'')!==''){ v[c.k]=c.el.value; tem=true; }
        });
        if(!tem) return;
        var reg={ts:Date.now(), un:un, v:v};
        if(o.extra){ try{ reg.extra=o.extra(); }catch(e){} }
        s.setItem(PFX+un, JSON.stringify(reg));
      }catch(e){}
    }
    function agendar(e){
      if(e && e.isTrusted===false) return;   // só mudança feita pela pessoa (não a do próprio código)
      clearTimeout(timer); timer=setTimeout(salvar, 800);
    }
    function restaurar(d, faixa){
      parado=true;
      function disp(el,ev){ try{ el.dispatchEvent(new Event(ev,{bubbles:true})); }catch(e){} }
      function passada(){
        campos().forEach(function(c){
          var el=c.el, ch=(c.t==='checkbox'||c.t==='radio');
          if(ch){
            var q=!!d.v[c.k]; if(c.t==='radio' && !q) return;
            if(el.checked===q) return; el.checked=q;
          } else {
            if(!(c.k in d.v) || el.value===d.v[c.k]) return;
            el.value=d.v[c.k];
            if(el.tagName==='SELECT' && el.value!==d.v[c.k]) return;
          }
          disp(el,'input'); disp(el,'change');
        });
      }
      passada();
      setTimeout(function(){
        passada();
        try{ if(o.aplicarExtra) o.aplicarExtra(d.extra||{}, d); }catch(e){}
        try{ if(o.fim) o.fim(d); }catch(e){}
      }, 450);
      setTimeout(function(){ passada(); parado=false; }, 1000);
      faixa.innerHTML='<b>Rascunho restaurado.</b> '+esc(o.textoRestaurado||'');
    }
    function oferecer(d){
      var faixa=document.getElementById(o.faixaId); if(!faixa) return;
      var dt=new Date(d.ts);
      faixa.innerHTML='Você começou '+(o.rotulo==='proposta'?'uma proposta':'uma simulação')+' da unidade <b>'+esc(d.un)+'</b> em '+
        p2(dt.getDate())+'/'+p2(dt.getMonth()+1)+' às '+p2(dt.getHours())+':'+p2(dt.getMinutes())+'.<div class="acoes">'+
        '<button type="button" class="btn-primario" id="btRascCont">Continuar de onde parou</button>'+
        '<button type="button" class="btn-secundario" id="btRascZero">Começar do zero</button></div>';
      faixa.style.display='block';
      document.getElementById('btRascCont').onclick=function(){ restaurar(d, faixa); };
      document.getElementById('btRascZero').onclick=function(){ apagar(d.un); faixa.style.display='none'; };
    }
    function iniciar(){
      varrerVelhos();
      var lk=document.getElementById(o.apagarId);
      if(lk) lk.onclick=function(e){
        e.preventDefault();
        apagar(unidadeSel()); apagar(un0);
        var fx=document.getElementById(o.faixaId); if(fx) fx.style.display='none';
        if(o.avisar) o.avisar('ok','Rascunho apagado deste aparelho.');
      };
      var f=F(); f.addEventListener('input', agendar); f.addEventListener('change', agendar);
      if(o.vindoDeFora && o.vindoDeFora()) return;   // os dados de fora valem e o rascunho não é oferecido
      var t0=Date.now();
      (function esperar(){
        var un=unidadeSel();
        if(un && o.pronto()){
          un0=un; var d=ler(un); if(d) oferecer(d);
          /* ao trocar de unidade, oferece o rascunho da nova unidade, se houver */
          var el=o.unidadeEl && o.unidadeEl();
          if(el) el.addEventListener('change', function(e){
            if(e && e.isTrusted===false) return;
            var fx=document.getElementById(o.faixaId); if(fx) fx.style.display='none';
            var nu=unidadeSel(); un0=nu; var dn=ler(nu); if(dn) oferecer(dn);
          });
          return;
        }
        if(Date.now()-t0<45000) setTimeout(esperar, 400);
      })();
    }
    iniciar();
    return { enviado:function(){ enviado=true; clearTimeout(timer); apagar(unidadeSel()); apagar(un0); } };
  };
})();
