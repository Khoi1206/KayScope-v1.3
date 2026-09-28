ALTER TABLE "activity_logs" DROP CONSTRAINT "activity_logs_actor_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "collections" DROP CONSTRAINT "collections_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "environments" DROP CONSTRAINT "environments_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "examples" DROP CONSTRAINT "examples_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "flow_versions" DROP CONSTRAINT "flow_versions_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "flows" DROP CONSTRAINT "flows_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "history" DROP CONSTRAINT "history_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "request_versions" DROP CONSTRAINT "request_versions_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "requests" DROP CONSTRAINT "requests_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "test_suites" DROP CONSTRAINT "test_suites_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_members" DROP CONSTRAINT "workspace_members_invited_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environments" ADD CONSTRAINT "environments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examples" ADD CONSTRAINT "examples_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_versions" ADD CONSTRAINT "flow_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flows" ADD CONSTRAINT "flows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history" ADD CONSTRAINT "history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_versions" ADD CONSTRAINT "request_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_suites" ADD CONSTRAINT "test_suites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;