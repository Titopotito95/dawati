/**
 * 003 — uploaded photos / music stored in Postgres (default storage driver "db").
 * Keeps hosting to a single service: no separate bucket or storage keys to configure.
 * Sizes are bounded by the app (photos re-encoded ≤ ~300 KB, music ≤ 6 MB, ≤ 6 photos per invitation).
 */
export const sql = /* sql */ `
create table if not exists media_blobs (
  key text primary key,
  mime text not null,
  body bytea not null,
  created_at timestamptz not null default now()
);
alter table media_blobs enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on media_blobs from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on media_blobs from authenticated';
  end if;
end $$;
`;
