# Relatório de auditoria técnica — Plug Presença

**Data da auditoria:** 23 de setembro de 2026  
**Projeto:** `plug-presenca-mobile`  
**Objetivo:** verificar a programação, os fluxos de interface, os botões, os testes, a operação publicada, a sincronização efetiva com Google Sheets e a melhor arquitetura para hospedagem em servidor próprio.

## 1. Resumo executivo

O aplicativo já possui uma base funcional relevante: autenticação local de professores e administrador, sessões persistentes, painel administrativo, criação de turmas, vínculo de professores, cadastro e inativação de alunos, seleção de aula, marcação em lote de presença, fila local para perda de conexão, notificações internas, ponte Apps Script assinada e sincronização idempotente com uma planilha de homologação.

A integração com o Google Sheets **funciona tecnicamente no cenário homologado**. A planilha `Plug Presença - Homologação - Turma 1` recebeu dois lotes de teste na aba `Presenças`, e a aba `Controle_Sincronização` registrou os dois lotes como `SYNCED`. Também foi validado um nome de aluno com acento. Isso comprova que o servidor consegue enviar dados ao Apps Script e que o Apps Script consegue gravar na planilha.

Entretanto, o sistema ainda não deve ser considerado pronto para operação institucional sem ajustes. Os pontos mais importantes são: a política CORS aceita qualquer origem com credenciais; os testes de integração externa fazem a suíte completa falhar quando Apps Script ou Resend estão lentos ou indisponíveis; a ponte escreve nas abas normalizadas criadas pelo aplicativo, mas **não atualiza a matriz original de chamada da aba `Página1`**; notificações push e WhatsApp automático ainda não estão implementados; e o registro de presença usa conversões de data que podem exibir ou selecionar o dia errado em determinados fusos.

A recomendação é manter a ponte Apps Script durante o piloto, porque ela já está homologada e evita colocar uma chave privada de Google no servidor. Para produção, considerando que existe um servidor próprio, a melhor evolução é usar o servidor como núcleo de autenticação, regras e fila, e adotar a **Google Sheets API com uma Service Account** como integração principal. A planilha seria compartilhada com o e-mail da Service Account com permissão de editor. O Apps Script pode permanecer como alternativa para envio de e-mails e manutenção de planilhas, mas não deveria ser o único ponto crítico de sincronização em escala.

## 2. Resultado das verificações

| Verificação | Resultado | Evidência ou observação |
|---|---:|---|
| Testes locais determinísticos | **15/15 passaram** | 6 arquivos de teste: regras de presença, logout, senha, login administrativo, contrato Apps Script e servidor web estático |
| TypeScript | **Passou** | `pnpm check` sem erro |
| Lint | **Sem erros; 2 avisos** | `app/(tabs)/admin.tsx`: `Alert` e `updateTeacher` declarados e não usados |
| Build de produção | **Passou** | Exportação Expo Web em `dist-web` e bundle do servidor em `dist/index.js` |
| Endpoint público de saúde | **Passou** | `https://plugpresenca-7giuvcqj.manus.space/api/health` retornou HTTP 200 |
| CORS público | **Risco confirmado** | Com `Origin: https://example.com`, o backend devolveu `Access-Control-Allow-Origin: https://example.com` e `Access-Control-Allow-Credentials: true` |
| Teste Apps Script ao vivo | **Falhou por timeout** | A conexão externa excedeu o tempo no ambiente de auditoria; não houve resposta suficiente para concluir o teste |
| Teste Resend ao vivo | **Falhou por timeout** | A conexão com `api.resend.com` excedeu o tempo; não prova que a chave esteja inválida |
| Sincronização em homologação | **Passou** | Dois lotes `INT-20260917-BRIDGE-VERIFICATION` e `INT-20260917-BRIDGE-UTF8` com status `SYNCED` |
| Gravação com acento | **Passou** | `Aluno de Homologação` aparece na aba `Presenças` |

A suíte completa não ficou verde porque três testes tentam acessar serviços externos diretamente. Os testes locais passaram, o TypeScript passou, o lint não apresentou erro e o build passou. A falha externa deve ser tratada como problema de confiabilidade da suíte e de observabilidade de integração, não como prova isolada de que a regra de negócio está quebrada.

## 3. Auditoria da interface e dos botões

