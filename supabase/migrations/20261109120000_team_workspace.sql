-- Espace équipe : rôles, journal d'audit, affectation, historique des échanges et relances.
-- Toutes ces tables sont privées : seul le backend (service_role) y accède.

create table public.staff_members (
  email text primary key check (email = lower(email) and char_length(email) between 3 and 254),
  role text not null check (role in ('admin', 'responsable', 'commercial', 'technique', 'direction')),
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.staff_members enable row level security;
revoke all on table public.staff_members from public, anon, authenticated;
grant all on table public.staff_members to service_role;

-- Journal d'audit en ajout seul : aucune donnée personnelle ni contenu de message dans `details`.
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_email text not null check (char_length(actor_email) between 3 and 254),
  action text not null check (char_length(action) between 3 and 80),
  entity text not null check (char_length(entity) between 2 and 40),
  entity_id text check (entity_id is null or char_length(entity_id) <= 80),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object')
);

create index audit_log_at_idx on public.audit_log (at desc);

alter table public.audit_log enable row level security;
revoke all on table public.audit_log from public, anon, authenticated;
grant select, insert on table public.audit_log to service_role;
revoke update, delete, truncate on table public.audit_log from service_role;

create function public.audit_log_is_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only' using errcode = '42501';
end;
$$;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function public.audit_log_is_append_only();

alter table public.crm_leads
  add column if not exists assigned_to text check (assigned_to is null or assigned_to = lower(assigned_to));

create index if not exists crm_leads_assigned_to_idx on public.crm_leads (assigned_to) where assigned_to is not null;

create table public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads (id) on delete cascade,
  at timestamptz not null default now(),
  actor_email text not null check (char_length(actor_email) between 3 and 254),
  kind text not null check (kind in ('note', 'reply', 'stage', 'assignment', 'reminder')),
  body text not null default '' check (char_length(body) <= 2000)
);

create index lead_events_lead_idx on public.lead_events (lead_id, at desc);

alter table public.lead_events enable row level security;
revoke all on table public.lead_events from public, anon, authenticated;
grant all on table public.lead_events to service_role;

create table public.lead_reminders (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads (id) on delete cascade,
  due_at timestamptz not null,
  note text not null default '' check (char_length(note) <= 500),
  assigned_to text check (assigned_to is null or assigned_to = lower(assigned_to)),
  created_by text not null check (char_length(created_by) between 3 and 254),
  created_at timestamptz not null default now(),
  done_at timestamptz
);

create index lead_reminders_open_idx on public.lead_reminders (due_at) where done_at is null;
create index lead_reminders_lead_idx on public.lead_reminders (lead_id);

alter table public.lead_reminders enable row level security;
revoke all on table public.lead_reminders from public, anon, authenticated;
grant all on table public.lead_reminders to service_role;
