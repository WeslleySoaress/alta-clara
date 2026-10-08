# Pesquisa de referências — Alta Clara

Data da consulta de todas as fontes: **2026-10-03**. Só foram usadas páginas públicas. Em cada linha, "Prática documentada" é o que a fonte diz e "Proposta para o Alta Clara" é a nossa adaptação. Nenhuma tecnologia interna é atribuída a hospitais além do que está publicado na página, e não reproduzimos marcas nem telas.

## Tabela de evidências

| # | Recurso observado (Prática documentada) | Fonte (link) | Data da consulta | Adaptação ao Alta Clara (Proposta) | Limite da evidência |
|---|---|---|---|---|---|
| 1 | Verificação em duas etapas obrigatória ("TFA can't be turned off"). O código é enviado por SMS ou e-mail, e a opção "confiar neste dispositivo" vale por 365 dias. | [Cleveland Clinic – login e ativação](https://my.clevelandclinic.org/resources/mychart-login-and-activation-issues) | 2026-10-03 | Ter MFA desde o MVP para profissionais. Para pacientes, oferecer MFA e passkey. O "dispositivo confiável" pode existir, mas com prazo menor, porque NIST AAL2 pede reautenticação a cada 24 h. | Página de ajuda ao usuário. Não descreve a política de segurança completa nem os critérios técnicos. |
| 2 | Login com passkey (digital, rosto ou PIN), com opções para criar, renomear e remover passkeys. Bloqueio automático depois de várias tentativas falhas e desbloqueio após algum tempo. | [Cleveland Clinic – login e ativação](https://my.clevelandclinic.org/resources/mychart-login-and-activation-issues) | 2026-10-03 | Usar WebAuthn/passkeys como opção resistente a phishing, com uma tela de gestão de passkeys. Limitar tentativas por conta. | A página não informa o número de tentativas nem a duração do bloqueio. |
| 3 | Ativação por link de e-mail válido por 30 minutos ou por código de ativação. | [Cleveland Clinic – login e ativação](https://my.clevelandclinic.org/resources/mychart-login-and-activation-issues) | 2026-10-03 | Convite de paciente ou cuidador por link de uso único que expira em pouco tempo (por exemplo, 30 min a 24 h). | Não dá para saber como o token é gerado nem como é validado. |
| 4 | Resumo da visita ou da internação disponível para baixar, imprimir ou enviar. "When you leave the ED or hospital, you'll find important information about your visit." | [Cleveland Clinic – FAQ do portal](https://my.clevelandclinic.org/online-services/mychart/faq) | 2026-10-03 | O plano de alta publicado fica disponível para o paciente e pode ser impresso ou baixado em PDF. | A página não descreve o conteúdo nem o formato do resumo. |
| 5 | Acesso de familiares/proxy. Pais ou responsáveis legais acessam a conta de menores (até 17 anos). Para adultos é preciso "legal authorization". Aos 18 anos, o acesso do pai ou da mãe é removido automaticamente. | [Cleveland Clinic – FAQ do portal](https://my.clevelandclinic.org/online-services/mychart/faq) | 2026-10-03 | O cuidador é convidado pelo próprio paciente, com consentimento registrado e possibilidade de revogação. O acesso pode ser só leitura e tem validade. | Regras legais dos EUA. No Brasil é preciso validar com a LGPD e com assessoria jurídica. |
| 6 | Proxy por convite ("proxy invite") feito pelo paciente, com idade mínima de 18 anos para o proxy. Login com senha e verificação em duas etapas (e-mail, SMS ou app autenticador), além de passkey, Face ID ou impressão digital. A recuperação de conta passa pela verificação em duas etapas. | [Mayo Clinic – FAQ Patient Online Services](https://onlineservices.mayoclinic.org/dt/Authentication/Login/StandardFile?option=Faq) | 2026-10-03 | Fluxo "Convidar cuidador" iniciado pelo paciente. O cuidador precisa ter 18 anos ou mais. A recuperação de senha exige um segundo fator. | O WebFetch recebeu HTTP 403. O conteúdo foi lido com curl e navegador simulado (HTTP 200) e extraído do HTML bruto. |
| 7 | A verificação de identidade depende do acesso pedido. Com e-mail e senha se usam muitos serviços, mas para ver o prontuário é preciso "high level proof of who you are" (documento com foto ou dados do GP). | [NHS login – configurar](https://help.login.nhs.uk/setupnhslogin) | 2026-10-03 | Verificação proporcional: o cuidador com convite vê só o plano compartilhado, e o profissional precisa de verificação reforçada antes de publicar planos. | A página não dá nome a "níveis" formais. A proporcionalidade é inferida do texto. |
| 8 | RED tem 12 componentes. O After Hospital Care Plan (AHCP) inclui lista de medicamentos com dose e horários, alergias, consultas dos próximos 30 dias, calendário de 30 dias e o que fazer se surgir um problema (o que é emergência e para quem ligar). | [AHRQ – RED Tool 3](https://www.ahrq.gov/patient-safety/settings/hospital/red/toolkit/redtool3.html) | 2026-10-03 | Estrutura do plano: medicamentos e horários, cuidados em casa, sinais de alerta (emergência e não emergência) com contatos, próximas consultas e uma agenda de 30 dias. | O WebFetch recebeu HTTP 403. O conteúdo foi lido com curl (HTTP 200). O RED foi feito para hospitais dos EUA, com educador presencial. |
| 9 | Teach-back: "Ask patients to explain in their own words… Continue instruction until patients correctly teach-back the plan". Envolver família e cuidadores. Material compreensível "even for patients or caregivers with limited health literacy". | [AHRQ – RED Tool 3](https://www.ahrq.gov/patient-safety/settings/hospital/red/toolkit/redtool3.html) | 2026-10-03 | Linguagem simples, com no máximo 3 pontos-chave por bloco. Checklist "Entendi / tenho dúvida" e campo de perguntas para a próxima consulta. | No RED o teach-back é presencial. A versão digital é só um apoio e não substitui a conversa. |
| 10 | Versão estável atual do ASVS: 5.0.0. | [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) | 2026-10-03 | Usar o ASVS 5.0.0 como checklist de requisitos de segurança (autenticação, sessão, controle de acesso). | A página não mostra a data de lançamento. Não foi escolhido um nível de ASVS. |
| 11 | Senhas, bloqueio de tentativas, phishing-resistance e timeouts por AAL (números abaixo). | [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html) | 2026-10-03 | Política de senha e de sessão do Alta Clara baseada em AAL2 (ver números concretos). | Norma do governo dos EUA. Aqui serve como boa prática, não como exigência legal. |
| 12 | SC 3.3.8 (AA): nenhuma etapa do login pode exigir teste de função cognitiva sem alternativa. Deve funcionar com gerenciador de senhas e colar. | [WCAG 2.2 – 3.3.8](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html) | 2026-10-03 | Campos com `autocomplete` correto, colar sempre permitido (inclusive no OTP), passkey e link por e-mail. Nada de CAPTCHA de transcrição. | O documento "Understanding" é informativo. O texto normativo é o da WCAG 2.2. |
| 13 | MedicationRequest no FHIR R5 (5.0.0), com `dosageInstruction` e `effectiveDosePeriod`. SMART App Launch 2.2.0, baseado em FHIR R4 e OAuth 2.0. | [FHIR MedicationRequest](https://hl7.org/fhir/medicationrequest.html) · [SMART App Launch](https://hl7.org/fhir/smart-app-launch/) | 2026-10-03 | Modelar medicamentos e horários de forma compatível com MedicationRequest/Dosage. Integração SMART fica para uma etapa futura e é opcional. | Há uma diferença: a especificação base atual é R5, mas o SMART 2.2.0 se baseia em R4. |
| 14 | Timeout por inatividade de 2–5 min (aplicações de alto valor) ou 15–30 min (baixo risco). Timeout absoluto de 4–8 h para uso de um dia de trabalho. Aplicação no servidor. ID de sessão renovado após o login. Cookies `Secure`, `HttpOnly`, `SameSite` e prefixo `__Host-`. | [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) | 2026-10-03 | Sessão do profissional: inatividade de 15 min e absoluta de 8 h. Paciente e cuidador: inatividade de 30 min e reautenticação a cada 24 h (AAL2). Tudo controlado no servidor. | São faixas sugeridas, não obrigatórias. Os valores do Alta Clara são decisão de projeto. |

## Números e requisitos concretos

**NIST SP 800-63B-4** — <https://pages.nist.gov/800-63-4/sp800-63b.html>
- A senha usada como fator único deve ter **mínimo de 15 caracteres** (SHALL).
- A senha usada só dentro de MFA deve ter **mínimo de 8 caracteres** (SHALL).
- O tamanho máximo permitido deve ser de **pelo menos 64 caracteres** (SHOULD).
- É preciso comparar a senha com uma **blocklist** de senhas comuns, esperadas ou vazadas.
- **Não se pode exigir regras de composição** (mistura de tipos de caractere) (SHALL NOT).
- **Não se pode exigir troca periódica** (SHALL NOT). A troca só é obrigatória se houver evidência de comprometimento.
- Rate limiting: no máximo **100 tentativas falhas consecutivas** por autenticador e por conta. Depois disso, o autenticador é desativado.
- Phishing-resistance: no **AAL2** deve ser oferecida pelo menos uma opção resistente a phishing (SHALL). No **AAL3** ela é obrigatória, com chave privada não exportável.
- Reautenticação: no **AAL1**, o timeout total deve ser de no máximo 30 dias (SHOULD). No **AAL2**, total de no máximo **24 h** (SHOULD) e inatividade de no máximo **1 h** (SHOULD). No **AAL3**, total de no máximo **12 h** (SHALL) e inatividade de no máximo **15 min** (SHOULD).

**OWASP Session Management Cheat Sheet** — <https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html>
- O timeout por inatividade fica entre **2–5 min** em aplicações de alto valor e **15–30 min** nas de baixo risco.
- O timeout absoluto fica entre **4–8 h** para uso ao longo de um dia de trabalho.
- Os timeouts devem ser aplicados **no servidor**, e o ID de sessão deve ser **regenerado após a autenticação**.
- Atributos de cookie: `Secure`, `HttpOnly` e `SameSite=Strict` (preferido) ou `Lax`, com prefixo `__Host-`.

**OWASP ASVS** — <https://owasp.org/www-project-application-security-verification-standard/>
- A versão estável atual é a **5.0.0** ("Get the latest stable version of the ASVS (5.0.0)").

**WCAG 2.2 — SC 3.3.8 Accessible Authentication (Minimum), nível AA** — <https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html>
- Nenhuma etapa de autenticação pode exigir um teste de função cognitiva (lembrar senha, resolver quebra-cabeça, transcrever código) a menos que haja uma das exceções: **Alternativa**, **Mecanismo de apoio** (por exemplo, gerenciador de senhas ou colar), **Reconhecimento de objetos** ou **Conteúdo pessoal**.
- Não se pode bloquear o colar nem o preenchimento automático. Contam como conformes: passkeys/WebAuthn, link por e-mail, OAuth e MFA com opções que não exigem transcrição.

**HL7 FHIR** — <https://hl7.org/fhir/medicationrequest.html> · <https://hl7.org/fhir/smart-app-launch/>
- A especificação base publicada é **FHIR R5 (v5.0.0)**. MedicationRequest tem **Maturity Level 4** e status Trial Use.
- **SMART App Launch v2.2.0** (STU 2.2) se baseia em **FHIR R4** e usa OAuth 2.0, scopes (por exemplo, `user/Encounter.rs`) e contexto de lançamento do paciente.

## Limitações da pesquisa

- **Mayo Clinic FAQ** e **AHRQ RED Tool 3**: o WebFetch recebeu **HTTP 403**. As duas páginas foram baixadas com curl usando um user-agent de navegador (HTTP 200) e lidas a partir do HTML bruto. O conteúdo citado na tabela vem desse texto.
- **Cleveland Clinic** (as 2 páginas): o conteúdo foi lido por meio de um resumo automático da página. As citações entre aspas vieram desse resumo e não foram conferidas linha a linha no HTML.
- **NHS login**: a página não define "níveis" formais de verificação. A proporcionalidade (acesso básico com e-mail e senha, prontuário com prova de identidade forte) foi inferida do texto.
- **OWASP ASVS**: a página não informa a data de lançamento da versão 5.0.0.
- **FHIR**: a especificação base atual é R5, mas o SMART App Launch 2.2.0 se baseia em R4, o que deixa em aberto qual versão usar numa futura integração. A versão "current" do site pode mudar.
- **Aplicabilidade**: NIST, NHS e AHRQ são referências dos EUA e do Reino Unido. No Brasil, as decisões sobre acesso de cuidadores e consentimento precisam ser validadas contra a LGPD e as normas locais, o que esta pesquisa não cobriu.
- Os hospitais citados aparecem só como exemplos de prática pública. Nada foi dito sobre a tecnologia interna deles além do que as páginas publicam.
