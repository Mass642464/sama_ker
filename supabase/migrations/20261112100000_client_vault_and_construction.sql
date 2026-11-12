-- Coffre client et suivi privé des travaux. Toutes les données passent par l'API
-- vérifiée ; aucun accès direct n'est accordé aux rôles anon/authenticated.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('client-vault', 'client-vault', false, 10485760, array[
    'application/pdf', 'image/jpeg', 'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]),
  ('construction-work', 'construction-work', false, 10485760, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table public.client_vault_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  object_path text not null unique check (object_path ~ '^client/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png|docx)$'),
  original_name text not null check (char_length(btrim(original_name)) between 1 and 120),
  mime_type text not null check (mime_type in (
    'application/pdf', 'image/jpeg', 'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now()
);

create index client_vault_files_user_idx on public.client_vault_files (user_id, created_at desc);
alter table public.client_vault_files enable row level security;
revoke all on table public.client_vault_files from public, anon, authenticated;
grant all on table public.client_vault_files to service_role;

create table public.client_vault_access_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  file_id uuid not null references public.client_vault_files (id) on delete cascade,
  accessed_at timestamptz not null default now()
);
create index client_vault_access_log_user_idx on public.client_vault_access_log (user_id, accessed_at desc);
alter table public.client_vault_access_log enable row level security;
revoke all on table public.client_vault_access_log from public, anon, authenticated;
grant all on table public.client_vault_access_log to service_role;

create function public.save_client_vault_file(
  p_user uuid, p_object_path text, p_original_name text, p_mime_type text, p_size_bytes integer
)
returns setof public.client_vault_files
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  if (select count(*) from public.client_vault_files where user_id = p_user) >= 100 then
    raise exception 'vault file limit reached' using errcode = '23514';
  end if;
  return query
    insert into public.client_vault_files (user_id, object_path, original_name, mime_type, size_bytes)
    values (p_user, p_object_path, p_original_name, p_mime_type, p_size_bytes)
    returning *;
end;
$$;
revoke all on function public.save_client_vault_file(uuid, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.save_client_vault_file(uuid, text, text, text, integer) to service_role;

create function public.log_client_vault_access(p_user uuid, p_file uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (select 1 from public.client_vault_files where id = p_file and user_id = p_user) then
    raise exception 'vault file not found' using errcode = 'P0002';
  end if;
  insert into public.client_vault_access_log (user_id, file_id) values (p_user, p_file);
  delete from public.client_vault_access_log
  where user_id = p_user and id not in (
    select id from public.client_vault_access_log
    where user_id = p_user order by accessed_at desc, id desc limit 200
  );
end;
$$;
revoke all on function public.log_client_vault_access(uuid, uuid) from public, anon, authenticated;
grant execute on function public.log_client_vault_access(uuid, uuid) to service_role;

create table public.construction_work_projects (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references auth.users (id) on delete cascade,
  client_email text not null check (client_email = lower(client_email) and char_length(client_email) between 3 and 254),
  assigned_to text not null check (assigned_to = lower(assigned_to) and char_length(assigned_to) between 3 and 254),
  title text not null check (char_length(btrim(title)) between 3 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index construction_work_projects_client_idx on public.construction_work_projects (client_user_id, updated_at desc);
create index construction_work_projects_assignee_idx on public.construction_work_projects (assigned_to, updated_at desc);

create table public.construction_work_phases (
  project_id uuid not null references public.construction_work_projects (id) on delete cascade,
  phase_index smallint not null check (phase_index between 0 and 7),
  title text not null check (char_length(title) between 1 and 80),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  updated_at timestamptz not null default now(),
  primary key (project_id, phase_index)
);

create table public.construction_work_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.construction_work_projects (id) on delete cascade,
  phase_index smallint not null check (phase_index between 0 and 7),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index construction_work_updates_project_idx on public.construction_work_updates (project_id, created_at desc);

create table public.construction_work_photos (
  id uuid primary key default gen_random_uuid(),
  update_id uuid not null references public.construction_work_updates (id) on delete cascade,
  object_path text not null unique check (object_path ~ '^project/[0-9a-f-]{36}/update/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png)$'),
  original_name text not null check (char_length(btrim(original_name)) between 1 and 120),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now()
);
create index construction_work_photos_update_idx on public.construction_work_photos (update_id, created_at);

create table public.construction_work_notifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.construction_work_projects (id) on delete cascade,
  update_id uuid not null references public.construction_work_updates (id) on delete cascade,
  notified_at timestamptz not null default now(),
  unique (update_id)
);

alter table public.construction_work_projects enable row level security;
alter table public.construction_work_phases enable row level security;
alter table public.construction_work_updates enable row level security;
alter table public.construction_work_photos enable row level security;
alter table public.construction_work_notifications enable row level security;

revoke all on table public.construction_work_projects, public.construction_work_phases,
  public.construction_work_updates, public.construction_work_photos,
  public.construction_work_notifications from public, anon, authenticated;
grant all on table public.construction_work_projects, public.construction_work_phases,
  public.construction_work_updates, public.construction_work_photos,
  public.construction_work_notifications to service_role;

alter table public.staff_members drop constraint if exists staff_members_role_check;
alter table public.staff_members add constraint staff_members_role_check
  check (role in ('admin', 'responsable', 'commercial', 'technique', 'direction', 'responsable_travaux'));

alter table public.client_notifications drop constraint if exists client_notifications_kind_check;
alter table public.client_notifications add constraint client_notifications_kind_check
  check (kind in ('request_status', 'construction_update'));

-- A privileged API can bind a project to an already-confirmed account without
-- exposing the auth.users table through PostgREST.
create function public.confirmed_user_id_for_email(p_email text)
returns uuid
language sql
security definer
set search_path = pg_catalog, auth
as $$
  select id from auth.users
  where lower(email) = lower(p_email) and email_confirmed_at is not null
  limit 1
$$;
revoke all on function public.confirmed_user_id_for_email(text) from public, anon, authenticated;
grant execute on function public.confirmed_user_id_for_email(text) to service_role;

create function public.publish_construction_work_update(p_update uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_update public.construction_work_updates%rowtype;
  v_project public.construction_work_projects%rowtype;
begin
  select * into v_update
  from public.construction_work_updates
  where id = p_update
  for update;
  if not found or v_update.status <> 'draft' then
    raise exception 'draft not found' using errcode = 'P0002';
  end if;

  select * into v_project
  from public.construction_work_projects
  where id = v_update.project_id
  for update;
  if not found then
    raise exception 'project not found' using errcode = 'P0002';
  end if;

  update public.construction_work_updates
  set status = 'published', published_at = now()
  where id = p_update;

  update public.construction_work_phases
  set status = 'in_progress', updated_at = now()
  where project_id = v_project.id and phase_index = v_update.phase_index
    and status = 'pending';

  update public.construction_work_projects
  set updated_at = now()
  where id = v_project.id;

  insert into public.construction_work_notifications (project_id, update_id)
  values (v_project.id, p_update);

  insert into public.client_notifications (user_id, email, kind, title, body)
  values (
    v_project.client_user_id,
    v_project.client_email,
    'construction_update',
    'Nouvelle mise à jour de votre chantier',
    'Une nouvelle étape a été publiée pour votre chantier « ' || v_project.title || ' ». Consultez Mon espace pour le détail.'
  );
end;
$$;
revoke all on function public.publish_construction_work_update(uuid) from public, anon, authenticated;
grant execute on function public.publish_construction_work_update(uuid) to service_role;

create or replace function public.erase_client_account(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_anonymised integer;
begin
  delete from public.lead_events where lead_id in (select id from public.crm_leads where user_id = p_user);
  delete from public.lead_reminders where lead_id in (select id from public.crm_leads where user_id = p_user);

  update public.crm_leads
  set full_name = 'Compte supprimé',
      email = 'supprime@invalid.example',
      message = '',
      user_id = null,
      assigned_to = null,
      updated_at = now()
  where user_id = p_user;
  get diagnostics v_anonymised = row_count;

  delete from public.contact_requests where user_id = p_user;
  delete from public.client_notifications where user_id = p_user;
  delete from public.client_alerts where user_id = p_user;
  delete from public.client_favorites where user_id = p_user;
  delete from public.client_vault_files where user_id = p_user;
  delete from public.client_vault_access_log where user_id = p_user;
  delete from public.construction_work_projects where client_user_id = p_user;
  return v_anonymised;
end;
$$;

revoke all on function public.erase_client_account(uuid) from public, anon, authenticated;
grant execute on function public.erase_client_account(uuid) to service_role;
