# Catálogo de roupas

Vitrine pública e painel administrativo em uma aplicação Node.js. A vitrine fica em `/`, as peças em `/peca/:id` e o painel em `/admin`.

## Render

Use Node 22 ou superior. Execute `npm ci` no build e `npm start` na inicialização. Configure o health check em `/health`.

Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `WHATSAPP_NUMBER` em formato internacional. O Render fornece `RENDER_EXTERNAL_URL`, usado nos links das peças. Use `SHOP_NAME` para aplicar o nome da loja.

## Supabase

O SQL em `supabase/catalog.sql` cria tabelas com RLS e o bucket público de fotos. Controle o acesso administrativo com a tabela `clothing_catalog_admins`, vinculando somente o UUID de uma conta verificada no Supabase Auth. Use a chave publicável na aplicação.

O painel entra com as credenciais do Supabase Auth. A vitrine usa leitura anônima. O pedido no WhatsApp inclui o nome, o valor e o link público da peça, com metadados de prévia da foto.
