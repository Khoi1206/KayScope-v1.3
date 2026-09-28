CREATE TABLE "email_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"host" text DEFAULT '' NOT NULL,
	"port" integer DEFAULT 587 NOT NULL,
	"secure" boolean DEFAULT true NOT NULL,
	"username" text DEFAULT '' NOT NULL,
	"password" text DEFAULT '' NOT NULL,
	"from_address" text DEFAULT '' NOT NULL,
	"from_name" text DEFAULT '' NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
