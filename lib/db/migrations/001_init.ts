/**
 * 001 — core schema. Money is stored as integer MINOR units (LYD: 1 dinar = 1000 dirham).
 * Every bearer secret is stored only as an HMAC-SHA256 hash. Guest link tokens are additionally
 * stored AES-256-GCM encrypted so the paying customer can copy the link again later.
 */
export const sql = /* sql */ `
create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table admin_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  totp_secret_enc text,
  totp_enabled boolean not null default false,
  totp_last_step bigint not null default 0,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table themes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name_ar text not null,
  description_ar text not null default '',
  category text not null default 'classic',
  status text not null default 'draft' check (status in ('draft','active','disabled')),
  featured boolean not null default false,
  sort_order int not null default 0,
  price_minor bigint not null check (price_minor >= 0),
  currency text not null default 'LYD' check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table theme_versions (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references themes(id),
  version int not null check (version > 0),
  renderer text not null,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'published' check (status in ('draft','published','retired')),
  created_at timestamptz not null default now(),
  unique (theme_id, version)
);

create table theme_color_variants (
  id uuid primary key default gen_random_uuid(),
  theme_version_id uuid not null references theme_versions(id),
  key text not null check (key ~ '^[a-z0-9-]{2,40}$'),
  name_ar text not null,
  swatch text not null,
  status text not null default 'active' check (status in ('active','disabled')),
  is_default boolean not null default false,
  sort_order int not null default 0,
  unique (theme_version_id, key)
);

create table affiliates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  region text,
  referral_code text not null unique check (referral_code ~ '^[A-Z0-9]{4,20}$'),
  commission_rate_bps int not null default 1500 check (commission_rate_bps between 0 and 10000),
  can_issue_tokens boolean not null default false,
  status text not null default 'active' check (status in ('active','disabled')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table affiliate_rate_history (
  id bigserial primary key,
  affiliate_id uuid not null references affiliates(id),
  rate_bps int not null,
  changed_by uuid references admin_users(id),
  created_at timestamptz not null default now()
);

create table affiliate_credentials (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id),
  token_hash text not null unique,
  token_hint text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz
);
create index affiliate_credentials_aff on affiliate_credentials(affiliate_id);

create table referral_visits (
  id bigserial primary key,
  affiliate_id uuid not null references affiliates(id),
  visitor_hash text not null,
  landing_path text not null default '/',
  created_at timestamptz not null default now()
);
create index referral_visits_aff on referral_visits(affiliate_id, created_at desc);

-- A "sale": cash was collected IN PERSON (outside the website) and a customer token was issued.
-- There is no online checkout: only the owner, or an affiliate the owner explicitly trusts, can
-- create one, and only from their authenticated dashboard.
create table orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  idempotency_key text not null unique,
  status text not null default 'paid' check (status in ('paid','cancelled','refunded','partially_refunded')),
  theme_id uuid not null references themes(id),
  theme_version_id uuid not null references theme_versions(id),
  color_variant_key text not null,
  guest_limit int not null check (guest_limit between 1 and 5000),
  list_price_minor bigint not null check (list_price_minor >= 0),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null,
  customer_name text not null check (char_length(customer_name) between 1 and 120),
  customer_phone text not null default '',
  affiliate_id uuid references affiliates(id),
  attribution_source text check (attribution_source in ('issued_by_affiliate','assigned_by_owner')),
  commission_rate_bps int check (commission_rate_bps between 0 and 10000),
  issued_by_type text not null check (issued_by_type in ('owner','affiliate')),
  issued_by_id uuid not null,
  note text not null default '',
  support_status text not null default 'none' check (support_status in ('none','open','resolved')),
  created_at timestamptz not null default now(),
  paid_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create index orders_created on orders(created_at desc);
create index orders_affiliate on orders(affiliate_id, created_at desc);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  provider text not null check (provider in ('cash','bank_transfer','other')),
  idempotency_key text not null unique,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null,
  received_by_type text not null check (received_by_type in ('owner','affiliate')),
  received_by_id uuid not null,
  reference_note text not null default '',
  received_at timestamptz not null default now(),
  remitted_at timestamptz,
  remitted_note text not null default '',
  created_at timestamptz not null default now()
);
-- At most one payment per sale: repeated submissions can never double-provision.
create unique index payments_one_per_order on payments(order_id);

create table refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  payment_id uuid not null references payments(id),
  kind text not null check (kind in ('refund','chargeback')),
  amount_minor bigint not null check (amount_minor > 0),
  note text not null default '',
  idempotency_key text not null unique,
  created_by uuid references admin_users(id),
  created_at timestamptz not null default now()
);

create table customer_workspaces (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id),
  status text not null default 'active' check (status in ('active','suspended')),
  access_expires_at timestamptz not null,
  recovery_phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table customer_credentials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references customer_workspaces(id),
  token_hash text not null unique,
  token_hint text not null,
  reason text not null check (reason in ('purchase','rotation','owner_reissue','recovery')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz
);
create index customer_credentials_ws on customer_credentials(workspace_id);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references customer_workspaces(id),
  theme_version_id uuid not null references theme_versions(id),
  color_variant_key text not null,
  guest_limit int not null check (guest_limit between 1 and 5000),
  content jsonb not null,
  pages jsonb not null,
  settings jsonb not null,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table invitation_assets (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references invitations(id),
  kind text not null check (kind in ('photo','audio')),
  storage_key text not null unique,
  mime text not null,
  bytes int not null,
  width int,
  height int,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index invitation_assets_inv on invitation_assets(invitation_id);

create table guests (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references invitations(id),
  display_name text not null check (char_length(display_name) between 1 and 120),
  max_party_size int not null default 1 check (max_party_size between 1 and 50),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index guests_inv on guests(invitation_id) where deleted_at is null;

create table guest_links (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id),
  invitation_id uuid not null references invitations(id),
  token_hash text not null unique,
  token_enc text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  open_count int not null default 0
);
create unique index guest_links_one_live on guest_links(guest_id) where revoked_at is null;
create index guest_links_inv on guest_links(invitation_id);

create table rsvp_responses (
  guest_id uuid primary key references guests(id),
  invitation_id uuid not null references invitations(id),
  status text not null check (status in ('accepted','declined')),
  party_size int not null default 0 check (party_size between 0 and 50),
  link_id uuid references guest_links(id),
  responded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rsvp_inv on rsvp_responses(invitation_id);

create table rsvp_history (
  id bigserial primary key,
  guest_id uuid not null references guests(id),
  status text not null,
  party_size int not null,
  link_id uuid references guest_links(id),
  ip_hash text not null default '',
  created_at timestamptz not null default now()
);

create table commission_records (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id),
  order_id uuid not null references orders(id),
  kind text not null check (kind in ('sale','adjustment')),
  basis_minor bigint not null,
  rate_bps int not null check (rate_bps between 0 and 10000),
  amount_minor bigint not null,
  currency text not null,
  status text not null check (status in ('pending','approved','paid','reversed')),
  reason text not null default '',
  refund_id uuid references refunds(id),
  payout_id uuid,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz,
  reversed_at timestamptz,
  check ((kind = 'sale' and amount_minor >= 0) or (kind = 'adjustment' and amount_minor <= 0))
);
-- Exactly one sale commission per order, whatever happens to the confirmation request.
create unique index commission_one_sale_per_order on commission_records(order_id) where kind = 'sale';
create index commission_aff on commission_records(affiliate_id, status);

create table commission_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references affiliates(id),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null,
  method text not null check (method in ('cash','bank_transfer','retained_from_cash','other')),
  reference text not null default '',
  paid_on date not null,
  note text not null default '',
  created_by uuid references admin_users(id),
  created_at timestamptz not null default now()
);
alter table commission_records add constraint commission_payout_fk foreign key (payout_id) references commission_payouts(id);

create table sessions (
  id_hash text primary key,
  role text not null check (role in ('owner','affiliate','customer')),
  subject_id uuid not null,
  csrf_token text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  ip_hash text not null default '',
  user_agent text not null default ''
);
create index sessions_subject on sessions(role, subject_id);

create table crm_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  author_id uuid references admin_users(id),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table audit_logs (
  id bigserial primary key,
  actor_type text not null check (actor_type in ('owner','affiliate','customer','guest','system')),
  actor_id text not null default '',
  action text not null,
  target_type text not null default '',
  target_id text not null default '',
  details jsonb not null default '{}'::jsonb,
  ip_hash text not null default '',
  created_at timestamptz not null default now()
);
create index audit_created on audit_logs(created_at desc);

create table rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null
);

-- Defence in depth for Supabase: lock every table away from the public PostgREST roles.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
  end if;
end $$;
`;
