import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`users_sessions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`created_at\` text,
  	\`expires_at\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`users_sessions_order_idx\` ON \`users_sessions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`users_sessions_parent_id_idx\` ON \`users_sessions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`users\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`email\` text NOT NULL,
  	\`reset_password_token\` text,
  	\`reset_password_expiration\` text,
  	\`salt\` text,
  	\`hash\` text,
  	\`reset_password_requested_at\` text,
  	\`login_attempts\` numeric DEFAULT 0,
  	\`lock_until\` text
  );
  `)
  await db.run(sql`CREATE INDEX \`users_updated_at_idx\` ON \`users\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`users_created_at_idx\` ON \`users\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`users_email_idx\` ON \`users\` (\`email\`);`)
  await db.run(sql`CREATE TABLE \`users_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`users_rels_order_idx\` ON \`users_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`users_rels_parent_idx\` ON \`users_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`users_rels_path_idx\` ON \`users_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`users_rels_users_id_idx\` ON \`users_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_quote\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`author\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_quote_order_idx\` ON \`pages_blocks_quote\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_quote_parent_id_idx\` ON \`pages_blocks_quote\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_quote_path_idx\` ON \`pages_blocks_quote\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_quote_locales\` (
  	\`text\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_quote\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_blocks_quote_locales_locale_parent_id_unique\` ON \`pages_blocks_quote_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_cta\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`label\` text,
  	\`href\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_cta_order_idx\` ON \`pages_blocks_cta\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_cta_parent_id_idx\` ON \`pages_blocks_cta\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_cta_path_idx\` ON \`pages_blocks_cta\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_content\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`body\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_content_order_idx\` ON \`pages_blocks_content\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_content_parent_id_idx\` ON \`pages_blocks_content\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_content_path_idx\` ON \`pages_blocks_content\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_pull_quote\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`quote\` text,
  	\`attribution\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_pull_quote_order_idx\` ON \`pages_blocks_pull_quote\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_pull_quote_parent_id_idx\` ON \`pages_blocks_pull_quote\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_pull_quote_path_idx\` ON \`pages_blocks_pull_quote\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_form\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`form_id\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`form_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_form_order_idx\` ON \`pages_blocks_form\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_form_parent_id_idx\` ON \`pages_blocks_form\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_form_path_idx\` ON \`pages_blocks_form\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_form_form_idx\` ON \`pages_blocks_form\` (\`form_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_newsletter\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`signup_form_id\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`signup_form_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_newsletter_order_idx\` ON \`pages_blocks_newsletter\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_newsletter_parent_id_idx\` ON \`pages_blocks_newsletter\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_newsletter_path_idx\` ON \`pages_blocks_newsletter\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_newsletter_signup_form_idx\` ON \`pages_blocks_newsletter\` (\`signup_form_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_breadcrumbs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`doc_id\` integer,
  	\`url\` text,
  	\`label\` text,
  	FOREIGN KEY (\`doc_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_breadcrumbs_order_idx\` ON \`pages_breadcrumbs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_breadcrumbs_parent_id_idx\` ON \`pages_breadcrumbs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_breadcrumbs_locale_idx\` ON \`pages_breadcrumbs\` (\`_locale\`);`)
  await db.run(sql`CREATE INDEX \`pages_breadcrumbs_doc_idx\` ON \`pages_breadcrumbs\` (\`doc_id\`);`)
  await db.run(sql`CREATE TABLE \`pages\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`slug\` text,
  	\`hero_id\` integer,
  	\`parent_id\` integer,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`hero_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_slug_idx\` ON \`pages\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`pages_hero_idx\` ON \`pages\` (\`hero_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_parent_idx\` ON \`pages\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_updated_at_idx\` ON \`pages\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`pages_created_at_idx\` ON \`pages\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`pages_locales\` (
  	\`title\` text,
  	\`meta_title\` text,
  	\`meta_description\` text,
  	\`meta_image_id\` integer,
  	\`_status\` text DEFAULT 'draft',
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_meta_meta_image_idx\` ON \`pages_locales\` (\`meta_image_id\`,\`_locale\`);`)
  await db.run(sql`CREATE INDEX \`pages__status_idx\` ON \`pages_locales\` (\`_status\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`pages_locales_locale_parent_id_unique\` ON \`pages_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_rels_order_idx\` ON \`pages_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`pages_rels_parent_idx\` ON \`pages_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_rels_path_idx\` ON \`pages_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`pages_rels_users_id_idx\` ON \`pages_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_quote\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`author\` text,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_quote_order_idx\` ON \`_pages_v_blocks_quote\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_quote_parent_id_idx\` ON \`_pages_v_blocks_quote\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_quote_path_idx\` ON \`_pages_v_blocks_quote\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_quote_locales\` (
  	\`text\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_quote\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_blocks_quote_locales_locale_parent_id_unique\` ON \`_pages_v_blocks_quote_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_cta\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`label\` text,
  	\`href\` text,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_cta_order_idx\` ON \`_pages_v_blocks_cta\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_cta_parent_id_idx\` ON \`_pages_v_blocks_cta\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_cta_path_idx\` ON \`_pages_v_blocks_cta\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_content\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`body\` text,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_content_order_idx\` ON \`_pages_v_blocks_content\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_content_parent_id_idx\` ON \`_pages_v_blocks_content\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_content_path_idx\` ON \`_pages_v_blocks_content\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_pull_quote\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`quote\` text,
  	\`attribution\` text,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_pull_quote_order_idx\` ON \`_pages_v_blocks_pull_quote\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_pull_quote_parent_id_idx\` ON \`_pages_v_blocks_pull_quote\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_pull_quote_path_idx\` ON \`_pages_v_blocks_pull_quote\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_form\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`form_id\` integer,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`form_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_form_order_idx\` ON \`_pages_v_blocks_form\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_form_parent_id_idx\` ON \`_pages_v_blocks_form\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_form_path_idx\` ON \`_pages_v_blocks_form\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_form_form_idx\` ON \`_pages_v_blocks_form\` (\`form_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_newsletter\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`signup_form_id\` integer,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`signup_form_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_newsletter_order_idx\` ON \`_pages_v_blocks_newsletter\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_newsletter_parent_id_idx\` ON \`_pages_v_blocks_newsletter\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_newsletter_path_idx\` ON \`_pages_v_blocks_newsletter\` (\`_path\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_newsletter_signup_form_idx\` ON \`_pages_v_blocks_newsletter\` (\`signup_form_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_version_breadcrumbs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`doc_id\` integer,
  	\`url\` text,
  	\`label\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`doc_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_version_breadcrumbs_order_idx\` ON \`_pages_v_version_breadcrumbs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_breadcrumbs_parent_id_idx\` ON \`_pages_v_version_breadcrumbs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_breadcrumbs_locale_idx\` ON \`_pages_v_version_breadcrumbs\` (\`_locale\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_breadcrumbs_doc_idx\` ON \`_pages_v_version_breadcrumbs\` (\`doc_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_slug\` text,
  	\`version_hero_id\` integer,
  	\`version_parent_id\` integer,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`published_locale\` text,
  	\`latest\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_hero_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_parent_idx\` ON \`_pages_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_slug_idx\` ON \`_pages_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_hero_idx\` ON \`_pages_v\` (\`version_hero_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_parent_idx\` ON \`_pages_v\` (\`version_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_updated_at_idx\` ON \`_pages_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version_created_at_idx\` ON \`_pages_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_created_at_idx\` ON \`_pages_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_updated_at_idx\` ON \`_pages_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_published_locale_idx\` ON \`_pages_v\` (\`published_locale\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_latest_idx\` ON \`_pages_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_locales\` (
  	\`version_title\` text,
  	\`version_meta_title\` text,
  	\`version_meta_description\` text,
  	\`version_meta_image_id\` integer,
  	\`version__status\` text DEFAULT 'draft',
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`version_meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_version_meta_version_meta_image_idx\` ON \`_pages_v_locales\` (\`version_meta_image_id\`,\`_locale\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_version_version__status_idx\` ON \`_pages_v_locales\` (\`version__status\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`_pages_v_locales_locale_parent_id_unique\` ON \`_pages_v_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_rels_order_idx\` ON \`_pages_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_rels_parent_idx\` ON \`_pages_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_rels_path_idx\` ON \`_pages_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_rels_users_id_idx\` ON \`_pages_v_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`posts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`slug\` text,
  	\`excerpt\` text,
  	\`author_id\` integer,
  	\`hero_image_id\` integer,
  	\`content\` text,
  	\`published_at\` text,
  	\`_h_folders_id\` integer,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`deleted_at\` text,
  	FOREIGN KEY (\`author_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`hero_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_h_folders_id\`) REFERENCES \`folders\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`posts_slug_idx\` ON \`posts\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`posts_author_idx\` ON \`posts\` (\`author_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_hero_image_idx\` ON \`posts\` (\`hero_image_id\`);`)
  await db.run(sql`CREATE INDEX \`posts__h_folders_idx\` ON \`posts\` (\`_h_folders_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_updated_at_idx\` ON \`posts\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`posts_created_at_idx\` ON \`posts\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`posts_deleted_at_idx\` ON \`posts\` (\`deleted_at\`);`)
  await db.run(sql`CREATE TABLE \`posts_locales\` (
  	\`title\` text,
  	\`meta_title\` text,
  	\`meta_description\` text,
  	\`meta_image_id\` integer,
  	\`_status\` text DEFAULT 'draft',
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`posts_meta_meta_image_idx\` ON \`posts_locales\` (\`meta_image_id\`,\`_locale\`);`)
  await db.run(sql`CREATE INDEX \`posts__status_idx\` ON \`posts_locales\` (\`_status\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`posts_locales_locale_parent_id_unique\` ON \`posts_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`posts_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`categories_id\` integer,
  	\`tags_id\` integer,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`tags_id\`) REFERENCES \`tags\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`posts_rels_order_idx\` ON \`posts_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_parent_idx\` ON \`posts_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_path_idx\` ON \`posts_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_categories_id_idx\` ON \`posts_rels\` (\`categories_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_tags_id_idx\` ON \`posts_rels\` (\`tags_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_users_id_idx\` ON \`posts_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`_posts_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_slug\` text,
  	\`version_excerpt\` text,
  	\`version_author_id\` integer,
  	\`version_hero_image_id\` integer,
  	\`version_content\` text,
  	\`version_published_at\` text,
  	\`version__h_folders_id\` integer,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version_deleted_at\` text,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`published_locale\` text,
  	\`latest\` integer,
  	\`autosave\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_author_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_hero_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version__h_folders_id\`) REFERENCES \`folders\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_posts_v_parent_idx\` ON \`_posts_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version_slug_idx\` ON \`_posts_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version_author_idx\` ON \`_posts_v\` (\`version_author_id\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version_hero_image_idx\` ON \`_posts_v\` (\`version_hero_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version__h_folders_idx\` ON \`_posts_v\` (\`version__h_folders_id\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version_updated_at_idx\` ON \`_posts_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version_created_at_idx\` ON \`_posts_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version_deleted_at_idx\` ON \`_posts_v\` (\`version_deleted_at\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_created_at_idx\` ON \`_posts_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_updated_at_idx\` ON \`_posts_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_published_locale_idx\` ON \`_posts_v\` (\`published_locale\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_latest_idx\` ON \`_posts_v\` (\`latest\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_autosave_idx\` ON \`_posts_v\` (\`autosave\`);`)
  await db.run(sql`CREATE TABLE \`_posts_v_locales\` (
  	\`version_title\` text,
  	\`version_meta_title\` text,
  	\`version_meta_description\` text,
  	\`version_meta_image_id\` integer,
  	\`version__status\` text DEFAULT 'draft',
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`version_meta_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_posts_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_posts_v_version_meta_version_meta_image_idx\` ON \`_posts_v_locales\` (\`version_meta_image_id\`,\`_locale\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_version_version__status_idx\` ON \`_posts_v_locales\` (\`version__status\`,\`_locale\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`_posts_v_locales_locale_parent_id_unique\` ON \`_posts_v_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_posts_v_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`categories_id\` integer,
  	\`tags_id\` integer,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_posts_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`tags_id\`) REFERENCES \`tags\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_order_idx\` ON \`_posts_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_parent_idx\` ON \`_posts_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_path_idx\` ON \`_posts_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_categories_id_idx\` ON \`_posts_v_rels\` (\`categories_id\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_tags_id_idx\` ON \`_posts_v_rels\` (\`tags_id\`);`)
  await db.run(sql`CREATE INDEX \`_posts_v_rels_users_id_idx\` ON \`_posts_v_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`categories\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`slug\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`categories_slug_idx\` ON \`categories\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`categories_updated_at_idx\` ON \`categories\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`categories_created_at_idx\` ON \`categories\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`categories_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`categories_rels_order_idx\` ON \`categories_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`categories_rels_parent_idx\` ON \`categories_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`categories_rels_path_idx\` ON \`categories_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`categories_rels_users_id_idx\` ON \`categories_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`media\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`alt\` text NOT NULL,
  	\`_h_folders_id\` integer,
  	\`prefix\` text DEFAULT '',
  	\`_objectkey\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`url\` text,
  	\`thumbnail_u_r_l\` text,
  	\`filename\` text,
  	\`mime_type\` text,
  	\`filesize\` numeric,
  	\`width\` numeric,
  	\`height\` numeric,
  	\`original_filename\` text,
  	\`original_url\` text,
  	\`original_mime_type\` text,
  	\`original_filesize\` numeric,
  	\`original_width\` numeric,
  	\`original_height\` numeric,
  	\`original_prefix\` text,
  	\`original__objectkey\` text,
  	\`focal_x\` numeric,
  	\`focal_y\` numeric,
  	\`variants_thumbnail_url\` text,
  	\`variants_thumbnail_width\` numeric,
  	\`variants_thumbnail_height\` numeric,
  	\`variants_thumbnail_mime_type\` text,
  	\`variants_thumbnail_filesize\` numeric,
  	\`variants_thumbnail_filename\` text,
  	\`variants_thumbnail_prefix\` text,
  	\`variants_thumbnail__objectkey\` text,
  	\`variants_square_url\` text,
  	\`variants_square_width\` numeric,
  	\`variants_square_height\` numeric,
  	\`variants_square_mime_type\` text,
  	\`variants_square_filesize\` numeric,
  	\`variants_square_filename\` text,
  	\`variants_square_prefix\` text,
  	\`variants_square__objectkey\` text,
  	\`variants_small_url\` text,
  	\`variants_small_width\` numeric,
  	\`variants_small_height\` numeric,
  	\`variants_small_mime_type\` text,
  	\`variants_small_filesize\` numeric,
  	\`variants_small_filename\` text,
  	\`variants_small_prefix\` text,
  	\`variants_small__objectkey\` text,
  	\`variants_card_url\` text,
  	\`variants_card_width\` numeric,
  	\`variants_card_height\` numeric,
  	\`variants_card_mime_type\` text,
  	\`variants_card_filesize\` numeric,
  	\`variants_card_filename\` text,
  	\`variants_card_prefix\` text,
  	\`variants_card__objectkey\` text,
  	\`variants_medium_url\` text,
  	\`variants_medium_width\` numeric,
  	\`variants_medium_height\` numeric,
  	\`variants_medium_mime_type\` text,
  	\`variants_medium_filesize\` numeric,
  	\`variants_medium_filename\` text,
  	\`variants_medium_prefix\` text,
  	\`variants_medium__objectkey\` text,
  	\`variants_large_url\` text,
  	\`variants_large_width\` numeric,
  	\`variants_large_height\` numeric,
  	\`variants_large_mime_type\` text,
  	\`variants_large_filesize\` numeric,
  	\`variants_large_filename\` text,
  	\`variants_large_prefix\` text,
  	\`variants_large__objectkey\` text,
  	\`variants_og_url\` text,
  	\`variants_og_width\` numeric,
  	\`variants_og_height\` numeric,
  	\`variants_og_mime_type\` text,
  	\`variants_og_filesize\` numeric,
  	\`variants_og_filename\` text,
  	\`variants_og_prefix\` text,
  	\`variants_og__objectkey\` text,
  	FOREIGN KEY (\`_h_folders_id\`) REFERENCES \`folders\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`media__h_folders_idx\` ON \`media\` (\`_h_folders_id\`);`)
  await db.run(sql`CREATE INDEX \`media_updated_at_idx\` ON \`media\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`media_created_at_idx\` ON \`media\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`media_filename_idx\` ON \`media\` (\`filename\`);`)
  await db.run(sql`CREATE INDEX \`media_original_original_filename_idx\` ON \`media\` (\`original_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_variants_thumbnail_variants_thumbnail_filename_idx\` ON \`media\` (\`variants_thumbnail_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_variants_square_variants_square_filename_idx\` ON \`media\` (\`variants_square_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_variants_small_variants_small_filename_idx\` ON \`media\` (\`variants_small_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_variants_card_variants_card_filename_idx\` ON \`media\` (\`variants_card_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_variants_medium_variants_medium_filename_idx\` ON \`media\` (\`variants_medium_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_variants_large_variants_large_filename_idx\` ON \`media\` (\`variants_large_filename\`);`)
  await db.run(sql`CREATE INDEX \`media_variants_og_variants_og_filename_idx\` ON \`media\` (\`variants_og_filename\`);`)
  await db.run(sql`CREATE TABLE \`media_locales\` (
  	\`caption\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`media_locales_locale_parent_id_unique\` ON \`media_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`media_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`tags_id\` integer,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`tags_id\`) REFERENCES \`tags\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`media_rels_order_idx\` ON \`media_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`media_rels_parent_idx\` ON \`media_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`media_rels_path_idx\` ON \`media_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`media_rels_tags_id_idx\` ON \`media_rels\` (\`tags_id\`);`)
  await db.run(sql`CREATE INDEX \`media_rels_users_id_idx\` ON \`media_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`_media_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_alt\` text NOT NULL,
  	\`version__h_folders_id\` integer,
  	\`version_prefix\` text DEFAULT '',
  	\`version__objectkey\` text,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version_url\` text,
  	\`version_thumbnail_u_r_l\` text,
  	\`version_filename\` text,
  	\`version_mime_type\` text,
  	\`version_filesize\` numeric,
  	\`version_width\` numeric,
  	\`version_height\` numeric,
  	\`version_original_filename\` text,
  	\`version_original_url\` text,
  	\`version_original_mime_type\` text,
  	\`version_original_filesize\` numeric,
  	\`version_original_width\` numeric,
  	\`version_original_height\` numeric,
  	\`version_original_prefix\` text,
  	\`version_original__objectkey\` text,
  	\`version_focal_x\` numeric,
  	\`version_focal_y\` numeric,
  	\`version_variants_thumbnail_url\` text,
  	\`version_variants_thumbnail_width\` numeric,
  	\`version_variants_thumbnail_height\` numeric,
  	\`version_variants_thumbnail_mime_type\` text,
  	\`version_variants_thumbnail_filesize\` numeric,
  	\`version_variants_thumbnail_filename\` text,
  	\`version_variants_thumbnail_prefix\` text,
  	\`version_variants_thumbnail__objectkey\` text,
  	\`version_variants_square_url\` text,
  	\`version_variants_square_width\` numeric,
  	\`version_variants_square_height\` numeric,
  	\`version_variants_square_mime_type\` text,
  	\`version_variants_square_filesize\` numeric,
  	\`version_variants_square_filename\` text,
  	\`version_variants_square_prefix\` text,
  	\`version_variants_square__objectkey\` text,
  	\`version_variants_small_url\` text,
  	\`version_variants_small_width\` numeric,
  	\`version_variants_small_height\` numeric,
  	\`version_variants_small_mime_type\` text,
  	\`version_variants_small_filesize\` numeric,
  	\`version_variants_small_filename\` text,
  	\`version_variants_small_prefix\` text,
  	\`version_variants_small__objectkey\` text,
  	\`version_variants_card_url\` text,
  	\`version_variants_card_width\` numeric,
  	\`version_variants_card_height\` numeric,
  	\`version_variants_card_mime_type\` text,
  	\`version_variants_card_filesize\` numeric,
  	\`version_variants_card_filename\` text,
  	\`version_variants_card_prefix\` text,
  	\`version_variants_card__objectkey\` text,
  	\`version_variants_medium_url\` text,
  	\`version_variants_medium_width\` numeric,
  	\`version_variants_medium_height\` numeric,
  	\`version_variants_medium_mime_type\` text,
  	\`version_variants_medium_filesize\` numeric,
  	\`version_variants_medium_filename\` text,
  	\`version_variants_medium_prefix\` text,
  	\`version_variants_medium__objectkey\` text,
  	\`version_variants_large_url\` text,
  	\`version_variants_large_width\` numeric,
  	\`version_variants_large_height\` numeric,
  	\`version_variants_large_mime_type\` text,
  	\`version_variants_large_filesize\` numeric,
  	\`version_variants_large_filename\` text,
  	\`version_variants_large_prefix\` text,
  	\`version_variants_large__objectkey\` text,
  	\`version_variants_og_url\` text,
  	\`version_variants_og_width\` numeric,
  	\`version_variants_og_height\` numeric,
  	\`version_variants_og_mime_type\` text,
  	\`version_variants_og_filesize\` numeric,
  	\`version_variants_og_filename\` text,
  	\`version_variants_og_prefix\` text,
  	\`version_variants_og__objectkey\` text,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version__h_folders_id\`) REFERENCES \`folders\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_media_v_parent_idx\` ON \`_media_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_media_v_version_version__h_folders_idx\` ON \`_media_v\` (\`version__h_folders_id\`);`)
  await db.run(sql`CREATE INDEX \`_media_v_version_version_updated_at_idx\` ON \`_media_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_media_v_version_version_created_at_idx\` ON \`_media_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_media_v_version_version_filename_idx\` ON \`_media_v\` (\`version_filename\`);`)
  await db.run(sql`CREATE INDEX \`_media_v_version_original_version_original_filename_idx\` ON \`_media_v\` (\`version_original_filename\`);`)
  await db.run(sql`CREATE INDEX \`_media_v_version_variants_thumbnail_version_variants_thu_idx\` ON \`_media_v\` (\`version_variants_thumbnail_filename\`);`)
  await db.run(sql`CREATE INDEX \`_media_v_version_variants_square_version_variants_square_idx\` ON \`_media_v\` (\`version_variants_square_filename\`);`)
  await db.run(sql`CREATE INDEX \`_media_v_version_variants_small_version_variants_small_f_idx\` ON \`_media_v\` (\`version_variants_small_filename\`);`)
  await db.run(sql`CREATE INDEX \`_media_v_version_variants_card_version_variants_card_fil_idx\` ON \`_media_v\` (\`version_variants_card_filename\`);`)
  await db.run(sql`CREATE INDEX \`_media_v_version_variants_medium_version_variants_medium_idx\` ON \`_media_v\` (\`version_variants_medium_filename\`);`)
  await db.run(sql`CREATE INDEX \`_media_v_version_variants_large_version_variants_large_f_idx\` ON \`_media_v\` (\`version_variants_large_filename\`);`)
  await db.run(sql`CREATE INDEX \`_media_v_version_variants_og_version_variants_og_filenam_idx\` ON \`_media_v\` (\`version_variants_og_filename\`);`)
  await db.run(sql`CREATE INDEX \`_media_v_created_at_idx\` ON \`_media_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_media_v_updated_at_idx\` ON \`_media_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE TABLE \`_media_v_locales\` (
  	\`version_caption\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_media_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_media_v_locales_locale_parent_id_unique\` ON \`_media_v_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_media_v_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`tags_id\` integer,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_media_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`tags_id\`) REFERENCES \`tags\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_media_v_rels_order_idx\` ON \`_media_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_media_v_rels_parent_idx\` ON \`_media_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_media_v_rels_path_idx\` ON \`_media_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_media_v_rels_tags_id_idx\` ON \`_media_v_rels\` (\`tags_id\`);`)
  await db.run(sql`CREATE INDEX \`_media_v_rels_users_id_idx\` ON \`_media_v_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`field_types_select_many\` (
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`field_types\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`field_types_select_many_order_idx\` ON \`field_types_select_many\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`field_types_select_many_parent_idx\` ON \`field_types_select_many\` (\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`field_types_array_children\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`value\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`field_types_array\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`field_types_array_children_order_idx\` ON \`field_types_array_children\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`field_types_array_children_parent_id_idx\` ON \`field_types_array_children\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`field_types_array\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`label\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`field_types\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`field_types_array_order_idx\` ON \`field_types_array\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`field_types_array_parent_id_idx\` ON \`field_types_array\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`field_types_localized_array\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`label\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`field_types\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`field_types_localized_array_order_idx\` ON \`field_types_localized_array\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`field_types_localized_array_parent_id_idx\` ON \`field_types_localized_array\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`field_types_localized_array_locale_idx\` ON \`field_types_localized_array\` (\`_locale\`);`)
  await db.run(sql`CREATE TABLE \`field_types_blocks_text_block\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`text\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`field_types\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`field_types_blocks_text_block_order_idx\` ON \`field_types_blocks_text_block\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`field_types_blocks_text_block_parent_id_idx\` ON \`field_types_blocks_text_block\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`field_types_blocks_text_block_path_idx\` ON \`field_types_blocks_text_block\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`field_types_blocks_list_block_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`item\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`field_types_blocks_list_block\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`field_types_blocks_list_block_items_order_idx\` ON \`field_types_blocks_list_block_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`field_types_blocks_list_block_items_parent_id_idx\` ON \`field_types_blocks_list_block_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`field_types_blocks_list_block\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`field_types\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`field_types_blocks_list_block_order_idx\` ON \`field_types_blocks_list_block\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`field_types_blocks_list_block_parent_id_idx\` ON \`field_types_blocks_list_block\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`field_types_blocks_list_block_path_idx\` ON \`field_types_blocks_list_block\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`field_types\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`text\` text NOT NULL,
  	\`textarea\` text,
  	\`number\` numeric,
  	\`email\` text,
  	\`date\` text,
  	\`checkbox\` integer,
  	\`code\` text,
  	\`json\` text,
  	\`select\` text,
  	\`radio\` text,
  	\`relations_relationship_id\` integer,
  	\`relations_upload_id\` integer,
  	\`group_title\` text,
  	\`group_left\` text,
  	\`group_right\` text,
  	\`inside_collapsible\` text,
  	\`rich_text\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`relations_relationship_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`relations_upload_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`field_types_relations_relations_relationship_idx\` ON \`field_types\` (\`relations_relationship_id\`);`)
  await db.run(sql`CREATE INDEX \`field_types_relations_relations_upload_idx\` ON \`field_types\` (\`relations_upload_id\`);`)
  await db.run(sql`CREATE INDEX \`field_types_updated_at_idx\` ON \`field_types\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`field_types_created_at_idx\` ON \`field_types\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`field_types_locales\` (
  	\`localized_text\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`field_types\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`field_types_locales_locale_parent_id_unique\` ON \`field_types_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`field_types_texts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`text\` text,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`field_types\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`field_types_texts_order_parent\` ON \`field_types_texts\` (\`order\`,\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`field_types_numbers\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`number\` numeric,
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`field_types\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`field_types_numbers_order_parent_idx\` ON \`field_types_numbers\` (\`order\`,\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`field_types_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`categories_id\` integer,
  	\`pages_id\` integer,
  	\`posts_id\` integer,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`field_types\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`field_types_rels_order_idx\` ON \`field_types_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`field_types_rels_parent_idx\` ON \`field_types_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`field_types_rels_path_idx\` ON \`field_types_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`field_types_rels_categories_id_idx\` ON \`field_types_rels\` (\`categories_id\`);`)
  await db.run(sql`CREATE INDEX \`field_types_rels_pages_id_idx\` ON \`field_types_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`field_types_rels_posts_id_idx\` ON \`field_types_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`field_types_rels_users_id_idx\` ON \`field_types_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`folders\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_h_folders_id\` integer,
  	\`name\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`_h_folders_id\`) REFERENCES \`folders\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`folders__h_folders_idx\` ON \`folders\` (\`_h_folders_id\`);`)
  await db.run(sql`CREATE INDEX \`folders_updated_at_idx\` ON \`folders\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`folders_created_at_idx\` ON \`folders\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`folders_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`folders\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`folders_rels_order_idx\` ON \`folders_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`folders_rels_parent_idx\` ON \`folders_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`folders_rels_path_idx\` ON \`folders_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`folders_rels_users_id_idx\` ON \`folders_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`_folders_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version__h_folders_id\` integer,
  	\`version_name\` text NOT NULL,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`folders\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version__h_folders_id\`) REFERENCES \`folders\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_folders_v_parent_idx\` ON \`_folders_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_folders_v_version_version__h_folders_idx\` ON \`_folders_v\` (\`version__h_folders_id\`);`)
  await db.run(sql`CREATE INDEX \`_folders_v_version_version_updated_at_idx\` ON \`_folders_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_folders_v_version_version_created_at_idx\` ON \`_folders_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_folders_v_created_at_idx\` ON \`_folders_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_folders_v_updated_at_idx\` ON \`_folders_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE TABLE \`_folders_v_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_folders_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_folders_v_rels_order_idx\` ON \`_folders_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_folders_v_rels_parent_idx\` ON \`_folders_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_folders_v_rels_path_idx\` ON \`_folders_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_folders_v_rels_users_id_idx\` ON \`_folders_v_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`tags\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_h_tags_id\` integer,
  	\`name\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`_h_tags_id\`) REFERENCES \`tags\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`tags__h_tags_idx\` ON \`tags\` (\`_h_tags_id\`);`)
  await db.run(sql`CREATE INDEX \`tags_updated_at_idx\` ON \`tags\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`tags_created_at_idx\` ON \`tags\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`tags_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`tags\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`tags_rels_order_idx\` ON \`tags_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`tags_rels_parent_idx\` ON \`tags_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`tags_rels_path_idx\` ON \`tags_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`tags_rels_users_id_idx\` ON \`tags_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`_tags_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version__h_tags_id\` integer,
  	\`version_name\` text NOT NULL,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`tags\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version__h_tags_id\`) REFERENCES \`tags\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_tags_v_parent_idx\` ON \`_tags_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_tags_v_version_version__h_tags_idx\` ON \`_tags_v\` (\`version__h_tags_id\`);`)
  await db.run(sql`CREATE INDEX \`_tags_v_version_version_updated_at_idx\` ON \`_tags_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_tags_v_version_version_created_at_idx\` ON \`_tags_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_tags_v_created_at_idx\` ON \`_tags_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_tags_v_updated_at_idx\` ON \`_tags_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE TABLE \`_tags_v_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_tags_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_tags_v_rels_order_idx\` ON \`_tags_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_tags_v_rels_parent_idx\` ON \`_tags_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_tags_v_rels_path_idx\` ON \`_tags_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_tags_v_rels_users_id_idx\` ON \`_tags_v_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`audit_logs\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`action\` text NOT NULL,
  	\`collection\` text,
  	\`document_i_d\` text,
  	\`summary\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`audit_logs_updated_at_idx\` ON \`audit_logs\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`audit_logs_created_at_idx\` ON \`audit_logs\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`audit_logs_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`audit_logs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`audit_logs_rels_order_idx\` ON \`audit_logs_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`audit_logs_rels_parent_idx\` ON \`audit_logs_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`audit_logs_rels_path_idx\` ON \`audit_logs_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`audit_logs_rels_users_id_idx\` ON \`audit_logs_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`redirects\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`from\` text NOT NULL,
  	\`to_type\` text DEFAULT 'reference',
  	\`to_url\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`redirects_from_idx\` ON \`redirects\` (\`from\`);`)
  await db.run(sql`CREATE INDEX \`redirects_updated_at_idx\` ON \`redirects\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`redirects_created_at_idx\` ON \`redirects\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`redirects_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`pages_id\` integer,
  	\`posts_id\` integer,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`redirects\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`redirects_rels_order_idx\` ON \`redirects_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`redirects_rels_parent_idx\` ON \`redirects_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`redirects_rels_path_idx\` ON \`redirects_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`redirects_rels_pages_id_idx\` ON \`redirects_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`redirects_rels_posts_id_idx\` ON \`redirects_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`redirects_rels_users_id_idx\` ON \`redirects_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`_redirects_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_from\` text NOT NULL,
  	\`version_to_type\` text DEFAULT 'reference',
  	\`version_to_url\` text,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`redirects\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_redirects_v_parent_idx\` ON \`_redirects_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_redirects_v_version_version_from_idx\` ON \`_redirects_v\` (\`version_from\`);`)
  await db.run(sql`CREATE INDEX \`_redirects_v_version_version_updated_at_idx\` ON \`_redirects_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_redirects_v_version_version_created_at_idx\` ON \`_redirects_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_redirects_v_created_at_idx\` ON \`_redirects_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_redirects_v_updated_at_idx\` ON \`_redirects_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE TABLE \`_redirects_v_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`pages_id\` integer,
  	\`posts_id\` integer,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_redirects_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_redirects_v_rels_order_idx\` ON \`_redirects_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_redirects_v_rels_parent_idx\` ON \`_redirects_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_redirects_v_rels_path_idx\` ON \`_redirects_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_redirects_v_rels_pages_id_idx\` ON \`_redirects_v_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`_redirects_v_rels_posts_id_idx\` ON \`_redirects_v_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`_redirects_v_rels_users_id_idx\` ON \`_redirects_v_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`search\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`priority\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`search_updated_at_idx\` ON \`search\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`search_created_at_idx\` ON \`search\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`search_locales\` (
  	\`title\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`search\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`search_locales_locale_parent_id_unique\` ON \`search_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`search_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`posts_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`search\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`search_rels_order_idx\` ON \`search_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`search_rels_parent_idx\` ON \`search_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`search_rels_path_idx\` ON \`search_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`search_rels_posts_id_idx\` ON \`search_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_checkbox\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`required\` integer,
  	\`default_value\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_blocks_checkbox_order_idx\` ON \`forms_blocks_checkbox\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_checkbox_parent_id_idx\` ON \`forms_blocks_checkbox\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_checkbox_path_idx\` ON \`forms_blocks_checkbox\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_checkbox_locales\` (
  	\`label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_checkbox\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_blocks_checkbox_locales_locale_parent_id_unique\` ON \`forms_blocks_checkbox_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_country\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`required\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_blocks_country_order_idx\` ON \`forms_blocks_country\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_country_parent_id_idx\` ON \`forms_blocks_country\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_country_path_idx\` ON \`forms_blocks_country\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_country_locales\` (
  	\`label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_country\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_blocks_country_locales_locale_parent_id_unique\` ON \`forms_blocks_country_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_email\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`required\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_blocks_email_order_idx\` ON \`forms_blocks_email\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_email_parent_id_idx\` ON \`forms_blocks_email\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_email_path_idx\` ON \`forms_blocks_email\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_email_locales\` (
  	\`label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_email\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_blocks_email_locales_locale_parent_id_unique\` ON \`forms_blocks_email_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_message\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_blocks_message_order_idx\` ON \`forms_blocks_message\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_message_parent_id_idx\` ON \`forms_blocks_message\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_message_path_idx\` ON \`forms_blocks_message\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_message_locales\` (
  	\`message\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_message\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_blocks_message_locales_locale_parent_id_unique\` ON \`forms_blocks_message_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_number\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`default_value\` numeric,
  	\`required\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_blocks_number_order_idx\` ON \`forms_blocks_number\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_number_parent_id_idx\` ON \`forms_blocks_number\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_number_path_idx\` ON \`forms_blocks_number\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_number_locales\` (
  	\`label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_number\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_blocks_number_locales_locale_parent_id_unique\` ON \`forms_blocks_number_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_select_options\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`value\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_select\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_blocks_select_options_order_idx\` ON \`forms_blocks_select_options\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_select_options_parent_id_idx\` ON \`forms_blocks_select_options\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_select_options_locales\` (
  	\`label\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_select_options\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_blocks_select_options_locales_locale_parent_id_unique\` ON \`forms_blocks_select_options_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_select\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`placeholder\` text,
  	\`required\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_blocks_select_order_idx\` ON \`forms_blocks_select\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_select_parent_id_idx\` ON \`forms_blocks_select\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_select_path_idx\` ON \`forms_blocks_select\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_select_locales\` (
  	\`label\` text,
  	\`default_value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_select\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_blocks_select_locales_locale_parent_id_unique\` ON \`forms_blocks_select_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_state\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`required\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_blocks_state_order_idx\` ON \`forms_blocks_state\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_state_parent_id_idx\` ON \`forms_blocks_state\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_state_path_idx\` ON \`forms_blocks_state\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_state_locales\` (
  	\`label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_state\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_blocks_state_locales_locale_parent_id_unique\` ON \`forms_blocks_state_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_text\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`required\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_blocks_text_order_idx\` ON \`forms_blocks_text\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_text_parent_id_idx\` ON \`forms_blocks_text\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_text_path_idx\` ON \`forms_blocks_text\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_text_locales\` (
  	\`label\` text,
  	\`default_value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_blocks_text_locales_locale_parent_id_unique\` ON \`forms_blocks_text_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_textarea\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`required\` integer,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_blocks_textarea_order_idx\` ON \`forms_blocks_textarea\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_textarea_parent_id_idx\` ON \`forms_blocks_textarea\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`forms_blocks_textarea_path_idx\` ON \`forms_blocks_textarea\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`forms_blocks_textarea_locales\` (
  	\`label\` text,
  	\`default_value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_blocks_textarea\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_blocks_textarea_locales_locale_parent_id_unique\` ON \`forms_blocks_textarea_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_emails\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`email_to\` text,
  	\`cc\` text,
  	\`bcc\` text,
  	\`reply_to\` text,
  	\`email_from\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_emails_order_idx\` ON \`forms_emails\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`forms_emails_parent_id_idx\` ON \`forms_emails\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_emails_locales\` (
  	\`subject\` text DEFAULT 'You''ve received a new message.' NOT NULL,
  	\`message\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms_emails\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_emails_locales_locale_parent_id_unique\` ON \`forms_emails_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text NOT NULL,
  	\`confirmation_type\` text DEFAULT 'message',
  	\`redirect_url\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_updated_at_idx\` ON \`forms\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`forms_created_at_idx\` ON \`forms\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`forms_locales\` (
  	\`submit_button_label\` text,
  	\`confirmation_message\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`forms_locales_locale_parent_id_unique\` ON \`forms_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`forms_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`forms_rels_order_idx\` ON \`forms_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`forms_rels_parent_idx\` ON \`forms_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`forms_rels_path_idx\` ON \`forms_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`forms_rels_users_id_idx\` ON \`forms_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_blocks_checkbox\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`required\` integer,
  	\`default_value\` integer,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_checkbox_order_idx\` ON \`_forms_v_blocks_checkbox\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_checkbox_parent_id_idx\` ON \`_forms_v_blocks_checkbox\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_checkbox_path_idx\` ON \`_forms_v_blocks_checkbox\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_blocks_checkbox_locales\` (
  	\`label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v_blocks_checkbox\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_forms_v_blocks_checkbox_locales_locale_parent_id_unique\` ON \`_forms_v_blocks_checkbox_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_blocks_country\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`required\` integer,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_country_order_idx\` ON \`_forms_v_blocks_country\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_country_parent_id_idx\` ON \`_forms_v_blocks_country\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_country_path_idx\` ON \`_forms_v_blocks_country\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_blocks_country_locales\` (
  	\`label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v_blocks_country\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_forms_v_blocks_country_locales_locale_parent_id_unique\` ON \`_forms_v_blocks_country_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_blocks_email\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`required\` integer,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_email_order_idx\` ON \`_forms_v_blocks_email\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_email_parent_id_idx\` ON \`_forms_v_blocks_email\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_email_path_idx\` ON \`_forms_v_blocks_email\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_blocks_email_locales\` (
  	\`label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v_blocks_email\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_forms_v_blocks_email_locales_locale_parent_id_unique\` ON \`_forms_v_blocks_email_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_blocks_message\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_message_order_idx\` ON \`_forms_v_blocks_message\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_message_parent_id_idx\` ON \`_forms_v_blocks_message\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_message_path_idx\` ON \`_forms_v_blocks_message\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_blocks_message_locales\` (
  	\`message\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v_blocks_message\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_forms_v_blocks_message_locales_locale_parent_id_unique\` ON \`_forms_v_blocks_message_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_blocks_number\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`default_value\` numeric,
  	\`required\` integer,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_number_order_idx\` ON \`_forms_v_blocks_number\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_number_parent_id_idx\` ON \`_forms_v_blocks_number\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_number_path_idx\` ON \`_forms_v_blocks_number\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_blocks_number_locales\` (
  	\`label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v_blocks_number\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_forms_v_blocks_number_locales_locale_parent_id_unique\` ON \`_forms_v_blocks_number_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_blocks_select_options\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`value\` text NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v_blocks_select\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_select_options_order_idx\` ON \`_forms_v_blocks_select_options\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_select_options_parent_id_idx\` ON \`_forms_v_blocks_select_options\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_blocks_select_options_locales\` (
  	\`label\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v_blocks_select_options\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_forms_v_blocks_select_options_locales_locale_parent_id_uniq\` ON \`_forms_v_blocks_select_options_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_blocks_select\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`placeholder\` text,
  	\`required\` integer,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_select_order_idx\` ON \`_forms_v_blocks_select\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_select_parent_id_idx\` ON \`_forms_v_blocks_select\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_select_path_idx\` ON \`_forms_v_blocks_select\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_blocks_select_locales\` (
  	\`label\` text,
  	\`default_value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v_blocks_select\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_forms_v_blocks_select_locales_locale_parent_id_unique\` ON \`_forms_v_blocks_select_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_blocks_state\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`required\` integer,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_state_order_idx\` ON \`_forms_v_blocks_state\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_state_parent_id_idx\` ON \`_forms_v_blocks_state\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_state_path_idx\` ON \`_forms_v_blocks_state\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_blocks_state_locales\` (
  	\`label\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v_blocks_state\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_forms_v_blocks_state_locales_locale_parent_id_unique\` ON \`_forms_v_blocks_state_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_blocks_text\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`required\` integer,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_text_order_idx\` ON \`_forms_v_blocks_text\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_text_parent_id_idx\` ON \`_forms_v_blocks_text\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_text_path_idx\` ON \`_forms_v_blocks_text\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_blocks_text_locales\` (
  	\`label\` text,
  	\`default_value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v_blocks_text\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_forms_v_blocks_text_locales_locale_parent_id_unique\` ON \`_forms_v_blocks_text_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_blocks_textarea\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`width\` numeric,
  	\`required\` integer,
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_textarea_order_idx\` ON \`_forms_v_blocks_textarea\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_textarea_parent_id_idx\` ON \`_forms_v_blocks_textarea\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_blocks_textarea_path_idx\` ON \`_forms_v_blocks_textarea\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_blocks_textarea_locales\` (
  	\`label\` text,
  	\`default_value\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v_blocks_textarea\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_forms_v_blocks_textarea_locales_locale_parent_id_unique\` ON \`_forms_v_blocks_textarea_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_version_emails\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`email_to\` text,
  	\`cc\` text,
  	\`bcc\` text,
  	\`reply_to\` text,
  	\`email_from\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_forms_v_version_emails_order_idx\` ON \`_forms_v_version_emails\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_version_emails_parent_id_idx\` ON \`_forms_v_version_emails\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_version_emails_locales\` (
  	\`subject\` text DEFAULT 'You''ve received a new message.' NOT NULL,
  	\`message\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v_version_emails\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_forms_v_version_emails_locales_locale_parent_id_unique\` ON \`_forms_v_version_emails_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_title\` text NOT NULL,
  	\`version_confirmation_type\` text DEFAULT 'message',
  	\`version_redirect_url\` text,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_forms_v_parent_idx\` ON \`_forms_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_version_version_updated_at_idx\` ON \`_forms_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_version_version_created_at_idx\` ON \`_forms_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_created_at_idx\` ON \`_forms_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_updated_at_idx\` ON \`_forms_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_locales\` (
  	\`version_submit_button_label\` text,
  	\`version_confirmation_message\` text,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_forms_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_forms_v_locales_locale_parent_id_unique\` ON \`_forms_v_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_forms_v_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_forms_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_forms_v_rels_order_idx\` ON \`_forms_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_rels_parent_idx\` ON \`_forms_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_rels_path_idx\` ON \`_forms_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_forms_v_rels_users_id_idx\` ON \`_forms_v_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`form_submissions_submission_data\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`field\` text NOT NULL,
  	\`value\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`form_submissions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`form_submissions_submission_data_order_idx\` ON \`form_submissions_submission_data\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`form_submissions_submission_data_parent_id_idx\` ON \`form_submissions_submission_data\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`form_submissions\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`form_id\` integer NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`form_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`form_submissions_form_idx\` ON \`form_submissions\` (\`form_id\`);`)
  await db.run(sql`CREATE INDEX \`form_submissions_updated_at_idx\` ON \`form_submissions\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`form_submissions_created_at_idx\` ON \`form_submissions\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`form_submissions_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`form_submissions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`form_submissions_rels_order_idx\` ON \`form_submissions_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`form_submissions_rels_parent_idx\` ON \`form_submissions_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`form_submissions_rels_path_idx\` ON \`form_submissions_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`form_submissions_rels_users_id_idx\` ON \`form_submissions_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`_form_submissions_v_version_submission_data\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`field\` text NOT NULL,
  	\`value\` text NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_form_submissions_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_form_submissions_v_version_submission_data_order_idx\` ON \`_form_submissions_v_version_submission_data\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_form_submissions_v_version_submission_data_parent_id_idx\` ON \`_form_submissions_v_version_submission_data\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_form_submissions_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_form_id\` integer NOT NULL,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`form_submissions\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_form_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_form_submissions_v_parent_idx\` ON \`_form_submissions_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_form_submissions_v_version_version_form_idx\` ON \`_form_submissions_v\` (\`version_form_id\`);`)
  await db.run(sql`CREATE INDEX \`_form_submissions_v_version_version_updated_at_idx\` ON \`_form_submissions_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_form_submissions_v_version_version_created_at_idx\` ON \`_form_submissions_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_form_submissions_v_created_at_idx\` ON \`_form_submissions_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_form_submissions_v_updated_at_idx\` ON \`_form_submissions_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE TABLE \`_form_submissions_v_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_form_submissions_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_form_submissions_v_rels_order_idx\` ON \`_form_submissions_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_form_submissions_v_rels_parent_idx\` ON \`_form_submissions_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_form_submissions_v_rels_path_idx\` ON \`_form_submissions_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_form_submissions_v_rels_users_id_idx\` ON \`_form_submissions_v_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_kv\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`data\` text NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`payload_kv_key_idx\` ON \`payload_kv\` (\`key\`);`)
  await db.run(sql`CREATE TABLE \`payload_jobs_log\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`executed_at\` text NOT NULL,
  	\`completed_at\` text NOT NULL,
  	\`task_slug\` text NOT NULL,
  	\`task_i_d\` text NOT NULL,
  	\`input\` text NOT NULL,
  	\`output\` text,
  	\`state\` text NOT NULL,
  	\`error\` text,
  	\`parent_task_slug\` text,
  	\`parent_task_i_d\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`payload_jobs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_jobs_log_order_idx\` ON \`payload_jobs_log\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_log_parent_id_idx\` ON \`payload_jobs_log\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_jobs\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`input\` text,
  	\`meta\` text,
  	\`completed_at\` text,
  	\`total_tried\` numeric DEFAULT 0,
  	\`has_error\` integer DEFAULT false,
  	\`error\` text,
  	\`workflow_slug\` text,
  	\`task_slug\` text,
  	\`queue\` text DEFAULT 'default',
  	\`wait_until\` text,
  	\`processing_until\` text,
  	\`processing_token\` text,
  	\`concurrency_key\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_jobs_completed_at_idx\` ON \`payload_jobs\` (\`completed_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_total_tried_idx\` ON \`payload_jobs\` (\`total_tried\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_has_error_idx\` ON \`payload_jobs\` (\`has_error\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_workflow_slug_idx\` ON \`payload_jobs\` (\`workflow_slug\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_task_slug_idx\` ON \`payload_jobs\` (\`task_slug\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_queue_idx\` ON \`payload_jobs\` (\`queue\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_wait_until_idx\` ON \`payload_jobs\` (\`wait_until\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_processing_until_idx\` ON \`payload_jobs\` (\`processing_until\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_concurrency_key_idx\` ON \`payload_jobs\` (\`concurrency_key\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_updated_at_idx\` ON \`payload_jobs\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_created_at_idx\` ON \`payload_jobs\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`global_slug\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_global_slug_idx\` ON \`payload_locked_documents\` (\`global_slug\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_updated_at_idx\` ON \`payload_locked_documents\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_created_at_idx\` ON \`payload_locked_documents\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	\`pages_id\` integer,
  	\`posts_id\` integer,
  	\`categories_id\` integer,
  	\`media_id\` integer,
  	\`field_types_id\` integer,
  	\`folders_id\` integer,
  	\`tags_id\` integer,
  	\`audit_logs_id\` integer,
  	\`redirects_id\` integer,
  	\`search_id\` integer,
  	\`forms_id\` integer,
  	\`form_submissions_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`pages_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`categories_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`field_types_id\`) REFERENCES \`field_types\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`folders_id\`) REFERENCES \`folders\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`tags_id\`) REFERENCES \`tags\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`audit_logs_id\`) REFERENCES \`audit_logs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`redirects_id\`) REFERENCES \`redirects\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`search_id\`) REFERENCES \`search\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`forms_id\`) REFERENCES \`forms\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`form_submissions_id\`) REFERENCES \`form_submissions\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_pages_id_idx\` ON \`payload_locked_documents_rels\` (\`pages_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_posts_id_idx\` ON \`payload_locked_documents_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_categories_id_idx\` ON \`payload_locked_documents_rels\` (\`categories_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_field_types_id_idx\` ON \`payload_locked_documents_rels\` (\`field_types_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_folders_id_idx\` ON \`payload_locked_documents_rels\` (\`folders_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_tags_id_idx\` ON \`payload_locked_documents_rels\` (\`tags_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_audit_logs_id_idx\` ON \`payload_locked_documents_rels\` (\`audit_logs_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_redirects_id_idx\` ON \`payload_locked_documents_rels\` (\`redirects_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_search_id_idx\` ON \`payload_locked_documents_rels\` (\`search_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_forms_id_idx\` ON \`payload_locked_documents_rels\` (\`forms_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_form_submissions_id_idx\` ON \`payload_locked_documents_rels\` (\`form_submissions_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`value\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_key_idx\` ON \`payload_preferences\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_updated_at_idx\` ON \`payload_preferences\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_created_at_idx\` ON \`payload_preferences\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_users_id_idx\` ON \`payload_preferences_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_migrations\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`batch\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_migrations_updated_at_idx\` ON \`payload_migrations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_migrations_created_at_idx\` ON \`payload_migrations\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_llm_instructions\` (
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`entity_slug\` text NOT NULL,
  	\`entity_type\` text NOT NULL,
  	\`additional_instructions\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_llm_instructions_entity_slug_idx\` ON \`payload_llm_instructions\` (\`entity_slug\`);`)
  await db.run(sql`CREATE INDEX \`payload_llm_instructions_updated_at_idx\` ON \`payload_llm_instructions\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_llm_instructions_created_at_idx\` ON \`payload_llm_instructions\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_llm_instructions_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` text NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_llm_instructions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_llm_instructions_rels_order_idx\` ON \`payload_llm_instructions_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_llm_instructions_rels_parent_idx\` ON \`payload_llm_instructions_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_llm_instructions_rels_path_idx\` ON \`payload_llm_instructions_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_llm_instructions_rels_users_id_idx\` ON \`payload_llm_instructions_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`site_settings_footer_links\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`label\` text NOT NULL,
  	\`url\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`site_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`site_settings_footer_links_order_idx\` ON \`site_settings_footer_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_footer_links_parent_id_idx\` ON \`site_settings_footer_links\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`site_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`maintenance_mode\` integer,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`CREATE TABLE \`site_settings_locales\` (
  	\`site_name\` text DEFAULT 'Offload' NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`site_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`site_settings_locales_locale_parent_id_unique\` ON \`site_settings_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`site_settings_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`site_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`site_settings_rels_order_idx\` ON \`site_settings_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_rels_parent_idx\` ON \`site_settings_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_rels_path_idx\` ON \`site_settings_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_rels_users_id_idx\` ON \`site_settings_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`_site_settings_v_version_footer_links\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`label\` text NOT NULL,
  	\`url\` text NOT NULL,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_site_settings_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_site_settings_v_version_footer_links_order_idx\` ON \`_site_settings_v_version_footer_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_site_settings_v_version_footer_links_parent_id_idx\` ON \`_site_settings_v_version_footer_links\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_site_settings_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`version_maintenance_mode\` integer,
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`_site_settings_v_created_at_idx\` ON \`_site_settings_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_site_settings_v_updated_at_idx\` ON \`_site_settings_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE TABLE \`_site_settings_v_locales\` (
  	\`version_site_name\` text DEFAULT 'Offload' NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_locale\` text NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_site_settings_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`_site_settings_v_locales_locale_parent_id_unique\` ON \`_site_settings_v_locales\` (\`_locale\`,\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_site_settings_v_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_site_settings_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_site_settings_v_rels_order_idx\` ON \`_site_settings_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_site_settings_v_rels_parent_idx\` ON \`_site_settings_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_site_settings_v_rels_path_idx\` ON \`_site_settings_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_site_settings_v_rels_users_id_idx\` ON \`_site_settings_v_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`header_navigation\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`label\` text,
  	\`page_id\` integer,
  	FOREIGN KEY (\`page_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`header\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`header_navigation_order_idx\` ON \`header_navigation\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`header_navigation_parent_id_idx\` ON \`header_navigation\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`header_navigation_page_idx\` ON \`header_navigation\` (\`page_id\`);`)
  await db.run(sql`CREATE TABLE \`header\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`_status\` text DEFAULT 'draft',
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`CREATE INDEX \`header__status_idx\` ON \`header\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`header_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`header\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`header_rels_order_idx\` ON \`header_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`header_rels_parent_idx\` ON \`header_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`header_rels_path_idx\` ON \`header_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`header_rels_users_id_idx\` ON \`header_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`_header_v_version_navigation\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`label\` text,
  	\`page_id\` integer,
  	\`_uuid\` text,
  	FOREIGN KEY (\`page_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_header_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_header_v_version_navigation_order_idx\` ON \`_header_v_version_navigation\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_version_navigation_parent_id_idx\` ON \`_header_v_version_navigation\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_version_navigation_page_idx\` ON \`_header_v_version_navigation\` (\`page_id\`);`)
  await db.run(sql`CREATE TABLE \`_header_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`version__status\` text DEFAULT 'draft',
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`published_locale\` text,
  	\`latest\` integer
  );
  `)
  await db.run(sql`CREATE INDEX \`_header_v_version_version__status_idx\` ON \`_header_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_created_at_idx\` ON \`_header_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_updated_at_idx\` ON \`_header_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_published_locale_idx\` ON \`_header_v\` (\`published_locale\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_latest_idx\` ON \`_header_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`_header_v_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_header_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_header_v_rels_order_idx\` ON \`_header_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_rels_parent_idx\` ON \`_header_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_rels_path_idx\` ON \`_header_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_header_v_rels_users_id_idx\` ON \`_header_v_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_jobs_stats\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`stats\` text,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`users_sessions\`;`)
  await db.run(sql`DROP TABLE \`users_rels\`;`)
  await db.run(sql`DROP TABLE \`pages_rels\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_rels\`;`)
  await db.run(sql`DROP TABLE \`posts_locales\`;`)
  await db.run(sql`DROP TABLE \`posts_rels\`;`)
  await db.run(sql`DROP TABLE \`_posts_v_locales\`;`)
  await db.run(sql`DROP TABLE \`_posts_v_rels\`;`)
  await db.run(sql`DROP TABLE \`_posts_v\`;`)
  await db.run(sql`DROP TABLE \`field_types_rels\`;`)
  await db.run(sql`DROP TABLE \`redirects_rels\`;`)
  await db.run(sql`DROP TABLE \`_redirects_v_rels\`;`)
  await db.run(sql`DROP TABLE \`search_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`posts\`;`)
  await db.run(sql`DROP TABLE \`categories_rels\`;`)
  await db.run(sql`DROP TABLE \`media_rels\`;`)
  await db.run(sql`DROP TABLE \`_media_v_rels\`;`)
  await db.run(sql`DROP TABLE \`folders_rels\`;`)
  await db.run(sql`DROP TABLE \`_folders_v_rels\`;`)
  await db.run(sql`DROP TABLE \`tags_rels\`;`)
  await db.run(sql`DROP TABLE \`_tags_v_rels\`;`)
  await db.run(sql`DROP TABLE \`audit_logs_rels\`;`)
  await db.run(sql`DROP TABLE \`forms_rels\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_rels\`;`)
  await db.run(sql`DROP TABLE \`form_submissions_rels\`;`)
  await db.run(sql`DROP TABLE \`_form_submissions_v_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_llm_instructions_rels\`;`)
  await db.run(sql`DROP TABLE \`site_settings_rels\`;`)
  await db.run(sql`DROP TABLE \`_site_settings_v_rels\`;`)
  await db.run(sql`DROP TABLE \`header_rels\`;`)
  await db.run(sql`DROP TABLE \`_header_v_rels\`;`)
  await db.run(sql`DROP TABLE \`users\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_quote_locales\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_quote\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_cta\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_content\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_pull_quote\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_form\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_newsletter\`;`)
  await db.run(sql`DROP TABLE \`pages_breadcrumbs\`;`)
  await db.run(sql`DROP TABLE \`pages_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_version_breadcrumbs\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_quote_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_quote\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_cta\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_content\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_pull_quote\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_form\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_newsletter\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_locales\`;`)
  await db.run(sql`DROP TABLE \`_pages_v\`;`)
  await db.run(sql`DROP TABLE \`header_navigation\`;`)
  await db.run(sql`DROP TABLE \`_header_v_version_navigation\`;`)
  await db.run(sql`DROP TABLE \`pages\`;`)
  await db.run(sql`DROP TABLE \`field_types_select_many\`;`)
  await db.run(sql`DROP TABLE \`field_types_array_children\`;`)
  await db.run(sql`DROP TABLE \`field_types_array\`;`)
  await db.run(sql`DROP TABLE \`field_types_localized_array\`;`)
  await db.run(sql`DROP TABLE \`field_types_blocks_text_block\`;`)
  await db.run(sql`DROP TABLE \`field_types_blocks_list_block_items\`;`)
  await db.run(sql`DROP TABLE \`field_types_blocks_list_block\`;`)
  await db.run(sql`DROP TABLE \`field_types_locales\`;`)
  await db.run(sql`DROP TABLE \`field_types_texts\`;`)
  await db.run(sql`DROP TABLE \`field_types_numbers\`;`)
  await db.run(sql`DROP TABLE \`field_types\`;`)
  await db.run(sql`DROP TABLE \`categories\`;`)
  await db.run(sql`DROP TABLE \`media_locales\`;`)
  await db.run(sql`DROP TABLE \`_media_v_locales\`;`)
  await db.run(sql`DROP TABLE \`_media_v\`;`)
  await db.run(sql`DROP TABLE \`media\`;`)
  await db.run(sql`DROP TABLE \`_folders_v\`;`)
  await db.run(sql`DROP TABLE \`folders\`;`)
  await db.run(sql`DROP TABLE \`_tags_v\`;`)
  await db.run(sql`DROP TABLE \`tags\`;`)
  await db.run(sql`DROP TABLE \`audit_logs\`;`)
  await db.run(sql`DROP TABLE \`_redirects_v\`;`)
  await db.run(sql`DROP TABLE \`redirects\`;`)
  await db.run(sql`DROP TABLE \`search_locales\`;`)
  await db.run(sql`DROP TABLE \`search\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_checkbox_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_checkbox\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_country_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_country\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_email_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_email\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_message_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_message\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_number_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_number\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_select_options_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_select_options\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_select_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_select\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_state_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_state\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_text_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_text\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_textarea_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_blocks_textarea\`;`)
  await db.run(sql`DROP TABLE \`forms_emails_locales\`;`)
  await db.run(sql`DROP TABLE \`forms_emails\`;`)
  await db.run(sql`DROP TABLE \`forms_locales\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_blocks_checkbox_locales\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_blocks_checkbox\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_blocks_country_locales\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_blocks_country\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_blocks_email_locales\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_blocks_email\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_blocks_message_locales\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_blocks_message\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_blocks_number_locales\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_blocks_number\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_blocks_select_options_locales\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_blocks_select_options\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_blocks_select_locales\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_blocks_select\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_blocks_state_locales\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_blocks_state\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_blocks_text_locales\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_blocks_text\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_blocks_textarea_locales\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_blocks_textarea\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_version_emails_locales\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_version_emails\`;`)
  await db.run(sql`DROP TABLE \`_forms_v_locales\`;`)
  await db.run(sql`DROP TABLE \`_forms_v\`;`)
  await db.run(sql`DROP TABLE \`form_submissions_submission_data\`;`)
  await db.run(sql`DROP TABLE \`_form_submissions_v_version_submission_data\`;`)
  await db.run(sql`DROP TABLE \`_form_submissions_v\`;`)
  await db.run(sql`DROP TABLE \`form_submissions\`;`)
  await db.run(sql`DROP TABLE \`forms\`;`)
  await db.run(sql`DROP TABLE \`payload_kv\`;`)
  await db.run(sql`DROP TABLE \`payload_jobs_log\`;`)
  await db.run(sql`DROP TABLE \`payload_jobs\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences\`;`)
  await db.run(sql`DROP TABLE \`payload_migrations\`;`)
  await db.run(sql`DROP TABLE \`payload_llm_instructions\`;`)
  await db.run(sql`DROP TABLE \`site_settings_footer_links\`;`)
  await db.run(sql`DROP TABLE \`site_settings_locales\`;`)
  await db.run(sql`DROP TABLE \`site_settings\`;`)
  await db.run(sql`DROP TABLE \`_site_settings_v_version_footer_links\`;`)
  await db.run(sql`DROP TABLE \`_site_settings_v_locales\`;`)
  await db.run(sql`DROP TABLE \`_site_settings_v\`;`)
  await db.run(sql`DROP TABLE \`header\`;`)
  await db.run(sql`DROP TABLE \`_header_v\`;`)
  await db.run(sql`DROP TABLE \`payload_jobs_stats\`;`)
}
