# Me Pague Web

Aplicacao Next.js do Me Pague.

## Rodar com auth local

A porta local real do projeto e `3033`. Use ela para validar login normal, Supabase Auth e Google OAuth.

```bash
npm install
npm run build
npm run start:local
```

Abra [http://localhost:3033](http://localhost:3033).

## Desenvolvimento

Para hot reload sem mexer no build de producao local:

```bash
npm run dev:local
```

Isso abre o Next dev em [http://127.0.0.1:3034](http://127.0.0.1:3034). O Google OAuth local fica reservado para `3033`, porque essa e a porta cadastrada no Supabase e no Google Cloud.

## Validacao

```bash
npm run build
npm run smoke
```

O smoke usa `http://127.0.0.1:3033` por padrao. Para outro alvo temporario, defina `SMOKE_BASE_URL`.
