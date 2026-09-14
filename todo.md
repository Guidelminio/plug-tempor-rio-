# Plug Presença — acompanhamento de implementação

## Funcionalidades concluídas

- [x] Interface móvel para selecionar turma e data da aula.
- [x] Chamada em lote: presença, falta e justificativa em um único envio.
- [x] Inclusão e inativação de alunos, com preservação do histórico já lançado.
- [x] Regra que impede a inclusão retroativa de alunos em aulas anteriores à data de entrada.
- [x] Controle de acesso por e-mail da conta Google vinculada à turma.
- [x] Modelo de dados normalizado para turmas, alunos, aulas e registros de presença.
- [x] Backend tipado com validação de lote completo e testes automatizados.
- [x] Base de login Google nativo para Android/iOS.

## Preparado nesta etapa

- [x] Lembrete automático por e-mail para aulas não fechadas no mesmo dia.
- [x] Registro idempotente da execução diária de lembretes e alerta técnico para falhas de envio.
- [x] Endpoint seguro para tarefa agendada em produção.
- [x] Guia de implantação e configuração Google Cloud / serviço de e-mail.
- [x] Correção da publicação web: a interface Expo agora é servida no domínio público em vez de retornar 404.

## Pendências externas antes da distribuição

- [x] Autorizar acesso ao Google Cloud e criar os clientes OAuth Web/Android.
- [x] Criar e validar a chave Resend com permissão Sending access.
- [ ] Verificar um domínio de envio no Resend e definir `ATTENDANCE_EMAIL_FROM`.
- [ ] Definir `ATTENDANCE_ALERT_TO_EMAIL` para alertas da coordenação.
- [ ] Definir/importar as turmas e os e-mails dos professores autorizados.
- [ ] Gerar o APK de desenvolvimento com a chave cujo SHA-1 foi cadastrado.
- [ ] Publicar a versão de produção e ativar a rotina diária de lembretes.

## Padrões adotados

O aplicativo nunca exclui registros de presença. Ao retirar um aluno, ele deixa de aparecer em novas chamadas, mas continua visível nas aulas em que já possuía registro. Uma aula só é fechada quando cada aluno aplicável possui uma situação definida.
