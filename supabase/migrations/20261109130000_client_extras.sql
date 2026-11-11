-- Extras de l'espace client : favoris, alertes, notifications de suivi et effacement du compte.
-- Tables privées : seul le backend (service_role) y accède, en filtrant sur l'identifiant vérifié du compte.

create table public.client_favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  property_slug text not null check (char_length(property_slug) <= 120 and property_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  primary key (user_id, property_slug)
);

alter table public.client_favorites enable row level security;
revoke all on table public.client_favorites from public, anon, authenticated;
grant all on table public.client_favorites to service_role;

-- Alerte : critères de recherche enregistrés. L'envoi d'alertes n'est pas activé (aucun fournisseur d'e-mail configuré).
create table public.client_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  criteria jsonb not null check (jsonb_typeof(criteria) = 'object' and octet_length(criteria::text) <= 1000),
  created_at timestamptz not null default now()
);

create index client_alerts_user_idx on public.client_alerts (user_id, created_at desc);

alter table public.client_alerts enable row level security;
revoke all on table public.client_alerts from public, anon, authenticated;
grant all on table public.client_alerts to service_role;

-- Notifications de suivi : affichées dans l'espace client et file d'attente pour un futur envoi d'e-mail.
create table public.client_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254),
  kind text not null check (kind in ('request_status')),
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) <= 500),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  sent_at timestamptz,
  send_attempts smallint not null default 0 check (send_attempts >= 0)
);

create index client_notifications_user_idx on public.client_notifications (user_id, created_at desc);
create index client_notifications_unsent_idx on public.client_notifications (created_at) where sent_at is null;

alter table public.client_notifications enable row level security;
revoke all on table public.client_notifications from public, anon, authenticated;
grant all on table public.client_notifications to service_role;

create function public.notify_client_on_stage_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.user_id is not null then
    insert into public.client_notifications (user_id, email, kind, title, body)
    values (
      new.user_id,
      new.email,
      'request_status',
      'Votre demande a changé d’étape',
      'Votre demande « ' || new.interest || ' » est désormais : ' || new.pipeline_stage || '. Consultez Mon espace pour le détail.'
    );
  end if;
  return new;
end;
$$;

revoke all on function public.notify_client_on_stage_change() from public, anon, authenticated;

create trigger crm_lead_stage_notification
  after update of pipeline_stage on public.crm_leads
  for each row
  when (old.pipeline_stage is distinct from new.pipeline_stage)
  execute function public.notify_client_on_stage_change();

-- Effacement : retire les demandes et notes liées au compte, anonymise le prospect (conservation commerciale minimale),
-- puis le backend supprime le compte d'authentification. Idempotent.
create function public.erase_client_account(p_user uuid)
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
  return v_anonymised;
end;
$$;

revoke all on function public.erase_client_account(uuid) from public, anon, authenticated;
grant execute on function public.erase_client_account(uuid) to service_role;
