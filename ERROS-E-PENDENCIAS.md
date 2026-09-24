# Erros, riscos e pendências — Plug Presença

**Data de referência:** 23 de setembro de 2026

Este documento resume os problemas encontrados na auditoria do aplicativo. O relatório completo contém contexto, evidências e alternativas de arquitetura em [RELATORIO-AUDITORIA-2026-09-23.md](./RELATORIO-AUDITORIA-2026-09-23.md).

As correções de CORS, datas civis, separação dos testes externos e avisos de lint foram iniciadas nesta etapa. Elas ainda precisam passar pela validação de build e pelo teste do domínio publicado.

## Situação geral

O projeto compila, os testes locais determinísticos passam e a sincronização com a planilha de homologação foi validada com dois lotes, incluindo texto com acentos. Isso não significa que o sistema esteja pronto para operação institucional. Os itens abaixo devem ser tratados antes de ampliar o uso.

## Correções prioritárias

| Prioridade | Problema | Impacto | Próxima ação |
|---|---|---|---|
| Alta | CORS aceita origens arbitrárias com credenciais | Uma origem externa pode tentar usar a sessão do navegador | **Correção aplicada no código:** lista explícita via `ALLOWED_ORIGINS`; validar no host e publicar |
| Alta | A ponte escreve nas abas normalizadas, mas não na matriz antiga `Página1` | A equipe pode olhar a planilha antiga e achar que a chamada não foi registrada | Decidir entre adotar as abas normalizadas, gerar `Relatório_Chamada` ou criar um adaptador específico para a matriz antiga |
| Alta | Strings `YYYY-MM-DD` podem sofrer deslocamento de fuso | A chamada pode abrir ou gravar no dia errado | Tratar a data como data civil e não como instante UTC; adicionar testes no fuso `America/Sao_Paulo` |
| Alta | Testes externos dependem diretamente de Apps Script e Resend | `pnpm test` pode falhar por timeout mesmo quando o código está correto | **Correção aplicada:** `pnpm test` é determinístico; `pnpm test:external` executa integrações reais |
| Média | Reenvio offline depende da abertura do app ou da ação do professor | Um lote pendente pode demorar a chegar ao servidor | Adicionar sincronização ao iniciar, ao recuperar a rede e por tarefa periódica no servidor |
| Média | Push notification ainda não está concluída | O professor não recebe alerta nativo imediato | Implementar registro de token, envio server-side, permissão e tratamento de token expirado |
| Média | WhatsApp abre uma mensagem, mas não envia automaticamente | A comunicação ainda depende de ação humana | Manter o atalho manual ou contratar uma API oficial; não automatizar por WhatsApp Web não oficial |
| Média | Painel não tem edição completa de turma, arquivamento e importação em lote | A coordenação pode precisar alterar muitos dados manualmente | Implementar edição, confirmação de arquivamento e importação CSV/XLSX com pré-visualização |
| Baixa | Existiam dois avisos de lint no painel administrativo | Indicavam código não utilizado e aumentavam a manutenção | **Correção aplicada:** removidos `Alert` e `updateTeacher` não utilizados |
| Baixa | Campo de aula usa texto `AAAA-MM-DD` | A digitação manual facilita erro | Trocar por seletor de data com validação do calendário da turma |

## Integração com Google Sheets

A sincronização atual usa um Web App Apps Script com assinatura HMAC. Essa integração foi validada em homologação e deve ser mantida no piloto. O lote é registrado no servidor antes do envio e possui controle de idempotência.

Para produção em servidor próprio, a evolução recomendada é usar a Google Sheets API com uma Service Account. A planilha deve ser compartilhada com o e-mail técnico da Service Account. A chave privada deve ficar no secret manager do host e nunca no repositório público.

A decisão sobre a matriz antiga é funcional, não apenas técnica. Se a escola continuar usando `Página1` como fonte oficial, o adaptador precisa localizar aluno, data e coluna correta. Se a escola aceitar o modelo normalizado, é preferível gerar uma aba de relatório visual sem alterar o histórico bruto.

## Testes mínimos antes do uso institucional

O responsável deve criar uma turma piloto e testar login administrativo, cadastro de professor, vínculo de turma, inclusão de aluno, remoção sem apagar histórico, chamada completa, correção de chamada, perda de conexão, reenvio, duplicidade, acentos, mudança de dia, falha da planilha e falha do e-mail.

Depois, deve confirmar que um professor não consegue consultar ou alterar turma de outro professor. Também deve verificar backup do banco, expiração de sessão, troca de senha inicial, origem CORS e HTTPS.

## Critério de liberação

O sistema pode ser usado em piloto quando os itens de prioridade alta estiverem mitigados ou formalmente aceitos pela coordenação. A liberação institucional deve aguardar a correção de CORS, a decisão sobre `Página1`, os testes de data e a configuração monitorada do reprocessamento.

## Referências

[1]: ./RELATORIO-AUDITORIA-2026-09-23.md "Relatório de auditoria técnica do Plug Presença"
[2]: ./HOSTING.md "Guia de hospedagem própria e troca de host"