O fluxo principal de chamada está conectado. A tela possui seleção de turma, seleção ou criação de aula por data, inclusão de aluno, marcação individual de `PRESENT`, `ABSENT` e `EXCUSED`, marcação de todos presentes, marcação de todos ausentes, envio da chamada, reenvio de pendências offline, abertura de resumo no WhatsApp, atualização manual e gestão de alunos. Não foram encontrados `onPress` vazios nos fluxos principais.

O envio em lote exige que não existam marcações pendentes e grava uma única chamada. A fila offline usa um identificador de lote para tentar impedir duplicidade. O histórico de aluno inativado é preservado, o que atende ao requisito de não apagar registros antigos quando um aluno deixa de aparecer nas próximas chamadas.

A aba **Admin** agora aparece na navegação, mas o servidor continua sendo responsável por impedir acesso indevido. Isso é correto do ponto de vista de segurança, embora seja melhor ocultar a aba para usuários comuns ou apresentar uma mensagem mais clara de acesso restrito. O painel permite criar professor e criar turma, mas a interface ainda não oferece uma edição completa de turma, arquivamento com confirmação, importação de alunos em lote ou visualização de auditoria.

Há dois avisos de lint no painel administrativo. Eles não quebram a execução, mas indicam código incompleto ou preparado para uma funcionalidade ainda não exposta: `Alert` não é usado e `updateTeacher` é criado mas não é chamado. Recomenda-se remover os símbolos se a edição de professor não fizer parte da primeira versão ou criar a tela de edição correspondente.

A tela de aula usa um campo textual `AAAA-MM-DD`. Esse formato é funcional, mas sujeito a erro de digitação. Em celular, o ideal é usar seletor de data e validar se a data pertence a uma aula possível da turma. Também falta uma opção visual explícita para marcar uma aula como cancelada ou sem aula, embora o banco aceite os estados `CANCELLED` e `NO_CLASS`.

## 4. Problemas encontrados no código

### 4.1 Alto — CORS aceita qualquer origem com credenciais

Em `server/_core/index.ts`, linhas 37–56, o servidor reflete qualquer cabeçalho `Origin` recebido e envia `Access-Control-Allow-Credentials: true`. A verificação pública confirmou que uma origem externa arbitrária recebeu autorização CORS.

Isso aumenta a superfície para ataques de origem cruzada, principalmente porque o aplicativo usa sessão por cookie. A correção recomendada é manter uma lista explícita de origens permitidas, por exemplo o domínio publicado, o domínio de preview quando necessário e os esquemas nativos apenas quando aplicável. Solicitações com origem desconhecida devem ficar sem `Access-Control-Allow-Origin`.

### 4.2 Alto — a matriz original da planilha não é atualizada

A ponte grava nas abas `Turmas`, `Alunos`, `Aulas`, `Presenças` e `Controle_Sincronização`. A planilha de homologação também contém a matriz original em `Página1`, com cabeçalhos como `Nome Completo do aluno`, datas distribuídas nas colunas e marcações `P`, `F` e `N/A`.

A inspeção mostrou que os dois lotes de teste foram gravados em `Presenças`, mas o código não localiza a linha do aluno e a coluna da data na `Página1` para alterar a célula correspondente. Portanto, se a equipe continuar olhando a matriz antiga, poderá concluir que a chamada não foi registrada. É necessário escolher uma estratégia:

| Estratégia | Vantagem | Custo ou risco |
|---|---|---|
| Manter somente abas normalizadas | Mais simples, auditável e robusto | Exige que professores/coordenadores adotem a nova aba ou um relatório derivado |
| Atualizar também a `Página1` | Preserva o modelo visual atual | Precisa mapear aluno, data, mês, coluna e regras de `P/F/N/A`; é mais frágil |
| Criar uma aba de relatório visual a partir de `Presenças` | Mantém o legado intacto e oferece uma visão familiar | Exige fórmula ou rotina de geração do relatório |

Para o piloto, recomendo manter as abas normalizadas e criar uma aba `Relatório_Chamada` derivada. Para produção, se a escola exigir a matriz antiga, implementar um adaptador separado e cobri-lo com testes específicos de data, aluno inativo, nova coluna e célula já preenchida.

### 4.3 Alto — testes externos tornam a suíte instável

