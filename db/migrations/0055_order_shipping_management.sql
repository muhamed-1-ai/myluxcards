-- Migration 0055: Order Shipping Management
-- Add dedicated shipping columns to orders table while preserving all existing columns and data.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_status text DEFAULT 'Preparing';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatched_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS actual_delivery_at timestamptz;

-- Index for efficient shipping status lookups and order filtering
CREATE INDEX IF NOT EXISTS orders_shipping_status_idx ON orders(shipping_status);

-- Backfill compatible shipping status for existing orders based on their current status and fulfillment data
UPDATE orders
SET shipping_status = CASE
  WHEN status = 'DELIVERED' THEN 'Delivered'
  WHEN status = 'SHIPPED' THEN 'Shipped'
  WHEN status IN ('CANCELLED', 'REFUNDED') THEN 'Returned'
  ELSE 'Preparing'
END
WHERE shipping_status IS NULL;
