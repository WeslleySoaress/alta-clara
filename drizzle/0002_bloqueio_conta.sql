CREATE TABLE "tentativa_login" (
	"chave" "bytea" PRIMARY KEY NOT NULL,
	"falhas" integer DEFAULT 0 NOT NULL,
	"janela_inicio" timestamp with time zone DEFAULT now() NOT NULL,
	"bloqueado_ate" timestamp with time zone
);
