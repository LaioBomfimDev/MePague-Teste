# Supabase setup

Este projeto usa Supabase Auth, Postgres, Row Level Security e Realtime.

## Atualizar um projeto que ja existe

Se o app ja esta funcionando, voce nao precisa recriar projeto Supabase, superadm, usuarios, nem trocar as variaveis atuais.

Para habilitar as notificacoes PWA adicionadas agora, faca apenas isto:

1. Abra o Supabase > SQL Editor.
2. Rode o `supabase-notifications-migration.sql`.
   - Ele cria somente a parte nova de notificacoes.
   - Ele nao recria superadm, nao mexe em clientes, dividas, pagamentos ou perfis existentes.
   - As novas tabelas sao `notification_preferences`, `push_subscriptions` e `notification_deliveries`.
3. Gere as chaves VAPID uma vez:

```bash
npm run vapid
```

4. Adicione somente estas variaveis novas no `.env.local` e tambem no ambiente de producao:

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=chave-publica-gerada
VAPID_PRIVATE_KEY=chave-privada-gerada
CRON_SECRET=um-segredo-longo-aleatorio
```

`VAPID_SUBJECT=mailto:seu-email-ou-suporte@mepague.app` e opcional; se nao definir, o app usa `mailto:suporte@mepague.app`.

Nao mexa nas variaveis que ja existem, como `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPERADMIN_EMAIL` ou `SUPERADMIN_PASSWORD`.

Depois disso, rode `npm run build` e publique novamente. Na Vercel, o `CRON_SECRET` faz a propria Vercel enviar `Authorization: Bearer <CRON_SECRET>` quando chamar `/api/notifications/daily-reminders`.

## 1. Criar o projeto

1. Entre em https://supabase.com/dashboard.
2. Clique em New project.
3. Escolha a organizacao, nomeie o projeto e defina a senha do banco.
4. Aguarde o projeto ficar pronto.

## 2. Criar as tabelas

1. No projeto, abra SQL Editor.
2. Crie uma query nova.
3. Cole todo o conteudo de `supabase-schema.sql`.
4. Clique em Run.

O script cria:

- `profiles`
- `customers`
- `debts`
- `payments`
- `charge_logs`
- `notification_preferences`
- `push_subscriptions`
- `notification_deliveries`
- `audit_logs`
- politicas de Row Level Security
- trigger para criar perfil automaticamente no cadastro
- publicacao Realtime das tabelas usadas pelo app

## 3. Copiar URL e chave publica

1. Abra o botao Connect ou va em Project Settings > API Keys.
2. Copie o Project URL.
3. Copie a Publishable key (`sb_publishable_...`). Se seu painel mostrar apenas chaves legadas, copie a `anon public`.

Crie um arquivo `.env.local` na pasta `web`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua-chave-publicavel
NEXT_PUBLIC_SUPERADMIN_EMAIL=superadm@mepague.app
```

Ou, usando chave legada:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-public
NEXT_PUBLIC_SUPERADMIN_EMAIL=superadm@mepague.app
```

Nunca coloque `service_role` no frontend.

Para usar o painel `/admin`, adicione tambem no `.env.local` local ou nas variaveis privadas do servidor:

```bash
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
SUPERADMIN_EMAIL=superadm@mepague.app
SUPERADMIN_PASSWORD=654321
```

`SUPABASE_SERVICE_ROLE_KEY` nunca deve ter prefixo `NEXT_PUBLIC_`.

Para notificacoes PWA em um projeto novo, gere chaves VAPID e adicione tambem:

```bash
npx web-push generate-vapid-keys
```

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=sua-chave-publica-vapid
VAPID_PRIVATE_KEY=sua-chave-privada-vapid
VAPID_SUBJECT=mailto:suporte@mepague.app
CRON_SECRET=um-segredo-longo-para-o-cron
```

`VAPID_PRIVATE_KEY` e `CRON_SECRET` tambem devem ficar apenas no servidor/provedor de deploy.

