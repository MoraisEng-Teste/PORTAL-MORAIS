/* SÓ NO FORK DE TESTE — põe o botão "Gerar venda" no cartão de cada unidade da
 * Planilha Casas Condomínio (vendas.html). Na produção, o desenvolvedor liga o
 * mesmo botão do jeito descrito em venda/COMO-IMPLANTAR.md ("Gerar venda do condomínio").
 * O apontador de teste não mexe em arquivos teste-*: a URL abaixo é a do PORTAL-VENDA-TESTE. */
(function () {
  "use strict";
  var URL_PV = "https://script.google.com/macros/s/AKfycbxuqs0uG-Jx4OxFRWSAp9aoEcQHkTJWS_zFyY6QCLa8_hZOkJZSe9Af0nUvytSBmBiC/exec";
  if (typeof condAbrir !== "function" || !window.GerarVendaCondominio) return;
  var original = condAbrir;
  condAbrir = function (id) {
    original(id);
    var card = document.getElementById("cd-card");
    if (!card || card.querySelector(".gv-teste")) return;
    var fechar = Array.prototype.find.call(card.querySelectorAll("button"), function (b) { return /Fechar/.test(b.textContent); });
    var b = GerarVendaCondominio.botao({ pageId: id, urlPortalVenda: URL_PV, urlVendas: "vendas.html", classe: "cd-bt pri gv-teste" });
    if (fechar && fechar.parentNode) fechar.parentNode.insertBefore(b, fechar); else card.prepend(b);
  };
})();
