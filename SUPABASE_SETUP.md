# Supabase setup

Este projeto usa Supabase Auth, Postgres, Row Level Security e Realtime.

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

## 4. Configurar login para teste local

Para validar rapido:

1. Abra Authentication > Providers.
2. Confirme que Email esta habilitado.
3. Para teste local, desative email confirmations.

Se deixar confirmacao de email ligada, o usuario precisa clicar no email antes de entrar.

## 5. Criar o superadm

1. Rode todo o `supabase-schema.sql` no SQL Editor.
2. Garanta que `SUPABASE_SERVICE_ROLE_KEY` esta no `.env.local`.
3. Rode:

```bash
npm run superadmin
```

Depois entre no app com login `superadm` e senha `654321`.

## 6. Rodar localmente

```bash
npm run dev
```

Abra http://localhost:3000, crie uma conta, cadastre uma divida e confira:

- Table Editor > `profiles`: deve existir um perfil com seu usuario.
- Table Editor > `customers`: deve aparecer o cliente cadastrado.
- Table Editor > `debts`: deve aparecer a divida cadastrada.
- Table Editor > `payments`: deve aparecer quando voce registrar um pagamento.
- Table Editor > `charge_logs`: deve aparecer quando voce copiar ou enviar uma cobranca.
- Table Editor > `audit_logs`: deve aparecer quando houver criacoes, edicoes e acoes administrativas.

## 7. Validar seguranca basica

No Table Editor, cada linha deve ter `user_id` igual ao usuario autenticado. As politicas RLS em `supabase-schema.sql` fazem com que cada pessoa leia e altere apenas os proprios dados.

Novos cadastros entram como `pending`. O superadm deve aprovar, inativar, bloquear, excluir logicamente, trocar plano/perfil, resetar senha e registrar notas internas em `/admin`.

O painel administrativo nao consulta `debts`, `payments` ou valores financeiros dos usuarios. A visao de risco e baseada em acesso, status, perfil, confirmacao de email e acoes sensiveis registradas em auditoria.
