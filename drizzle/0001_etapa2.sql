CREATE TYPE "public"."status_lembrete" AS ENUM('agendado', 'enviado', 'cancelado', 'falhou');--> statement-breakpoint
CREATE TYPE "public"."tipo_pendencia" AS ENUM('retorno_nao_agendado', 'duvida_dose', 'entendimento', 'dificuldade_medicamento', 'duvida_geral');--> statement-breakpoint
CREATE TABLE "confirmacao_entendimento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plano_id" uuid NOT NULL,
	"paciente_id" uuid NOT NULL,
	"respondido_por" text NOT NULL,
	"respostas" jsonb NOT NULL,
	"acertos" integer NOT NULL,
	"total" integer NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lembrete" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plano_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"item_id" text NOT NULL,
	"agendado_para" timestamp with time zone NOT NULL,
	"status" "status_lembrete" DEFAULT 'agendado' NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"ultimo_erro" text,
	"enviado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pendencia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instituicao_id" uuid NOT NULL,
	"paciente_id" uuid NOT NULL,
	"plano_id" uuid,
	"tipo" "tipo_pendencia" NOT NULL,
	"descricao" text NOT NULL,
	"chave" text,
	"criado_por" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"resolvida_em" timestamp with time zone,
	"resolvida_por" text,
	"resolucao" text
);
--> statement-breakpoint
CREATE TABLE "preferencia_lembrete" (
	"user_id" text PRIMARY KEY NOT NULL,
	"ativo" boolean DEFAULT false NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "convite" ADD COLUMN "validade_acesso_dias" integer;--> statement-breakpoint
ALTER TABLE "convite" ADD COLUMN "apelido_destino" text;--> statement-breakpoint
ALTER TABLE "confirmacao_entendimento" ADD CONSTRAINT "confirmacao_entendimento_plano_id_plano_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."plano"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirmacao_entendimento" ADD CONSTRAINT "confirmacao_entendimento_paciente_id_paciente_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."paciente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirmacao_entendimento" ADD CONSTRAINT "confirmacao_entendimento_respondido_por_user_id_fk" FOREIGN KEY ("respondido_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lembrete" ADD CONSTRAINT "lembrete_plano_id_plano_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."plano"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lembrete" ADD CONSTRAINT "lembrete_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencia" ADD CONSTRAINT "pendencia_instituicao_id_instituicao_id_fk" FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencia" ADD CONSTRAINT "pendencia_paciente_id_paciente_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."paciente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencia" ADD CONSTRAINT "pendencia_plano_id_plano_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."plano"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencia" ADD CONSTRAINT "pendencia_criado_por_user_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pendencia" ADD CONSTRAINT "pendencia_resolvida_por_user_id_fk" FOREIGN KEY ("resolvida_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferencia_lembrete" ADD CONSTRAINT "preferencia_lembrete_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "confirmacao_entendimento_plano_id_index" ON "confirmacao_entendimento" USING btree ("plano_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lembrete_plano_id_user_id_item_id_agendado_para_index" ON "lembrete" USING btree ("plano_id","user_id","item_id","agendado_para");--> statement-breakpoint
CREATE INDEX "lembrete_status_agendado_para_index" ON "lembrete" USING btree ("status","agendado_para");--> statement-breakpoint
CREATE INDEX "pendencia_instituicao_id_resolvida_em_index" ON "pendencia" USING btree ("instituicao_id","resolvida_em");--> statement-breakpoint
CREATE UNIQUE INDEX "pendencia_chave_aberta" ON "pendencia" USING btree ("chave") WHERE resolvida_em is null and chave is not null;