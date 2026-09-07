-- Migration 0025: Order Fulfillment Data
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_data JSONB DEFAULT '{}'::jsonb;
