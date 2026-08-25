import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260825220354 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "content_page" drop constraint if exists "content_page_handle_locale_unique";`);
    this.addSql(`create table if not exists "content_page" ("id" text not null, "handle" text not null, "locale" text check ("locale" in ('el', 'en')) not null, "title" text not null, "status" text check ("status" in ('draft', 'published')) not null default 'draft', "sections" jsonb not null, "seo_title" text null, "seo_description" text null, "published_at" timestamptz null, "magento_source_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "content_page_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_content_page_deleted_at" ON "content_page" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_content_page_handle_locale_unique" ON "content_page" ("handle", "locale") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "content_page" cascade;`);
  }

}
