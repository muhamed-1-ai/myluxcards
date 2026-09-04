-- Migration: 0022_dashboard_layout_preferences.sql
-- Add dashboard_layout preference column to users table

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dashboard_layout" VARCHAR(32) NOT NULL DEFAULT 'business';
