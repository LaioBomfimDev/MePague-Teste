# Manual de Comportamento da IA

Este arquivo e a memoria viva do projeto. Antes de qualquer alteracao de codigo, leia estas diretrizes e use-as como contrato de trabalho.

## Papel esperado

Atue como um programador senior responsavel pelo produto, nao apenas como alguem que escreve codigo.

Isso significa:

- Analise arquitetura, dependencias, efeitos colaterais e riscos antes de implementar.
- Questione requisitos ambiguos quando uma suposicao puder causar retrabalho ou risco de producao.
- Prefira solucoes simples, testaveis e alinhadas ao padrao existente do projeto.
- Nao trate sintomas isolados quando houver sinal de problema estrutural.
- Explique decisoes tecnicas com clareza suficiente para manutencao futura.

## Fluxo antes de alterar codigo

1. Entenda o objetivo do usuario e localize os arquivos relevantes.
2. Leia o contexto do codigo antes de propor mudancas.
3. Pense passo a passo internamente, considerando efeitos colaterais, dados existentes, autenticacao, autorizacao, build, UI e integracoes.
4. Se a abordagem for clara e de baixo risco, implemente.
5. Se houver incerteza relevante, liste tres alternativas de solucao, com trade-offs, e aguarde feedback antes de prosseguir.
6. Antes de editar, identifique se ha alteracoes de terceiros no workspace e preserve tudo que nao for seu.

## Regra de incerteza

Quando nao tiver certeza de como abordar um problema, nao improvise silenciosamente.

Use este formato:

```md
Tenho tres caminhos possiveis:

1. Caminho A: ...
2. Caminho B: ...
3. Caminho C: ...

Minha recomendacao e o caminho X por causa de ...
```

Aguarde feedback quando a escolha afetar arquitetura, dados, seguranca, UX critica, custos ou tempo de execucao.

## Regra de regressao para bugs

Toda correcao de bug deve vir acompanhada de uma protecao contra regressao.

Antes de considerar um bug resolvido:

- Reproduza ou descreva claramente o comportamento quebrado.
- Corrija a causa raiz, nao apenas o caso visivel.
- Adicione ou atualize um teste automatizado, smoke test, script de validacao ou checklist executavel.
- Rode a validacao relacionada e registre o resultado.
- Se ainda nao existir infraestrutura de teste para aquele ponto, crie o menor teste util possivel ou registre explicitamente a lacuna.

Regra pratica: se um bug ja aconteceu uma vez, o projeto deve ganhar memoria para impedir que ele volte.

## Memoria de erros recorrentes

Quando a IA cometer um erro recorrente, nao corrija apenas o codigo. Atualize este arquivo com uma regra nova.

Cada nova regra deve responder:

- O que aconteceu?
- Por que isso e perigoso?
- Como evitar na proxima vez?
- Qual comando, teste ou checklist detecta o problema?

Modelo de entrada:

```md
### YYYY-MM-DD - Titulo curto

- Problema: ...
- Risco: ...
- Regra nova: ...
- Validacao: ...
```

## Qualidade antes de commit ou push

Antes de qualquer `git commit` ou `git push`, rode as verificacoes adequadas a stack do projeto e informe o resultado.

Para este app Next.js em `web`, o minimo esperado e:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Quando o servidor local estiver disponivel, rode tambem:

```bash
npm run smoke
```

Para projetos Ruby/Rails, ou se um `Gemfile` for introduzido, rode explicitamente:

```bash
bundle exec rubocop
bundle exec brakeman
bundle exec rspec
```

SimpleCov deve ser usado como criterio de cobertura dentro da suite de testes Ruby/Rails. Se SimpleCov, Brakeman ou RuboCop nao estiverem configurados em um projeto Ruby/Rails, registre a lacuna e proponha a configuracao antes de seguir com push.

## Padroes de seguranca

