# Ponte Google Sheets — Plug Presença

Este diretório contém o `Code.gs` que deve ser criado em um projeto Apps Script associado **a uma cópia de homologação** da planilha da escola. A planilha original nunca deve ser apagada ou substituída durante a implantação.

## O que o script faz

O Web App recebe lotes de presença enviados pelo servidor do Plug Presença, verifica uma assinatura HMAC, impede o reprocessamento do mesmo lote e registra os dados em abas normalizadas. Também pode enviar e-mails de alerta usando a conta Google que autorizou o script.

As abas criadas automaticamente são `Turmas`, `Alunos`, `Aulas`, `Presenças` e `Controle_Sincronização`. A aba de presenças contém uma linha por aluno e aula, preservando o histórico inclusive quando um aluno for removido das chamadas futuras.

## Instalação

1. A cópia de homologação atualmente vinculada à ponte é [Plug Presença — Homologação — Turma 1](https://docs.google.com/spreadsheets/d/1sutuKsvCeJD3yJUkUcET-wml8aGUR2IjTGLJdD4DZAo/edit). Para uma implantação real, crie uma cópia aprovada pela coordenação e troque apenas `SPREADSHEET_ID` no script antes de publicar.
2. Substitua o conteúdo de `Code.gs` pelo arquivo deste diretório e salve.
3. Em **Configurações do projeto → Propriedades do script**, crie `PLUG_PRESENCA_SYNC_SECRET` com uma chave aleatória longa. A mesma chave deverá ser registrada apenas no segredo `APPS_SCRIPT_SYNC_SECRET` do servidor.
4. Execute `setupSheets` uma vez no editor e autorize acesso ao Sheets e envio de e-mail. Confirme que as cinco abas foram criadas.
5. Use **Implantar → Nova implantação → Aplicativo da web**. Execute como a conta institucional proprietária da planilha e escolha acesso restrito ao servidor conforme a política da escola. Copie a URL de implantação para o segredo `APPS_SCRIPT_SYNC_URL` do servidor.
6. Faça um teste de homologação: crie uma turma piloto, envie uma chamada e confirme que `Controle_Sincronização` contém somente uma linha ao reenviar o mesmo lote.

## Segredos e permissões

Nunca copie o segredo HMAC para o APK, para uma célula da planilha ou para uma conversa. O celular conversa apenas com o servidor. O servidor assina a mensagem e o Apps Script verifica a assinatura antes de escrever ou enviar e-mail.

O e-mail é enviado pela conta Google que publicou o Apps Script. Portanto, use uma conta institucional e revise as cotas de envio dessa conta. Se o serviço de e-mail atingir uma cota ou estiver indisponível, o aplicativo mantém a chamada salva no banco e mostra a notificação de pendência.

## Operação

O banco do aplicativo é a fonte de verdade. O Apps Script é um destino de sincronização e relatório. Uma falha na planilha nunca deve apagar ou invalidar uma chamada já recebida pelo aplicativo; o lote permanecerá como pendente para tentativa posterior. A assinatura usa JSON UTF-8 codificado em Base64 padrão para suportar com segurança nomes em português, acentos e observações.
