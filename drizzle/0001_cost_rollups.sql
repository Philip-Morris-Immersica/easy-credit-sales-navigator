-- Т6: обобщени разходи на изтритите след 12 месеца разговори.
-- Адитивна миграция: нова таблица, нищо съществуващо не се променя.
-- НЕ е приложена. Пускане (след преглед): npx tsx scripts/apply-cost-rollups.ts
CREATE TABLE IF NOT EXISTS "cost_rollups" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"day" date NOT NULL,
	"user_id" text,
	"model" varchar(100) DEFAULT '' NOT NULL,
	"messages" integer DEFAULT 0 NOT NULL,
	"tokens_in" bigint DEFAULT 0 NOT NULL,
	"tokens_out" bigint DEFAULT 0 NOT NULL,
	"cost" double precision DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cost_rollups" ADD CONSTRAINT "cost_rollups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cost_rollups_key_idx" ON "cost_rollups" USING btree ("day","user_id","model");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_rollups_day_idx" ON "cost_rollups" USING btree ("day");