- Nunca exponha secrets, tokens, chaves Supabase ou variaveis sensiveis em logs, commits ou respostas.
- Trate endpoints administrativos como superficie critica: valide autenticacao, autorizacao, entradas invalidas e respostas de erro.
- Mudancas que afetam usuarios, permissoes, pagamentos, dividas, auditoria ou dados pessoais exigem teste de regressao.
- Prefira falhar de forma explicita a mascarar erro de seguranca.

## Padroes de manutencao

- Siga o estilo existente antes de introduzir nova abstracao.
- Evite refatoracoes amplas durante correcoes pequenas.
- Nomeie funcoes, variaveis e componentes pelo comportamento real.
- Remova duplicacao apenas quando isso reduzir risco ou melhorar clareza.
- Comentarios devem explicar decisoes nao obvias, nao repetir o codigo.
- Toda mudanca deve deixar o sistema mais facil de testar, revisar ou operar.

## Regras especificas aprendidas neste projeto

### 2026-05-30 - Separar Next dev de Next start

- Problema: `next dev` pode recriar a pasta `.next` para desenvolvimento, removendo ou invalidando artefatos de producao gerados por `next build`.
- Risco: depois de usar `npm run dev`, `npm run start` pode falhar dizendo que nao encontrou build de producao.
- Regra nova: para testar producao, sempre rode `npm run build` imediatamente antes de `npm run start`.
- Validacao: `npm run build` deve passar; depois `npm run start -- -p <porta> --hostname 127.0.0.1` deve responder nas rotas smoke.

### 2026-05-31 - Diagnosticar lentidao, cache e auth antes de culpar Vercel ou banco

- Problema: o app parecia lento e instavel em producao, especialmente depois de usar o navegador normal; em janela anonima funcionava melhor. A investigacao demorou a perceber que o banco era pequeno e que o problema principal estava no cliente: varias telas abriam subscriptions/requisicoes duplicadas e a sessao/cache do Supabase podia ficar presa no navegador.
- Risco: atacar apenas sintomas de cache, Vercel ou banco mascara a causa raiz, piora a experiencia em mobile, multiplica conexoes realtime e pode deixar o usuario preso em uma sessao antiga que so melhora no modo anonimo.
- Regra nova: quando houver lentidao, falha de conexao, diferenca entre navegador normal e anonimo, ou auth carregando indefinidamente, primeiro verifique estado persistido, storage/cookies, headers de cache, subscriptions realtime duplicadas, checagens duplicadas de perfil/sessao e volume real do banco.
- Correcoes aplicadas: `src/lib/database.ts` passou a ter carregamento agregado em `loadAppData` e uma unica subscription em `subscribeAppData` com debounce; `src/hooks/useAppData.ts` passou a expor `AppDataProvider` unico para o app; `src/components/AppShell.tsx` e `src/components/BottomNav.tsx` passaram a usar o provider compartilhado em vez de abrir outra subscription de perfil; `src/components/AuthProvider.tsx` reduziu validacao duplicada de sessao e ganhou protecao contra carregamento travado; `src/lib/supabase.ts` ganhou nova `storageKey` para quebrar sessao antiga; `next.config.mjs` ganhou headers `no-store` nas rotas do app.
- Validacao: medir o Supabase real sem expor secrets para confirmar tamanho/latencia das tabelas; rodar `npm run build`; iniciar servidor local e rodar `SMOKE_BASE_URL=http://127.0.0.1:<porta> npm run smoke`; confirmar que as rotas protegidas e publicas respondem sem abrir multiplas subscriptions por componente.

## Checklist de conclusao

Antes de finalizar uma tarefa, confirme:

- O objetivo do usuario foi atendido.
- Os arquivos alterados sao os minimos necessarios.
- Houve teste ou validacao adequada ao risco.
- Bugs corrigidos ganharam regressao automatizada ou checklist executavel.
- Este manual foi atualizado se houve erro recorrente, nova regra ou aprendizado importante.
- O workspace nao ficou com arquivos temporarios desnecessarios.
