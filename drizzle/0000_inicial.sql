CREATE TYPE "public"."papel_profissional" AS ENUM('enfermagem', 'revisor', 'admin', 'auditor');--> statement-breakpoint
CREATE TYPE "public"."resultado_auditoria" AS ENUM('permitido', 'negado', 'erro');--> statement-breakpoint
CREATE TYPE "public"."situacao_dose" AS ENUM('relatou_tomada', 'nao_tomou', 'duvida');--> statement-breakpoint
CREATE TYPE "public"."status_plano" AS ENUM('rascunho', 'em_revisao', 'publicado', 'substituido', 'encerrado');--> statement-breakpoint
CREATE TYPE "public"."tipo_convite" AS ENUM('paciente', 'cuidador');--> statement-breakpoint
CREATE TABLE "atendimento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instituicao_id" uuid NOT NULL,
	"paciente_id" uuid NOT NULL,
	"procedimento" text NOT NULL,
	"unidade" text NOT NULL,
	"admissao_em" date NOT NULL,
	"alta_prevista_em" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ocorrido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ator_user_id" text,
	"instituicao_id" uuid,
	"acao" text NOT NULL,
	"recurso_tipo" text,
	"recurso_id" text,
	"resultado" "resultado_auditoria" NOT NULL,
	"detalhes" jsonb
);
--> statement-breakpoint
CREATE TABLE "autorizacao_cuidador" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paciente_id" uuid NOT NULL,
	"cuidador_user_id" text NOT NULL,
	"escopo" jsonb NOT NULL,
	"concedido_por" text NOT NULL,
	"convite_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_em" timestamp with time zone,
	"revogado_em" timestamp with time zone,
	"revogado_por" text
);
--> statement-breakpoint
CREATE TABLE "convite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_convite" NOT NULL,
	"instituicao_id" uuid NOT NULL,
	"paciente_id" uuid NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"email_destino" text NOT NULL,
	"escopo" jsonb,
	"criado_por" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"revogado_em" timestamp with time zone,
	"sessao_ativacao_hash" "bytea",
	"codigo_hash" "bytea",
	"codigo_expira_em" timestamp with time zone,
	"codigo_tentativas" integer DEFAULT 0 NOT NULL,
	"codigo_verificado_em" timestamp with time zone,
	"consumido_em" timestamp with time zone,
	"consumido_por" text
);
--> statement-breakpoint
CREATE TABLE "equipe_atendimento" (
	"atendimento_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instituicao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"telefone" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mensagem_dev" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"para" text NOT NULL,
	"assunto" text NOT NULL,
	"corpo" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modelo_protocolo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instituicao_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"versao" integer NOT NULL,
	"conteudo" jsonb NOT NULL,
	"sintetico" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paciente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instituicao_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"data_nascimento" date NOT NULL,
	"prontuario" text NOT NULL,
	"email_contato" text NOT NULL,
	"user_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plano" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instituicao_id" uuid NOT NULL,
	"atendimento_id" uuid NOT NULL,
	"paciente_id" uuid NOT NULL,
	"versao" integer NOT NULL,
	"status" "status_plano" DEFAULT 'rascunho' NOT NULL,
	"conteudo" jsonb NOT NULL,
	"modelo_id" uuid,
	"motivo_alteracao" text,
	"autor_id" text NOT NULL,
	"revisor_id" text,
	"enviado_revisao_em" timestamp with time zone,
	"publicado_em" timestamp with time zone,
	"substituido_em" timestamp with time zone,
	"revisao" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registro_dose" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plano_id" uuid NOT NULL,
	"paciente_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"data" date NOT NULL,
	"horario" text NOT NULL,
	"situacao" "situacao_dose" NOT NULL,
	"observacao" text,
	"registrado_por" text NOT NULL,
	"registrado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vinculo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"instituicao_id" uuid NOT NULL,
	"papel" "papel_profissional" NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"concedido_por" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"desativado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"ultima_atividade" timestamp,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"two_factor_enabled" boolean DEFAULT false,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_instituicao_id_instituicao_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_paciente_id_paciente_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."paciente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autorizacao_cuidador" ADD CONSTRAINT "autorizacao_cuidador_paciente_id_paciente_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."paciente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autorizacao_cuidador" ADD CONSTRAINT "autorizacao_cuidador_cuidador_user_id_user_id_fk" FOREIGN KEY ("cuidador_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autorizacao_cuidador" ADD CONSTRAINT "autorizacao_cuidador_concedido_por_user_id_fk" FOREIGN KEY ("concedido_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autorizacao_cuidador" ADD CONSTRAINT "autorizacao_cuidador_convite_id_convite_id_fk" FOREIGN KEY ("convite_id") REFERENCES "public"."convite"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autorizacao_cuidador" ADD CONSTRAINT "autorizacao_cuidador_revogado_por_user_id_fk" FOREIGN KEY ("revogado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convite" ADD CONSTRAINT "convite_instituicao_id_instituicao_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convite" ADD CONSTRAINT "convite_paciente_id_paciente_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."paciente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convite" ADD CONSTRAINT "convite_criado_por_user_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convite" ADD CONSTRAINT "convite_consumido_por_user_id_fk" FOREIGN KEY ("consumido_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipe_atendimento" ADD CONSTRAINT "equipe_atendimento_atendimento_id_atendimento_id_fk" FOREIGN KEY ("atendimento_id") REFERENCES "public"."atendimento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipe_atendimento" ADD CONSTRAINT "equipe_atendimento_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modelo_protocolo" ADD CONSTRAINT "modelo_protocolo_instituicao_id_instituicao_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paciente" ADD CONSTRAINT "paciente_instituicao_id_instituicao_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paciente" ADD CONSTRAINT "paciente_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano" ADD CONSTRAINT "plano_instituicao_id_instituicao_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano" ADD CONSTRAINT "plano_atendimento_id_atendimento_id_fk" FOREIGN KEY ("atendimento_id") REFERENCES "public"."atendimento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano" ADD CONSTRAINT "plano_paciente_id_paciente_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."paciente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano" ADD CONSTRAINT "plano_modelo_id_modelo_protocolo_id_fk" FOREIGN KEY ("modelo_id") REFERENCES "public"."modelo_protocolo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano" ADD CONSTRAINT "plano_autor_id_user_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plano" ADD CONSTRAINT "plano_revisor_id_user_id_fk" FOREIGN KEY ("revisor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registro_dose" ADD CONSTRAINT "registro_dose_plano_id_plano_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."plano"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registro_dose" ADD CONSTRAINT "registro_dose_paciente_id_paciente_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."paciente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registro_dose" ADD CONSTRAINT "registro_dose_registrado_por_user_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculo" ADD CONSTRAINT "vinculo_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculo" ADD CONSTRAINT "vinculo_instituicao_id_instituicao_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculo" ADD CONSTRAINT "vinculo_concedido_por_user_id_fk" FOREIGN KEY ("concedido_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "atendimento_paciente_id_index" ON "atendimento" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "auditoria_instituicao_id_ocorrido_em_index" ON "auditoria" USING btree ("instituicao_id","ocorrido_em");--> statement-breakpoint
CREATE INDEX "auditoria_ator_user_id_ocorrido_em_index" ON "auditoria" USING btree ("ator_user_id","ocorrido_em");--> statement-breakpoint
CREATE UNIQUE INDEX "cuidador_ativo_unico" ON "autorizacao_cuidador" USING btree ("paciente_id","cuidador_user_id") WHERE revogado_em is null;--> statement-breakpoint
CREATE UNIQUE INDEX "convite_token_hash_index" ON "convite" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "convite_sessao_ativacao_hash_index" ON "convite" USING btree ("sessao_ativacao_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "equipe_atendimento_atendimento_id_user_id_index" ON "equipe_atendimento" USING btree ("atendimento_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paciente_instituicao_id_prontuario_index" ON "paciente" USING btree ("instituicao_id","prontuario");--> statement-breakpoint
CREATE INDEX "paciente_user_id_index" ON "paciente" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plano_atendimento_id_versao_index" ON "plano" USING btree ("atendimento_id","versao");--> statement-breakpoint
CREATE UNIQUE INDEX "plano_um_publicado" ON "plano" USING btree ("atendimento_id") WHERE status = 'publicado';--> statement-breakpoint
CREATE UNIQUE INDEX "plano_um_em_edicao" ON "plano" USING btree ("atendimento_id") WHERE status in ('rascunho', 'em_revisao');--> statement-breakpoint
CREATE INDEX "plano_paciente_id_index" ON "plano" USING btree ("paciente_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registro_dose_plano_id_item_id_data_horario_index" ON "registro_dose" USING btree ("plano_id","item_id","data","horario");--> statement-breakpoint
CREATE UNIQUE INDEX "vinculo_user_id_instituicao_id_papel_index" ON "vinculo" USING btree ("user_id","instituicao_id","papel");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_credentialID_idx" ON "passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "twoFactor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "twoFactor_userId_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");