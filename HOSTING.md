# Hospedagem própria e troca de host

Este documento explica como tirar o Plug Presença do domínio temporário e rodá-lo em um servidor próprio. O projeto é um serviço Node único: Express entrega a API e, depois do build, também entrega a interface Expo Web a partir de `dist-web`.

## 1. Pré-requisitos

Use um servidor Linux com Node.js 22, pnpm 9, MySQL ou MariaDB, HTTPS e um processo que permaneça ativo. O host pode ser uma VPS, máquina virtual ou plataforma Node equivalente. O banco precisa ter armazenamento persistente; não use SQLite temporário ou disco efêmero para produção.

O domínio deve apontar para o servidor por DNS. Antes de liberar o app, configure TLS com Caddy, Nginx ou o proxy HTTPS oferecido pelo host. A API e a interface devem ser publicadas pelo mesmo domínio, por exemplo `https://presenca.plugandplus.com`.

## 2. Instalação do código

```bash
git clone https://github.com/Guidelminio/plug-tempor-rio-.git
cd plug-tempor-rio-
pnpm install --frozen-lockfile
# crie um .env protegido ou use o painel de secrets do host;
# consulte ENVIRONMENT-TEMPLATE.md para os nomes necessários
```

Preencha o `.env` no servidor ou o painel de secrets do host. Não faça commit dele. O arquivo precisa conter, no mínimo, `DATABASE_URL`, `JWT_SECRET`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD`. Para sincronização, preencha também `APPS_SCRIPT_SYNC_URL` e `APPS_SCRIPT_SYNC_SECRET`. Os nomes estão reunidos em `ENVIRONMENT-TEMPLATE.md`.

Crie o banco vazio e execute a migração:

```bash
pnpm db:push
```

Faça backup antes de repetir esse comando em um banco já utilizado. A migração é gerada pelo Drizzle e deve ser revisada antes de ser aplicada em produção.

## 3. Build e processo de produção

```bash
pnpm check
pnpm lint
pnpm test
pnpm build
NODE_ENV=production pnpm start
```

O processo escuta `PORT` e entrega:

- `/api/health` para verificação de saúde;
- `/api/trpc` para a API do aplicativo;
- `/` e as rotas Expo para a interface web;
- `/api/scheduled/attendance-reminders` para o job de lembretes;
- `/api/scheduled/attendance-sync` para reprocessar lotes pendentes.

Use um gerenciador de processo, como systemd, Docker Compose ou PM2. Exemplo de unidade systemd:

```ini
[Unit]
Description=Plug Presença
After=network.target mysql.service

[Service]
Type=simple
User=plugpresenca
WorkingDirectory=/srv/plug-presenca
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

As variáveis secretas devem ser fornecidas pelo mecanismo de secrets do host ou por um arquivo de ambiente protegido fora do Git. Se usar systemd, restrinja as permissões desse arquivo ao usuário do serviço.

## 4. Proxy HTTPS

Exemplo mínimo de Nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name presenca.exemplo.org.br;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Use certificados válidos e redirecione HTTP para HTTPS. O login e a sincronização não devem ser expostos em HTTP.

## 5. Trocar o endereço usado pelo aplicativo mobile

No build do aplicativo, defina a URL pública:

```bash
EXPO_PUBLIC_API_BASE_URL=https://presenca.exemplo.org.br pnpm expo export --platform web
```

Para Android/iOS, a variável precisa estar disponível durante a compilação nativa. Gere novamente o aplicativo depois de trocar o host. Um APK antigo continuará apontando para o endereço que foi embutido no build.

Também é possível criar um arquivo `.env.local` apenas na máquina de build:

```text
EXPO_PUBLIC_API_BASE_URL=https://presenca.exemplo.org.br
```

Esse arquivo não deve ser enviado ao GitHub. Depois, use a ferramenta de build escolhida para gerar o APK/AAB ou IPA. O pacote Android atual está configurado como `com.app.plugpresencamobile`; se ele for alterado, atualize também os clientes OAuth e os certificados correspondentes.

