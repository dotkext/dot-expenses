CREATE TABLE "planned_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"type" varchar(16) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"category_id" uuid,
	"account_id" uuid,
	"notes" varchar(2000),
	"target_month" varchar(7),
	"installments" integer DEFAULT 1 NOT NULL,
	"completed_installments" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "planned_transactions" ADD CONSTRAINT "planned_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_transactions" ADD CONSTRAINT "planned_transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_transactions" ADD CONSTRAINT "planned_transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "planned_user_idx" ON "planned_transactions" USING btree ("user_id");