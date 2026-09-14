# Guia de implantação — Plug Presença Mobile

## Objetivo e estado do aplicativo

O **Plug Presença** foi estruturado como um aplicativo móvel para professores. Cada docente entra com a respectiva conta Google, visualiza apenas as turmas cujo e-mail esteja vinculado ao seu cadastro, escolhe uma aula ou uma data, marca a situação de todos os alunos e transmite a chamada em um único envio. O registro é fechado somente quando todos os alunos aplicáveis possuem uma situação definida.

O modelo preserva o histórico. Quando um aluno é retirado da turma, ele deixa de aparecer nas novas chamadas, mas continua associado às aulas em que já possuía um registro. Quando um aluno entra após determinada data, ele não é incluído retroativamente em aulas anteriores. Essas regras foram implementadas no servidor, não apenas na interface, para evitar alterações acidentais ou inconsistentes.

## Dados necessários antes do primeiro uso

A coordenação deve cadastrar ou importar cada turma com um código único, nome, curso, dia da semana, horários e e-mail institucional do professor. Os alunos precisam ser associados à turma com nome completo e data de entrada. O e-mail do professor é a regra de autorização do aplicativo: uma conta Google só pode abrir e alterar as turmas cujo e-mail seja exatamente o mesmo do cadastro, ignorando apenas maiúsculas e minúsculas.

| Campo | Finalidade | Exemplo |
|---|---|---|
| `code` | Identificador único da turma | `MM-T1-2026` |
| `name` | Nome exibido no aplicativo | `Turma 1 — E.M. Marechal Mascarenhas` |
| `dayOfWeek` | Dia da aula no padrão JavaScript, de 0 (domingo) a 6 (sábado) | `1` para segunda-feira |
| `startTime` e `endTime` | Horário da aula | `18:30` e `20:30` |
| `teacherEmail` | Conta Google autorizada para a turma | `professor@escola.org.br` |
| `fullName` | Nome do aluno | `Ana Souza` |
| `entryDate` | Data a partir da qual o aluno participa | `2026-09-14` |

## Login com Google

O login é nativo para Android e iPhone. A biblioteca adotada requer uma **compilação de desenvolvimento ou de produção**, portanto não funciona dentro do Expo Go. A configuração segue o plugin oficial do React Native Google Sign-In, que requer o plugin nativo e, no iPhone, o URL scheme do Client ID iOS [1].

No Google Cloud Console, devem existir os seguintes clientes OAuth no mesmo projeto.

| Plataforma | Item necessário | Uso no aplicativo |
|---|---|---|
| Android | Cliente OAuth Android com pacote `com.app.plugpresencamobile` e SHA-1 da assinatura | Identifica a compilação Android no Google |
| Web | Client ID OAuth de aplicativo Web | Valida no servidor o token de identidade emitido pelo Google |
| iOS, se necessário | Client ID OAuth iOS e URL scheme reverso | Habilita a autenticação nativa em iPhone/iPad |

No projeto **My First Project**, o cliente Web existente é `747810874464-g4e8stgbtjr40oafjf29f1nctgl6utak.apps.googleusercontent.com`. O cliente Android de desenvolvimento foi criado com o pacote `com.app.plugpresencamobile` e o SHA-1 da chave local; seu ID é `747810874464-kf9ftcp30330e2gh9v5jh1ltvekuv2g3.apps.googleusercontent.com`.

O SHA-1 depende da assinatura usada para gerar o APK ou publicar na Play Store. A documentação do Google informa que aplicações Android que usam Google Sign-In precisam do SHA-1 do certificado; para Play App Signing, ele fica em **Release → Setup → App Integrity**, e também pode ser obtido do APK/AAB ou por `keytool` [2].

Os identificadores precisam ser adicionados como configurações seguras do projeto, sem serem gravados no código:

```text
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<client-id-web>.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<client-id-ios>.apps.googleusercontent.com   # somente iOS
GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.<id>                         # somente iOS
GOOGLE_WEB_CLIENT_ID=<client-id-web>.apps.googleusercontent.com
```

O servidor confere a assinatura e o público do token Google antes de criar a sessão do professor. O aplicativo guarda a sessão no armazenamento seguro do aparelho.

## Lembretes por e-mail e alertas de erro

Foi preparado um processo diário, com horário padrão de **20:00 em America/Sao_Paulo**, para encontrar turmas que possuem aula naquele dia e cuja chamada ainda não foi fechada. O processo envia no máximo um lembrete por turma e por dia. Cada tentativa fica registrada com situação, destinatário, identificador da mensagem e eventual erro, o que evita e-mails duplicados mesmo se a tarefa automática for reexecutada.

O envio adotará a API do Resend como serviço transacional. A chave `plug-presenca-production` foi criada com permissão **Sending access** e validada contra a API. A API recebe remetente, destinatário, assunto e HTML, e aceita uma chave de idempotência por requisição [3]. Em caso de falha ao avisar o professor, o sistema registra a falha e envia uma notificação técnica separada para a coordenação, quando houver destinatário de alerta configurado.

| Variável segura | Finalidade |
|---|---|
| `RESEND_API_KEY` | Chave de API com permissão restrita a envio de e-mail |
| `ATTENDANCE_EMAIL_FROM` | Remetente verificado, por exemplo `Plug Presença <presenca@escola.org.br>` |
| `ATTENDANCE_ALERT_TO_EMAIL` | E-mail da coordenação para falhas de envio |
| `ATTENDANCE_APP_URL` | Link exibido no lembrete para abrir o aplicativo ou portal |

A tarefa automática ficará disponível no endpoint interno `/api/scheduled/attendance-reminders`. Ainda falta verificar um domínio de envio no Resend e definir o remetente da escola; por isso os lembretes não estão ativos para produção. Depois desses dois itens e da publicação da aplicação, a configuração da tarefa deve ser criada no ambiente de produção com execução diária às 23:00 UTC, equivalente a 20:00 em São Paulo. A plataforma autentica a execução como tarefa agendada e o aplicativo confere o identificador da tarefa antes de enviar qualquer e-mail.

## Publicação e primeira validação

A sequência recomendada é publicar a versão atual, configurar os identificadores OAuth e o serviço de e-mail, cadastrar a turma piloto com e-mail do professor, gerar o APK de desenvolvimento e testar o fluxo inteiro em um aparelho Android. O teste de aceite deve incluir login Google, visibilidade limitada à turma autorizada, chamada com todos os alunos, reabertura de uma aula para correção, entrada de aluno novo, retirada de aluno e disparo controlado do lembrete diário.

Antes de ativar lembretes para toda a rede, recomenda-se validar com uma turma piloto e um e-mail de coordenação. O aplicativo não deve ser distribuído amplamente enquanto o domínio de envio não estiver verificado e as contas Google dos professores não estiverem associadas às respectivas turmas.

## Referências

[1] [React Native Google Sign-In — Expo setup](https://react-native-google-signin.github.io/docs/setting-up/expo)

[2] [Google Play services — Client authentication e SHA-1](https://developers.google.com/android/guides/client-auth)

[3] [Resend — Send Email API](https://resend.com/docs/api-reference/emails/send-email)