No web, se o app e a API estiverem no mesmo domínio, a API pode ser chamada por caminho relativo. Se forem domínios separados, configure `EXPO_PUBLIC_API_BASE_URL` e restrinja o CORS para os dois domínios realmente usados.

## 6. Primeiro acesso administrativo

1. Abra o domínio novo.
2. Entre com `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD`.
3. Crie os professores com e-mail correto.
4. Crie a turma e vincule um ou mais professores.
5. Cadastre os alunos pela chamada ou importe-os conforme a rotina da escola.
6. Troque a senha do administrador.
7. Remova `INITIAL_ADMIN_PASSWORD` das variáveis do servidor e reinicie o processo.
8. Teste com uma conta de professor que ela veja apenas as turmas autorizadas.

## 7. Google Sheets

### Ponte Apps Script atual

A ponte atual é mantida no diretório `apps-script/`. O Web App deve estar publicado com acesso compatível com o servidor, a propriedade de script `PLUG_PRESENCA_SYNC_SECRET` deve conter exatamente o mesmo valor de `APPS_SCRIPT_SYNC_SECRET`, e o ID da planilha deve estar configurado em `apps-script/Code.gs`.

O servidor salva a chamada no banco antes de tentar sincronizar. Se o Apps Script falhar, o lote fica pendente ou falho e pode ser reprocessado. A ponte escreve nas abas normalizadas, não na matriz antiga `Página1`; consulte o relatório de auditoria antes de decidir se essa matriz também precisa ser atualizada.

### Opção recomendada para produção

Como o serviço roda em um servidor próprio, a evolução recomendada é trocar a ponte por Google Sheets API usando uma Service Account. Compartilhe a planilha com o e-mail da Service Account e armazene o JSON ou a chave privada no secret manager do host, nunca no Git. Use escopo mínimo, fila de sincronização, chave idempotente por aula/aluno e `values.update`/`batchUpdate` para correções.

## 8. Lembretes e tarefas agendadas

Os endpoints de job não devem ficar abertos para qualquer pessoa. O agendador do host precisa enviar a identidade esperada pelo backend. Configure uma tarefa diária após validar o e-mail do remetente. O horário padrão previsto é 20:00 em `America/Sao_Paulo`.

Antes de ativar para toda a escola, faça um teste com uma turma e um único destinatário. Verifique o histórico de execução, o registro na tabela de dispatches e a mensagem recebida. Resend, MailApp e qualquer outro provedor possuem limites e não devem ser tratados como infinitos.

## 9. Checklist de troca de host

| Item | Feito |
|---|---|
| DNS do domínio apontando para o servidor | [ ] |
| HTTPS válido | [ ] |
| Banco persistente criado | [ ] |
| `.env` configurado fora do Git | [ ] |
| `pnpm db:push` aplicado após backup | [ ] |
| `pnpm build` concluído | [ ] |
| `/api/health` retornando 200 | [ ] |
| Login administrativo testado | [ ] |
| Conta de professor e turma piloto testadas | [ ] |
| Planilha homologada sincronizada | [ ] |
| Remetente de e-mail verificado | [ ] |
| Novo APK/AAB gerado com `EXPO_PUBLIC_API_BASE_URL` | [ ] |
| CORS restrito aos domínios oficiais | [ ] |

## 10. Troubleshooting

**A página abre, mas a API falha:** confirme se o proxy encaminha `/api` para a mesma porta do processo Node e se `DATABASE_URL` está correta.

**O APK continua usando o host antigo:** a URL foi embutida durante a compilação. Defina `EXPO_PUBLIC_API_BASE_URL` e gere uma nova versão.

**A chamada salva no app, mas não aparece na planilha:** consulte `syncBatches` e `syncEvents`; confira a URL do Apps Script, o segredo HMAC, o acesso da implantação e a aba `Controle_Sincronização`.

**O e-mail não chega:** confira `ATTENDANCE_EMAIL_FROM`, domínio/remetente verificado, `RESEND_API_KEY`, limites do provedor e a configuração do job.

**O login funciona no servidor, mas não no navegador:** confirme HTTPS, cookie seguro, domínio único ou CORS explicitamente permitido. Não habilite CORS aberto com credenciais.
