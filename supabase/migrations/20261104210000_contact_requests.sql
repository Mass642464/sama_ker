create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  email text not null check (char_length(email) between 3 and 254),
  subject text not null check (subject in ('property', 'visit', 'geospatial', 'report', 'other')),
  message text not null check (char_length(message) between 10 and 4000),
  property_reference text check (property_reference is null or char_length(property_reference) <= 80),
  consented_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists contact_requests_created_at_idx
  on public.contact_requests (created_at desc);

alter table public.contact_requests enable row level security;
revoke all on table public.contact_requests from anon, authenticated;
grant insert on table public.contact_requests to service_role;

create table if not exists public.contact_request_rate_limits (
  email_hash text primary key check (email_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  attempts smallint not null check (attempts between 1 and 4)
);

create index if not exists contact_request_rate_limits_window_started_at_idx
  on public.contact_request_rate_limits (window_started_at);

alter table public.contact_request_rate_limits enable row level security;
revoke all on table public.contact_request_rate_limits from anon, authenticated;
grant all on table public.contact_request_rate_limits to service_role;

create or replace function public.consume_contact_request_rate_limit(p_email_hash text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  attempt_count integer;
begin
  if p_email_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid rate-limit key';
  end if;

  delete from public.contact_request_rate_limits
  where window_started_at < v_now - interval '24 hours';

  insert into public.contact_request_rate_limits (email_hash, window_started_at, attempts)
  values (p_email_hash, v_now, 1)
  on conflict (email_hash) do update
  set window_started_at = case
        when public.contact_request_rate_limits.window_started_at <= v_now - interval '15 minutes'
          then v_now
        else public.contact_request_rate_limits.window_started_at
      end,
      attempts = case
        when public.contact_request_rate_limits.window_started_at <= v_now - interval '15 minutes'
          then 1
        else least(public.contact_request_rate_limits.attempts + 1, 4)
      end
  returning attempts into attempt_count;

  return attempt_count <= 3;
end;
$$;

revoke all on function public.consume_contact_request_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_contact_request_rate_limit(text) to service_role;
