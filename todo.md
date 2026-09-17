# Plug Presença — acompanhamento de implementação

## Funcionalidades concluídas

- [x] Interface móvel para selecionar turma, data e alunos de uma aula.
- [x] Chamada em lote: presença, falta e justificativa em um único envio.
- [x] Inclusão e inativação de alunos, com preservação do histórico já lançado.
- [x] Regra que impede a inclusão retroativa de alunos em aulas anteriores à data de entrada.
- [x] Banco de dados normalizado para contas, turmas, alunos, aulas, presenças, notificações e lotes de sincronização.
- [x] Login próprio por e-mail e senha, com senha protegida por `scrypt`, sessão revogável e troca obrigatória de senha temporária.
- [x] Conta administrativa inicial, criação de professores e criação de turmas com professores vinculados.
- [x] Caixa de notificações interna para confirmação, falha de sincronização e avisos da coordenação.
- [x] Fila offline no aparelho: uma chamada sem conexão fica pendente e pode ser reenviada com o mesmo identificador.
- [x] Botão manual para compartilhar o resumo da chamada pelo WhatsApp, sem automação de mensagens.
- [x] Ponte Apps Script publicada para Google Sheets, com assinatura HMAC, idempotência e suporte a caracteres em português.
- [x] Cópia Google Sheets de homologação criada a partir da planilha de presença e validada com dois lotes técnicos.
- [x] Endpoint seguro de reprocessamento de sincronizações pendentes.
- [x] Correção da publicação web: a interface Expo agora é servida no domínio público em vez de retornar 404.

## Configuração já validada

- [x] Conta de administrador inicial cadastrada como segredo de produção.
- [x] URL e segredo da ponte Apps Script cadastrados como segredos de produção.
- [x] Web App Apps Script versão 2 publicado.
- [x] Abas `Turmas`, `Alunos`, `Aulas`, `Presenças` e `Controle_Sincronização` criadas na planilha de homologação.
- [x] Teste de assinatura, teste de sincronização e leitura de confirmação no Google Sheets concluídos.

## Pendências antes da distribuição a professores

- [ ] Substituir a planilha de homologação por uma planilha definitiva aprovada pela coordenação, ajustando somente o `SPREADSHEET_ID` no Apps Script e publicando nova versão.
- [ ] Criar as contas reais dos professores, criar turmas e vincular os acessos no painel administrativo.
- [ ] Configurar a tarefa agendada de produção para reprocessar lotes pendentes e lembretes de chamadas não fechadas.
- [ ] Realizar teste de ponta a ponta no APK Android em um aparelho real e gerar a distribuição de teste.
- [ ] Definir a política institucional de e-mails de lembrete; o Apps Script já possui a função de envio, mas o destinatário e a rotina precisam ser aprovados pela coordenação.

## Padrões adotados

O aplicativo nunca exclui registros de presença. Ao retirar um aluno, ele deixa de aparecer em novas chamadas, mas continua visível nas aulas em que já possuía registro. O banco do aplicativo é a fonte de verdade; Google Sheets recebe lotes assinados e idempotentes como sincronização e relatório. Uma falha de rede ou da planilha não apaga a chamada: o lote fica pendente para reenvio.
