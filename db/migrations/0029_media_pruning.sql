CREATE TABLE orphaned_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    prune_eligible_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'DETECTED',
    detection_reason TEXT,
    last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (bucket, storage_path)
);

CREATE INDEX idx_orphaned_media_status ON orphaned_media(status);