## 4. Configurar login para teste local

Para validar rapido:

1. Abra Authentication > Providers.
2. Confirme que Email esta habilitado.
3. Para teste local, desative email confirmations.

Se deixar confirmacao de email ligada, o usuario precisa clicar no email antes de entrar.

## 5. Configurar login com Google

O app ja chama o OAuth do Supabase e volta para `/login`.

No Supabase:

1. Abra Authentication > Providers > Google.
2. Habilite o provider Google.
3. Cole o Client ID e o Client Secret criados no Google Cloud.
4. Abra Authentication > URL Configuration.
5. Defina o Site URL de producao, por exemplo `https://seu-dominio.com`.
6. Em Redirect URLs, adicione as URLs usadas pelo app:

```txt
http://localhost:3000/login
http://localhost:3006/login
https://seu-dominio.com/login
```

Se voce testar em outra porta local, adicione tambem `http://localhost:<porta>/login`.

No Google Cloud:

1. Crie ou abra um OAuth Client ID do tipo Web application.
2. Em Authorized JavaScript origins, adicione as origens do app:

```txt
http://localhost:3000
http://localhost:3006
https://seu-dominio.com
```

3. Em Authorized redirect URIs, adicione o callback do Supabase:

```txt
https://<project-ref>.supabase.co/auth/v1/callback
```

Troque `<project-ref>` pelo ref do seu projeto Supabase. Novos usuarios que entrarem pelo Google tambem nascem como `active`; o superadm so precisa intervir para bloquear, inativar, excluir ou mudar perfil/plano.

## 6. Criar o superadm

1. Rode todo o `supabase-schema.sql` no SQL Editor.
   - Se o projeto ja tinha usuarios pendentes do fluxo antigo, rode tambem `supabase-auto-approval-migration.sql` uma vez para ativar esses cadastros comuns.
2. Garanta que `SUPABASE_SERVICE_ROLE_KEY` esta no `.env.local`.
3. Rode:

```bash
npm run superadmin
```

Depois entre no app com login `superadm` e senha `654321`.

## 7. Rodar localmente

```bash
npm run dev
```

Abra http://localhost:3000, crie uma conta, cadastre uma divida e confira:

- Table Editor > `profiles`: deve existir um perfil com seu usuario.
- Table Editor > `customers`: deve aparecer o cliente cadastrado.
- Table Editor > `debts`: deve aparecer a divida cadastrada.
- Table Editor > `payments`: deve aparecer quando voce registrar um pagamento.
- Table Editor > `charge_logs`: deve aparecer quando voce copiar ou enviar uma cobranca.
- Table Editor > `notification_preferences`: deve aparecer quando voce ativar notificacoes.
- Table Editor > `push_subscriptions`: deve aparecer o dispositivo inscrito para receber push.
- Table Editor > `audit_logs`: deve aparecer quando houver criacoes, edicoes e acoes administrativas.

## 8. Agendamento das notificacoes

O arquivo `vercel.json` chama `/api/notifications/daily-reminders` todos os dias as 11:00 UTC, que equivale a 08:00 em `America/Sao_Paulo`.

A rota verifica apenas dividas `open` com `due_date` igual a amanha. Se o usuario nao tiver nada para receber nessa data, nenhuma notificacao e enviada. O log em `notification_deliveries` evita duplicidade para a mesma regra e data.

## 9. Validar seguranca basica

No Table Editor, cada linha deve ter `user_id` igual ao usuario autenticado. As politicas RLS em `supabase-schema.sql` fazem com que cada pessoa leia e altere apenas os proprios dados.

Novos cadastros entram como `active`, sem aprovacao manual. O superadm pode inativar, bloquear, excluir logicamente, trocar plano/perfil, resetar senha e registrar notas internas em `/admin`.

O painel administrativo nao consulta `debts`, `payments` ou valores financeiros dos usuarios. A visao de risco e baseada em acesso, status, perfil, confirmacao de email e acoes sensiveis registradas em auditoria.