`tests/apps-script.integration.test.ts`, `tests/apps-script-sync.integration.test.ts` e `tests/resend.integration.test.ts` fazem chamadas reais à internet durante `pnpm test`. Nesta auditoria, os três falharam por `UND_ERR_CONNECT_TIMEOUT`.

A recomendação é separar os testes em duas categorias. A suíte padrão deve usar mocks ou um servidor HTTP local e permanecer determinística. Os testes reais devem ser executados com uma flag explícita, por exemplo `RUN_EXTERNAL_INTEGRATION=1`, com retry limitado, timeout maior e relatório claro. A sincronização já possui testes de contrato locais; eles devem ser a proteção principal contra regressões.

### 4.4 Alto — conversão de datas pode deslocar o dia

Em `app/(tabs)/index.tsx`, a seleção de aula usa `new Date(item.lessonDate).toISOString().slice(0, 10)`, e a função de exibição transforma strings de data em `Date`. Strings no formato `YYYY-MM-DD` são interpretadas como UTC pelo JavaScript; no fuso de São Paulo, isso pode aparecer como o dia anterior. Esse risco é especialmente grave para presença, porque a aula pode ser carregada ou gravada na data errada.

A correção deve tratar `lessonDate` como data civil, não como instante. O código deve extrair diretamente os componentes `YYYY-MM-DD` para o seletor, e a apresentação deve usar um parser local controlado ou um horário ao meio-dia no fuso da escola. O mesmo padrão deve ser aplicado às regras de lembrete e à ponte Apps Script.

### 4.5 Médio — falta de reprocessamento automático no celular

A fila em `lib/offline-attendance.ts` persiste lotes em `AsyncStorage`, mas o reenvio depende do fluxo da tela e do botão de pendências. Isso protege contra perda imediata do registro, porém não é uma sincronização em segundo plano confiável. Se o professor fechar o aplicativo e não o abrir novamente, o lote fica no celular.

A solução mínima é reprocessar a fila ao abrir o aplicativo, ao recuperar conectividade e ao retornar para a tela de chamada. A solução completa usa uma tarefa de background nativa, com limites de bateria e plataforma. Em todos os casos, o servidor deve continuar aceitando o mesmo `clientBatchId` de forma idempotente.

### 4.6 Médio — notificações push ainda não estão implementadas

Existe tabela `device_push_tokens` no schema, mas a busca no código não encontrou registro de token, solicitação de permissão, envio pelo Expo Notifications ou rotina de push. A tela `notifications.tsx` é uma caixa interna baseada na tabela `notifications`; ela não é uma notificação do sistema operacional.

Assim, atualmente o usuário recebe avisos dentro do aplicativo, e o WhatsApp é apenas aberto manualmente pelo link `wa.me`. Não existe envio automático de WhatsApp e não existe push real. Isso deve ser declarado no produto para evitar expectativa de que a coordenação receberá uma notificação fora do aplicativo.

### 4.7 Médio — envio de e-mail depende de configuração operacional

Os lembretes usam Resend em `server/reminder-email.ts`, enquanto alguns alertas de falha da sincronização usam a ponte Apps Script e `MailApp`. Para o Resend, não basta ter uma API key: é necessário um remetente aceito pelo provedor, normalmente associado a domínio verificado. O guia de implantação registra que remetente/domínio e agendamento ainda não estão ativos em produção.

O Apps Script possui quotas oficiais, inclusive limite diário de destinatários e limite de execução. Para contas de consumidor, a documentação informa 100 destinatários por dia para e-mail; para Google Workspace, 1.500 por dia. A documentação também informa limite de 6 minutos por execução. Esses limites são suficientes para um piloto pequeno, mas não devem ser tratados como capacidade ilimitada [4].

### 4.8 Médio — CORS, payload e observabilidade precisam de endurecimento

O servidor aceita payload JSON de até 50 MB, embora uma chamada de presença deva ser muito menor. Reduzir o limite para algo como 1–2 MB e validar tamanho, estrutura e número máximo de registros antes de processar reduz risco de abuso.

A ponte já usa HMAC, `LockService` e controle de lote, o que é positivo. Ainda assim, erros do Apps Script são devolvidos ao servidor em texto e alguns fluxos registram apenas uma mensagem genérica para o usuário. É recomendável registrar um identificador de correlação, o lote, a tentativa, o status HTTP e o erro sanitizado, sem gravar segredos ou tokens.

