# Plug Presença

Aplicativo móvel e web para professores registrarem presença em lote, com contas próprias, painel administrativo, turmas, alunos, banco de dados e sincronização idempotente com Google Sheets.

> **Estado atual:** o projeto está pronto para piloto controlado. A sincronização foi validada em uma planilha de homologação. Antes de uso institucional, leia o [relatório de auditoria](./RELATORIO-AUDITORIA-2026-09-23.md), principalmente as recomendações sobre CORS, datas e atualização da matriz antiga da planilha.

## Funcionalidades

O professor entra com e-mail e senha, visualiza as turmas autorizadas, escolhe a data da aula, marca todos os alunos como presentes, ausentes ou justificados e envia a chamada em um único lote. A interface também permite adicionar ou retirar alunos sem apagar o histórico, reabrir uma aula existente, acompanhar notificações internas e guardar chamadas pendentes quando a conexão cai.

A conta administradora pode criar professores, ativar ou desativar contas, criar turmas e vincular professores. O servidor protege essas operações por função; esconder ou mostrar a aba no celular não é a camada de segurança.

A integração atual usa um Apps Script assinado por HMAC para gravar nas abas normalizadas `Turmas`, `Alunos`, `Aulas`, `Presenças` e `Controle_Sincronização`. A planilha de homologação recebeu lotes reais de teste, inclusive com acentos e controle de duplicidade.

## Stack

| Camada | Tecnologia |
|---|---|
| Aplicativo | Expo SDK 54, React Native, Expo Router, TypeScript, NativeWind |
| API | Node.js, Express, tRPC |
| Banco | MySQL/MariaDB via Drizzle ORM |
| Sessão | Conta local com senha protegida por `scrypt` e sessão persistente no servidor |
| Planilha | Apps Script com HMAC; evolução recomendada para Sheets API com Service Account |
| E-mail | Resend para lembretes; MailApp apenas nos alertas da ponte Apps Script |
| Testes | Vitest, TypeScript e Expo lint |

## Executar localmente

Requisitos: Node.js 22, pnpm 9, um banco MySQL/MariaDB e as variáveis de ambiente descritas em `ENVIRONMENT-TEMPLATE.md`.

```bash
pnpm install
# crie um .env protegido ou use o painel de secrets do host;
# consulte ENVIRONMENT-TEMPLATE.md para os nomes necessários
# edite .env; nunca envie esse arquivo ao GitHub
pnpm db:push
pnpm dev
```

A interface web de desenvolvimento fica normalmente no Expo/Metro e a API no servidor Express. O script `build` gera a exportação web em `dist-web` e o bundle do servidor em `dist`.

Comandos úteis:

```bash
pnpm check       # TypeScript
pnpm lint        # lint Expo
pnpm test        # testes locais e integrações configuradas
pnpm test:external # testes reais contra Apps Script e Resend; depende de rede e secrets
pnpm build       # export web + bundle Node
pnpm start       # servidor de produção
```

`pnpm test` agora executa somente a suíte determinística. Os testes que acessam Apps Script e Resend ficam em `pnpm test:external`, pois dependem de rede e credenciais válidas. Em produção, configure `ALLOWED_ORIGINS` com uma lista separada por vírgulas contendo apenas os domínios oficiais.

## Trocar o host

O aplicativo foi preparado para rodar atrás de um único domínio, com a API e a interface web no mesmo processo. Para usar outro host, siga o [guia de hospedagem e troca de domínio](./HOSTING.md).

Resumo do processo:

1. Copie o projeto para o novo servidor.
2. Configure Node.js 22, pnpm e MySQL/MariaDB.
3. Crie um banco vazio e preencha `DATABASE_URL`.
4. Configure um domínio com HTTPS apontando para o servidor.
5. Preencha as variáveis de `ENVIRONMENT-TEMPLATE.md` no painel de segredos do host.
6. Execute `pnpm install --frozen-lockfile`, `pnpm db:push` e `pnpm build`.
7. Inicie com `NODE_ENV=production pnpm start`.
8. Teste `https://SEU-DOMINIO/api/health` e depois faça login no aplicativo.
9. Para o aplicativo Android/iOS, compile novamente com `EXPO_PUBLIC_API_BASE_URL=https://SEU-DOMINIO`.

A URL do host é embutida no build nativo. Trocar somente o servidor não atualiza um APK já instalado; é necessário gerar e distribuir uma nova versão do aplicativo. No web, o mesmo domínio pode usar a API relativa sem recompilar o cliente.

## Segurança

Não coloque no repositório `DATABASE_URL`, `JWT_SECRET`, `INITIAL_ADMIN_PASSWORD`, `RESEND_API_KEY`, `APPS_SCRIPT_SYNC_SECRET`, chaves JSON de Service Account ou certificados móveis. Use `ENVIRONMENT-TEMPLATE.md` apenas como modelo. O `.gitignore` bloqueia `.env`, chaves e certificados.

Após o primeiro login do administrador, troque a senha inicial e remova `INITIAL_ADMIN_PASSWORD` do ambiente de produção. Use HTTPS, limite o acesso do banco ao servidor e faça backup antes de migrar o schema.

## Documentação adicional

- [Guia de hospedagem, troca de host e domínio](./HOSTING.md)
- [Modelo de variáveis de ambiente](./ENVIRONMENT-TEMPLATE.md)
- [Guia de implantação e integrações](./GUIA-IMPLANTACAO.md)
- [Erros, riscos e pendências](./ERROS-E-PENDENCIAS.md)
- [Onboarding para outras IAs](./ONBOARDING-IA.md)
- [Relatório de auditoria técnica](./RELATORIO-AUDITORIA-2026-09-23.md)
- [Ponte Apps Script](./apps-script/README.md)
- [Capturas do aplicativo](./docs/screenshots/README.md)

## Licença e uso

Este repositório contém o código do projeto Plug Presença da Plug and Plus. Defina a licença e a política de distribuição antes de tornar o repositório público.
