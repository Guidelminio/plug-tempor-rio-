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

- [ ] Lembrete automático por e-mail para aulas não fechadas no mesmo dia.
- [ ] Registro idempotente da execução diária de lembretes e alerta técnico para falhas de envio.
- [ ] Endpoint seguro para tarefa agendada em produção.
- [ ] Guia de implantação e configuração Google Cloud / serviço de e-mail.

## Pendências externas antes da distribuição

- [ ] Autorizar acesso ao Google Cloud ou fornecer os Client IDs OAuth do Google.
- [ ] Informar uma chave de serviço de e-mail transacional e um remetente verificado.
- [ ] Definir/importar as turmas e os e-mails dos professores autorizados.
- [ ] Gerar o APK de desenvolvimento para obter/cadastrar o SHA-1 Android.
- [ ] Publicar a versão de produção e ativar a rotina diária de lembretes.

## Padrões adotados

O aplicativo nunca exclui registros de presença. Ao retirar um aluno, ele deixa de aparecer em novas chamadas, mas continua visível nas aulas em que já possuía registro. Uma aula só é fechada quando cada aluno aplicável possui uma situação definida.