## 5. Situação da sincronização Google Sheets

A ponte Apps Script está bem estruturada para um piloto. Ela valida assinatura HMAC, abre a planilha por ID, cria as abas necessárias, usa `LockService` para evitar escrita concorrente e registra o lote em `Controle_Sincronização`. O servidor também cria `syncBatches`, registra eventos e evita reenviar lotes marcados como `SYNCED`.

A homologação consultada pela API do Google Sheets apresenta as seguintes abas relevantes: `Turmas`, `Alunos`, `Aulas`, `Presenças` e `Controle_Sincronização`. O controle contém dois lotes sincronizados. A aba `Presenças` contém as colunas `Lote`, `ID da aula`, `Código da turma`, `Data`, `ID do aluno`, `Aluno`, `Situação`, `Observação` e `Registrado em`.

A documentação oficial do método `spreadsheets.values.append` confirma que a API do Sheets pode acrescentar linhas a uma tabela, requer `spreadsheetId`, intervalo e `valueInputOption`, e aceita escopos de Drive ou Sheets [1]. A ponte atual usa o serviço nativo do Apps Script em vez de chamar diretamente essa API, mas o modelo de dados é compatível com uma migração posterior.

O principal ponto de atenção é que a idempotência atual é por lote. Isso impede duplicação do mesmo lote, mas não resolve automaticamente uma correção posterior da mesma aula. Se o professor enviar uma chamada, depois corrigir um aluno e enviar novamente com outro lote, o Apps Script acrescentará novas linhas. Para auditoria isso é aceitável, mas para uma visão final será necessário escolher entre atualização por chave composta `(lessonId, studentId)` ou uma tabela de eventos com uma visão que selecione o último estado.

## 6. Melhor arquitetura para servidor próprio

### Opção recomendada: servidor como núcleo + Google Sheets API por Service Account

O aplicativo deve continuar usando o servidor para login, permissões, banco, fila, auditoria e regras de negócio. A sincronização deve ocorrer em um worker ou job do próprio servidor, utilizando uma Service Account com escopo mínimo de Sheets. A planilha deve ser compartilhada como editora com o e-mail da Service Account; não é necessário pedir login Google a cada professor.

A documentação oficial descreve Service Accounts como identidades do aplicativo para chamadas servidor-servidor e recomenda usar bibliotecas oficiais em vez de assinar JWT manualmente [2]. Essa opção é a mais previsível para um servidor próprio: o aplicativo não depende da sessão Google do professor, o servidor controla retries e logs, e o acesso à planilha fica concentrado em uma credencial técnica protegida por variável secreta ou secret manager.

A implementação deve usar `batchUpdate` ou `values.update` para registros que precisam ser corrigidos e `values.append` apenas quando a operação for realmente append-only. O servidor deve gravar uma chave idempotente, por exemplo `classId + lessonDate + studentExternalId`, e manter no banco o estado da sincronização. Em caso de erro, a chamada permanece salva no banco e entra em retry com backoff.

### Opção de curto prazo: manter Apps Script como ponte

A ponte atual é a forma mais simples de continuar sem alterar a autenticação Google do aplicativo. Apps Script executado como proprietário centraliza a permissão da planilha, o que é exatamente o que a documentação descreve para Web Apps [3]. Ela é adequada para piloto, baixo volume e envio de e-mail com MailApp, desde que quotas, proprietário e implantação sejam monitorados.

O risco é concentrar a operação em uma implantação e em quotas de uma conta Google. A ponte também precisa receber a lógica de atualização da matriz antiga, caso essa seja uma exigência. Para reduzir o risco, o app deve tratar Apps Script como integração assíncrona: salvar primeiro no banco, depois sincronizar; nunca perder o registro local porque a planilha ficou indisponível.

### Opção não recomendada: cada professor autorizar a própria planilha

Essa opção exigiria OAuth individual, consentimento, tokens de refresh e gerenciamento de permissões por professor. Ela aumenta a complexidade, pode exigir verificação de consentimento e torna a operação dependente de contas pessoais. Não é adequada para o objetivo atual, no qual todos os professores registram presença em uma base institucional.

## 7. Notificações gratuitas ou de baixo custo

