-- Migration 0023: Add first-time legal and cookie consent columns to users table

alter table users
  add column if not exists terms_accepted boolean not null default false,
  add column if not exists privacy_accepted boolean not null default false,
  add column if not exists cookie_consent boolean not null default false,
  add column if not exists terms_version text,
  add column if not exists privacy_version text,
  add column if not exists cookie_version text,
  add column if not exists legal_accepted_at timestamptz;
