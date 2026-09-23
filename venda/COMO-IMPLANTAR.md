# PORTAL-VENDA — como implantar

## Teste (uma vez)

1. script.google.com → Novo projeto → nome **PORTAL-VENDA-TESTE**.
2. Crie três arquivos (botão + › Script) e cole o conteúdo de:
   `venda/RegrasVenda.js` → arquivo **RegrasVenda**; `venda/ClaudeLeitor.js` →
   **ClaudeLeitor**; `venda/PortalVenda.gs` → **PortalVenda** (apague o `Código.gs` vazio).
3. Configurações do projeto › Propriedades do script:
   `NOTION_TOKEN` = token da conexão "Portal TESTE"; `SESSION_SECRET` = a MESMA
   frase do PORTAL-TESTE; `ANTHROPIC_API_KEY` = a chave da Anthropic;
   `DB_VENDAS` = `f53c5ab532d38325aa4a0193011aad24`.
4. Implantar › Nova implantação › App da Web › Executar como **Eu** › Quem pode
   acessar **Qualquer pessoa** › Implantar › autorizar (Avançado › Acessar).
5. Teste: abrir `<URL>/exec?action=ping` → `{"ok":true,"versao":"venda-v1","papel":"VENDA"}`.
6. Mande a URL `/exec` no chat (não é segredo).

Mudou o código? Implantar › Gerenciar implantações › lápis › Nova versão › Implantar.

## Produção (quando o dono disser "sobe")

1. Desenvolvedor cria as 24 colunas na VENDAS de produção (arquivo 10 da DOCUMENTACAO).
2. Projeto **PORTAL-VENDA** igual ao de teste, com `NOTION_TOKEN` e `SESSION_SECRET`
   **iguais aos do PORTAL-ESCRITA**, a chave da Anthropic e `DB_VENDAS` =
   `33cc5ab532d38047ae3aee8b87ac1f4d`. Implantar e testar o `ping`.
3. Subir `venda-dossie.js` com a URL `/exec` de produção na constante `URL_PORTAL_VENDA`.
4. No `vendas.html` de produção, depois da linha do `app.js`, acrescentar
   `<script src="venda-dossie.js?v=1"></script>`.
5. Conferir numa casa: o bloco aparece; tipo de casa grava; um documento lê.
   Se o bloco não aparecer: Ctrl+F5 (o `sw.js` guarda páginas em cache).

**Desfazer:** tirar a linha do `vendas.html`. As colunas podem ficar.

**Não sobe para produção:** a pasta `teste/` e o commit do apontador.
