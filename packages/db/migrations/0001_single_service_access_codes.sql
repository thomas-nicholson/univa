CREATE TABLE "access_codes" (
	"access_code" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_used" timestamp,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"max_conversations" integer,
	"conversation_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_codes" ENABLE ROW LEVEL SECURITY;
