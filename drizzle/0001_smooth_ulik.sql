CREATE TABLE "site_settings" (
	"id" varchar(32) PRIMARY KEY DEFAULT 'site' NOT NULL,
	"hero_photo_id" uuid,
	"hero_focal_x" integer DEFAULT 50 NOT NULL,
	"hero_focal_y" integer DEFAULT 50 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_hero_photo_id_photos_id_fk" FOREIGN KEY ("hero_photo_id") REFERENCES "public"."photos"("id") ON DELETE set null ON UPDATE no action;