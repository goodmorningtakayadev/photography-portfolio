CREATE TYPE "public"."photo_status" AS ENUM('processing', 'ready', 'failed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."variant_type" AS ENUM('thumb_200', 'web_1200', 'retina_2400');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name"),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "photo_categories" (
	"photo_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "photo_categories_photo_id_category_id_pk" PRIMARY KEY("photo_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "photo_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_id" uuid NOT NULL,
	"variant_type" "variant_type" NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"format" varchar(10) NOT NULL,
	"file_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"width" integer,
	"height" integer,
	"exif_data" jsonb,
	"blurhash" varchar(128),
	"caption" varchar(500),
	"alt_text" varchar(500),
	"status" "photo_status" DEFAULT 'processing' NOT NULL,
	"taken_at" timestamp with time zone,
	"is_published" boolean DEFAULT false NOT NULL,
	"gallery_sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_photos" (
	"project_id" uuid NOT NULL,
	"photo_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_photos_project_id_photo_id_pk" PRIMARY KEY("project_id","photo_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"description" text,
	"cover_photo_id" uuid,
	"is_published" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "photo_categories" ADD CONSTRAINT "photo_categories_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_categories" ADD CONSTRAINT "photo_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_variants" ADD CONSTRAINT "photo_variants_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_photos" ADD CONSTRAINT "project_photos_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_photos" ADD CONSTRAINT "project_photos_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_cover_photo_id_photos_id_fk" FOREIGN KEY ("cover_photo_id") REFERENCES "public"."photos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photos_exif_data_idx" ON "photos" USING gin ("exif_data");--> statement-breakpoint
CREATE INDEX "photos_taken_at_idx" ON "photos" USING btree ("taken_at");--> statement-breakpoint
CREATE INDEX "photos_gallery_sort_order_idx" ON "photos" USING btree ("gallery_sort_order");--> statement-breakpoint
CREATE INDEX "project_photos_sort_idx" ON "project_photos" USING btree ("project_id","sort_order");