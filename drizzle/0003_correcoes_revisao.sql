ALTER TYPE "public"."status_lembrete" ADD VALUE 'enviando' BEFORE 'enviado';--> statement-breakpoint
ALTER TABLE "convite" ADD COLUMN "codigos_enviados" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "convite" ADD COLUMN "tentativas_totais" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lembrete" ADD COLUMN "reservado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plano" ADD COLUMN "editores" jsonb DEFAULT '[]'::jsonb NOT NULL;