Para e-mail, a alternativa mais simples sem custo adicional imediato é continuar usando Apps Script `MailApp` dentro das quotas. Isso deve ser reservado para lembretes de baixo volume e alertas críticos. Resend é tecnicamente mais observável, mas exige configurar remetente/domínio e aceitar os limites do plano utilizado.

Para notificações no aplicativo, o caminho é implementar Expo Push Notifications: registrar o token do aparelho após login, armazená-lo na tabela já existente, enviar o push a partir do servidor e remover tokens inválidos. A infraestrutura de push pode ser gratuita em volume pequeno, mas Android e principalmente iOS exigem configuração de credenciais e testes em aplicativo instalado; a presença de uma tabela no banco não significa que o recurso já esteja pronto.

Para WhatsApp, não existe uma forma institucional, automática e confiável totalmente gratuita usando a conta normal do WhatsApp. O código atual apenas abre uma mensagem preenchida no aplicativo por meio de `wa.me`. Para envio automático, seria necessária uma API oficial ou um provedor, normalmente com custo e regras de aprovação. Portanto, o produto deve oferecer o resumo copiável/manual no WhatsApp e usar e-mail ou push para alertas automáticos.

## 8. Plano de correção priorizado

| Prioridade | Ação | Critério de aceite |
|---|---|---|
| P0 | Restringir CORS às origens conhecidas e reduzir limite JSON | Origem externa não recebe CORS com credenciais; app publicado continua funcionando |
| P0 | Corrigir parsing de `YYYY-MM-DD` | A mesma aula aparece na mesma data em São Paulo, Android, Web e servidor |
| P0 | Definir se a fonte oficial será a aba normalizada ou a matriz original | Documentação e tela mostram onde o registro efetivamente é gravado |
| P1 | Fazer testes externos opcionais e criar mocks locais | `pnpm test` passa sem depender de Internet; teste externo separado identifica indisponibilidade |
| P1 | Implementar atualização idempotente por aula/aluno | Reenvio corrigido atualiza o estado final sem linhas conflitantes ou relatório de último estado |
| P1 | Ativar retry automático no servidor e ao recuperar conexão | Falha transitória não exige que o professor descubra manualmente a fila |
| P1 | Configurar remetente do e-mail e job de produção | Lembrete controlado chega ao professor e falha gera alerta administrativo |
| P2 | Implementar push real | Token é registrado, aviso aparece fora do app e token inválido é removido |
| P2 | Limpar avisos de lint e completar edição de turma/professor | Lint sem avisos e cada botão exposto possui fluxo testado |
| P2 | Migrar gradualmente de Apps Script para Sheets API | Primeiro lote gravado via Service Account em planilha de homologação sem perda ou duplicidade |

## 9. Conclusão

O projeto está em uma situação boa para um piloto controlado. O núcleo de chamada, autenticação local, administração e sincronização com uma planilha normalizada já está implementado e foi validado com dados reais de homologação. O build e os testes locais estão saudáveis.

O ponto mais importante para a decisão de negócio é esclarecer se a equipe aceita trabalhar com as novas abas normalizadas. Se a resposta for sim, a ponte atual pode ser usada no piloto após corrigir CORS, datas e testes externos. Se a equipe precisa que a matriz visual antiga de `Página1` seja atualizada, essa regra ainda não foi implementada e deve ser tratada como requisito específico, não como detalhe de integração.

Para o servidor próprio, a arquitetura final mais segura é servidor + banco + fila idempotente + Google Sheets API usando Service Account, com Apps Script mantido apenas onde trouxer valor, como relatórios ou e-mail de pequeno volume. Essa arquitetura evita login Google repetido para professores, mantém os dados primeiro no servidor e deixa a planilha como destino sincronizado, não como único banco de dados.

## Referências

[1]: https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/append "Google Sheets API — values.append"

[2]: https://developers.google.com/identity/protocols/oauth2/service-account "Google OAuth 2.0 — Service Accounts"

[3]: https://developers.google.com/apps-script/guides/web "Apps Script — Web Apps"

[4]: https://developers.google.com/apps-script/guides/services/quotas "Apps Script — Quotas"

[5]: https://developers.google.com/apps-script/reference/lock/lock-service "Apps Script — LockService"

[6]: https://developers.google.com/apps-script/guides/triggers/installable "Apps Script — Installable Triggers"
