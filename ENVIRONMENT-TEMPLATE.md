# Modelo de variáveis de ambiente

Use este arquivo como referência para preencher os segredos no painel do host ou em um arquivo `.env` protegido. **Não copie valores reais para o GitHub.**

```text
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://usuario:senha@127.0.0.1:3306/plug_presenca
JWT_SECRET=troque-por-um-segredo-longo-e-aleatorio
INITIAL_ADMIN_EMAIL=admin@exemplo.org.br
INITIAL_ADMIN_PASSWORD=troque-por-uma-senha-temporaria
ATTENDANCE_APP_URL=https://presenca.exemplo.org.br
ALLOWED_ORIGINS=https://presenca.exemplo.org.br,https://www.presenca.exemplo.org.br

RESEND_API_KEY=re_coloque_a_chave_no_painel_de_segredos
ATTENDANCE_EMAIL_FROM=Plug Presença <presenca@exemplo.org.br>
ATTENDANCE_ALERT_TO_EMAIL=coordenacao@exemplo.org.br

APPS_SCRIPT_SYNC_URL=https://script.google.com/macros/s/SEU_DEPLOYMENT_ID/exec
APPS_SCRIPT_SYNC_SECRET=defina-o-mesmo-segredo-na-propriedade-do-apps-script

# Opcional/legado
EXPO_PUBLIC_API_BASE_URL=https://presenca.exemplo.org.br
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
GOOGLE_IOS_URL_SCHEME=
GOOGLE_WEB_CLIENT_ID=
VITE_APP_ID=
OAUTH_SERVER_URL=
OWNER_OPEN_ID=
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
```

`DATABASE_URL`, `JWT_SECRET`, `INITIAL_ADMIN_PASSWORD`, `RESEND_API_KEY` e `APPS_SCRIPT_SYNC_SECRET` são segredos. A URL do Apps Script e os Client IDs OAuth podem aparecer em documentação, mas devem ser protegidos conforme a política do projeto.
