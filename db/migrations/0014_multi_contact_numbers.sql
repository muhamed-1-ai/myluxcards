-- Migration 0014: Normalized Account Contact Numbers & Emergency Contacts

-- 1. Account Contact Numbers Table
create table if not exists account_contact_numbers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  label text not null default 'Personal',
  country_code text not null default '',
  phone_number text not null,
  is_primary boolean not null default false,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists account_contact_numbers_user_id_idx on account_contact_numbers(user_id);

-- 2. Emergency Contacts Table
create table if not exists emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  relationship text not null default '',
  is_primary boolean not null default false,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists emergency_contacts_user_id_idx on emergency_contacts(user_id);

-- 3. Emergency Contact Numbers Table
create table if not exists emergency_contact_numbers (
  id uuid primary key default gen_random_uuid(),
  emergency_contact_id uuid not null references emergency_contacts(id) on delete cascade,
  label text not null default 'Mobile',
  country_code text not null default '',
  phone_number text not null,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists emergency_contact_numbers_contact_id_idx on emergency_contact_numbers(emergency_contact_id);

-- 4. Idempotent Data Migration from Legacy Profile Fields
insert into account_contact_numbers (user_id, label, phone_number, is_primary)
select distinct on (dc.owner_id)
  dc.owner_id,
  'Personal',
  coalesce(
    nullif(trim(dc.profile->>'defaultContactPhone'), ''),
    nullif(trim(dc.profile->>'mobile'), ''),
    nullif(trim(dc.profile->>'whatsapp'), '')
  ),
  true
from digital_cards dc
where (
  nullif(trim(dc.profile->>'defaultContactPhone'), '') is not null
  or nullif(trim(dc.profile->>'mobile'), '') is not null
  or nullif(trim(dc.profile->>'whatsapp'), '') is not null
)
and not exists (
  select 1 from account_contact_numbers acn where acn.user_id = dc.owner_id
)
order by dc.owner_id, dc.updated_at desc;

with inserted_contacts as (
  insert into emergency_contacts (user_id, name, relationship, is_primary)
  select distinct on (dc.owner_id)
    dc.owner_id,
    coalesce(
      nullif(trim(dc.profile->>'defaultEmergencyName'), ''),
      nullif(trim(dc.profile->('emergencyContact')->>'name'), ''),
      'Emergency Contact'
    ),
    coalesce(
      nullif(trim(dc.profile->>'defaultEmergencyRelationship'), ''),
      nullif(trim(dc.profile->('emergencyContact')->>'relationship'), ''),
      ''
    ),
    true
  from digital_cards dc
  where (
    nullif(trim(dc.profile->>'defaultEmergencyName'), '') is not null
    or nullif(trim(dc.profile->('emergencyContact')->>'name'), '') is not null
    or nullif(trim(dc.profile->>'defaultEmergencyPhone'), '') is not null
    or nullif(trim(dc.profile->('emergencyContact')->>'phone'), '') is not null
  )
  and not exists (
    select 1 from emergency_contacts ec where ec.user_id = dc.owner_id
  )
  order by dc.owner_id, dc.updated_at desc
  returning id, user_id
)
insert into emergency_contact_numbers (emergency_contact_id, label, phone_number, is_primary)
select
  ic.id,
  'Mobile',
  coalesce(
    nullif(trim(dc.profile->>'defaultEmergencyPhone'), ''),
    nullif(trim(dc.profile->('emergencyContact')->>'phone'), '')
  ),
  true
from inserted_contacts ic
join digital_cards dc on dc.owner_id = ic.user_id
where (
  nullif(trim(dc.profile->>'defaultEmergencyPhone'), '') is not null
  or nullif(trim(dc.profile->('emergencyContact')->>'phone'), '') is not null
);
