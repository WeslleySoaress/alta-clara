# Matriz de permissões

Implementada em [`src/server/authz/politicas.ts`](../src/server/authz/politicas.ts) e aplicada nos serviços de domínio a cada operação. **Negação por padrão.** O ator é montado no servidor a partir da sessão; papel, instituição, paciente e vínculo **nunca** vêm do cliente. A escolha "Sou paciente / cuidador / profissional" no login só muda textos.

Legenda: ✅ permitido · ❌ negado

| Ação | Paciente | Cuidador | Enfermagem | Revisor clínico | Admin institucional | Auditor |
|---|---|---|---|---|---|---|
| Ver plano publicado e histórico de versões | ✅ só o próprio | ✅ se autorizado (`ver_plano`), não revogado nem expirado | ✅ atendimentos com vínculo assistencial | ✅ própria instituição | ❌ | ❌ |
| Ver rascunho / em revisão | ❌ | ❌ | ✅ com vínculo | ✅ mesma instituição | ❌ | ❌ |
| Criar rascunho / nova versão / editar | ❌ | ❌ | ✅ com vínculo | ✅ mesma instituição | ❌ | ❌ |
| Aprovar e publicar | ❌ | ❌ | ❌ | ✅ **exceto o autor da versão** | ❌ | ❌ |
| Gerar QR de ativação | ❌ | ❌ | ✅ com vínculo | ✅ mesma instituição | ❌ | ❌ |
| Exportar FHIR (sandbox) | ❌ | ❌ | ✅ com vínculo | ✅ mesma instituição | ❌ | ❌ |
| Registrar dose relatada | ✅ próprio plano vigente | ✅ se autorizado (`registrar_dose`) | ❌ | ❌ | ❌ | ❌ |
| Responder confirmação de entendimento | ✅ | ✅ se autorizado | ❌ | ❌ | ❌ | ❌ |
| Pedir ajuda não urgente | ✅ | ✅ se autorizado | ❌ | ❌ | ❌ | ❌ |
| Convidar, listar e revogar cuidadores | ✅ só para si | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ligar/desligar os próprios lembretes | ✅ | ✅ | — | — | — | — |
| Ver e resolver pendências | ❌ | ❌ | ✅ pacientes da sua equipe | ✅ própria instituição | ❌ | ❌ |
| Desativar/reativar vínculos profissionais | ❌ | ❌ | ❌ | ❌ | ✅ própria instituição, nunca o próprio | ❌ |
| Consultar auditoria (sem conteúdo clínico) | ❌ | ❌ | ❌ | ❌ | ✅ própria instituição | ✅ própria instituição |
| Sugestão de linguagem simples (IA) | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |

Regras transversais:

- **Profissional sem MFA ativo não opera.** Desativar o vínculo encerra **todas** as sessões da pessoa.
- **Isolamento institucional** em toda regra profissional; modelos só da própria instituição.
- **Estado do plano:** só `rascunho` é editável; só `em_revisao` é aprovável; publicado é imutável.
- **Não encontrado e não autorizado respondem igual** (404) e a tentativa negada vai para a auditoria.
- Esconder botões é só conveniência: cada Server Action e Route Handler revalida sessão, perfil e permissão.
- **Provisionamento de profissionais:** contas e vínculos são criados pela instituição (nesta demonstração, pelo script de dados). Não existe cadastro aberto nem autoatribuição de papel.
