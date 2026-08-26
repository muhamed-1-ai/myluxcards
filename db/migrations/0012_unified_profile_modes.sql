-- Migration 0012: Unified QR Profile Modes (Vehicle Connect, Lost & Found, Emergency Contact)
create index if not exists digital_cards_profile_mode_idx on digital_cards((profile->>'profileMode')) where active;
