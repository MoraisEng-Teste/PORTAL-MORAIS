/* Acesso por leitor de tela nos formulários do simulador e da proposta.
   1) liga cada <label> ao seu campo (for/id) quando o rótulo é irmão do campo na mesma célula;
      o id sai do "name" do campo (nada muda no name) e o mesmo vale para campos criados depois;
   2) marcarInvalido(campo): aria-invalid="true" até a pessoa corrigir. */
(function(){
  var CONTROLES='input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=file]),select,textarea';
  function ehControle(el){ return el && el.matches && el.matches(CONTROLES); }
  function acharCampo(label){
    var irmao=label.nextElementSibling;
    while(irmao && irmao.tagName!=='LABEL'){
      if(ehControle(irmao)) return irmao;
      var dentro=irmao.querySelector && irmao.querySelector(CONTROLES);
      if(dentro) return dentro;
      irmao=irmao.nextElementSibling;
    }
    return null;
  }
  function idPara(campo){
    if(campo.id) return campo.id;
    var base='f-'+(campo.name ? String(campo.name).replace(/[^A-Za-z0-9_-]/g,'-') : 'campo'), id=base, n=1;
    while(document.getElementById(id)){ n++; id=base+'-'+n; }
    return id;
  }
  function ligarRotulos(raiz){
    var rotulos=(raiz||document).querySelectorAll('label:not([for])');
    for(var i=0;i<rotulos.length;i++){
      var l=rotulos[i];
      if(l.querySelector('input,select,textarea')) continue;    // já envolve o campo
      var c=acharCampo(l);
      if(!c) continue;
      if(!c.id) c.id=idPara(c);
      l.setAttribute('for', c.id);
    }
  }
  function marcarInvalido(campo){
    if(!campo || !campo.setAttribute) return;
    campo.setAttribute('aria-invalid','true');
    var limpa=function(){ campo.removeAttribute('aria-invalid'); campo.removeEventListener('input',limpa); campo.removeEventListener('change',limpa); };
    campo.addEventListener('input',limpa); campo.addEventListener('change',limpa);
  }
  window.ligarRotulos=ligarRotulos;
  window.marcarInvalido=marcarInvalido;

  var agendado=false;
  function depois(){
    if(agendado) return; agendado=true;
    (window.requestAnimationFrame||setTimeout)(function(){ agendado=false; ligarRotulos(); });
  }
  function iniciar(){
    ligarRotulos();
    if(window.MutationObserver) new MutationObserver(depois).observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar); else iniciar();
})();
