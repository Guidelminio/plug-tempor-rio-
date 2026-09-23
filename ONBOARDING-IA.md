# Onboarding para outras IAs — Plug Presença

Este documento prepara outra IA, agente de desenvolvimento ou pessoa técnica para continuar o projeto sem perder contexto. Leia-o antes de editar código.

## Objetivo do produto

O Plug Presença é um aplicativo móvel e web para registro de presença escolar. Professores entram com contas locais, visualizam apenas as turmas autorizadas, selecionam a aula, marcam a situação de todos os alunos e enviam uma chamada em lote. Administradores criam professores, turmas e vínculos. O servidor guarda o registro e sincroniza com Google Sheets.

O projeto está em fase de piloto controlado. Não trate a implementação como pronta para operação institucional sem revisar [ERROS-E-PENDENCIAS.md](./ERROS-E-PENDENCIAS.md) e [RELATORIO-AUDITORIA-2026-09-23.md](./RELATORIO-AUDITORIA-2026-09-23.md).

## Regras de trabalho

A IA deve preservar o histórico de presença. Inativar um aluno impede que ele apareça nas próximas chamadas, mas não pode apagar registros anteriores. Adicionar um aluno não deve inseri-lo retroativamente em aulas passadas.

A IA deve validar autorização no servidor, não somente esconder telas no cliente. Toda rota administrativa precisa verificar a função do usuário e a relação entre professor e turma.

A IA não deve imprimir, pedir para o usuário colar no chat ou gravar em Git qualquer segredo. Isso inclui `DATABASE_URL`, `JWT_SECRET`, `INITIAL_ADMIN_PASSWORD`, `RESEND_API_KEY`, `APPS_SCRIPT_SYNC_SECRET`, chaves de Service Account e certificados mobile. Use o painel de secrets do ambiente ou um secret manager.

A IA não deve alterar a matriz antiga da planilha sem confirmar a estratégia. Hoje a ponte grava nas abas normalizadas. Antes de mudar a escrita para `Página1`, leia a seção correspondente do relatório de auditoria e crie testes específicos.

Toda mudança funcional precisa de teste. Antes de concluir, execute `pnpm test`, `pnpm check`, `pnpm lint` e `pnpm build`. Se uma integração externa falhar por rede, registre a falha separadamente dos testes locais e não declare a sincronização saudável sem evidência.

## Mapa do repositório

| Caminho | Responsabilidade |
|---|---|
| `app/` | Telas Expo Router do aplicativo mobile/web |
| `app/(tabs)/index.tsx` | Chamada, seleção de aula e envio em lote |
| `app/(tabs)/admin.tsx` | Administração de professores e turmas |
| `app/(tabs)/account.tsx` | Sessão, troca de senha e encerramento de acessos |
| `app/(tabs)/notifications.tsx` | Avisos internos |
| `server/routers.ts` | Procedimentos tRPC, autenticação e autorização |
| `server/db.ts` | Consultas e mutações do banco |
| `server/local-password.ts` | Hash e verificação de senha |
| `server/local-session.ts` | Sessões locais e revogação |
| `server/attendance-sync.ts` | Lotes idempotentes e reprocessamento |
| `server/apps-script-sync.ts` | Cliente HMAC da ponte Sheets |
| `apps-script/Code.gs` | Web App Apps Script que escreve na planilha |
| `drizzle/schema.ts` | Schema do banco |
| `drizzle/` | Migrações geradas |
| `shared/` | Tipos e regras compartilhados |
| `lib/offline-attendance.ts` | Fila local de chamadas pendentes |
| `constants/oauth.ts` | URL da API e configuração de build |
| `HOSTING.md` | Hospedagem, domínio e troca de host |
| `ENVIRONMENT-TEMPLATE.md` | Nomes das variáveis sem segredos reais |

## Como preparar o ambiente

Use Node.js 22, pnpm 9 e MySQL/MariaDB. Instale dependências com:

```bash
pnpm install --frozen-lockfile
```

Preencha os segredos conforme `ENVIRONMENT-TEMPLATE.md`. Não crie um arquivo de ambiente com valores reais dentro do repositório. Acesse o banco e aplique as migrações com cuidado:

```bash
pnpm db:push
```

Durante o desenvolvimento, use:

```bash
pnpm dev
```

Para validar uma alteração:

```bash
pnpm test
pnpm check
pnpm lint
pnpm build
```

## Fluxo recomendado para uma tarefa

Primeiro, leia este documento, o README, o relatório de auditoria e os arquivos diretamente envolvidos. Depois, formule a hipótese do problema e localize o teste que deve proteger o comportamento. Faça a menor alteração coerente com as regras de histórico, autorização e idempotência.

Em seguida, execute os testes específicos e a suíte completa. Verifique o diff, procure segredos e confira se a documentação precisa ser atualizada. Para mudanças de schema, gere a migração e confirme que ela não apaga dados. Para mudanças na ponte, teste um lote com acento e uma segunda submissão com o mesmo identificador.

Não publique uma alteração quebrada apenas porque a interface parece correta. O aplicativo depende do servidor, do banco, da sessão, do Apps Script e do agendamento. A validação precisa considerar o fluxo completo ou declarar claramente qual parte não foi testada.

## Integração com a planilha

A ponte recebe um payload assinado. O servidor e o Apps Script precisam ter o mesmo segredo HMAC. O lote deve ser idempotente: repetir o mesmo `batchId` não pode duplicar presença. A aba `Controle_Sincronização` deve registrar o resultado.

A integração atual é adequada ao piloto. Para produção, considerar Google Sheets API com Service Account e fila no servidor. Nunca coloque a chave JSON da Service Account no código ou no repositório público.

## Como trocar o host

O servidor Express entrega API e interface web no mesmo processo. Leia `HOSTING.md` antes de propor uma arquitetura diferente. Quando o domínio mudar, defina `EXPO_PUBLIC_API_BASE_URL` no ambiente de build e gere um novo aplicativo nativo. Um APK antigo não muda de endereço sozinho.

Verifique sempre `https://SEU-DOMINIO/api/health`, login administrativo, login de professor, gravação no banco e sincronização da planilha. CORS deve permitir somente domínios oficiais.

## Estado conhecido e prioridades

A prioridade atual é corrigir CORS, tratar datas como datas civis no fuso da escola, definir como a matriz `Página1` será atualizada e separar testes externos dos testes locais. Push, WhatsApp automático e importação completa de alunos ainda não devem ser tratados como concluídos.

Quando houver conflito entre um pedido novo e esse estado conhecido, a IA deve explicar o impacto, atualizar os testes e atualizar `ERROS-E-PENDENCIAS.md`.

## Formato esperado de uma entrega

Uma entrega técnica deve informar o que mudou, quais arquivos foram alterados, quais testes foram executados, quais integrações externas foram verificadas e quais limitações permanecem. Nunca declarar que um erro foi corrigido sem reproduzir o cenário ou adicionar um teste que cubra a correção.

## Referências internas

[1]: ./README.md "Visão geral do Plug Presença"
[2]: ./ERROS-E-PENDENCIAS.md "Erros, riscos e pendências"
[3]: ./RELATORIO-AUDITORIA-2026-09-23.md "Auditoria técnica completa"
[4]: ./HOSTING.md "Hospedagem própria e troca de host"
