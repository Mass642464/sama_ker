-- Une proposition est une demande, jamais une réservation garantie.
alter table public.contact_requests add column visit_starts_at timestamptz;

create function public.create_appointment_from_visit_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_lead_id uuid;
begin
  if new.visit_starts_at is null then
    return new;
  end if;
  if new.user_id is null or new.subject <> 'visit' or new.visit_starts_at <= now()
    or not exists (
      select 1 from public.property_listings
      where reference = new.property_reference
        and publication_status = 'published'
        and availability_status <> 'Vendu'
    ) then
    raise exception 'invalid visit request' using errcode = '22023';
  end if;

  select id into v_lead_id from public.crm_leads where contact_request_id = new.id;
  if v_lead_id is null then
    raise exception 'visit request has no associated lead' using errcode = '23503';
  end if;

  insert into public.admin_appointments (lead_id, contact_name, contact_email, purpose, starts_at)
  values (v_lead_id, new.full_name, new.email, 'Demande de visite · Réf. ' || new.property_reference, new.visit_starts_at);
  return new;
end;
$$;

revoke all on function public.create_appointment_from_visit_request() from public, anon, authenticated;

-- PostgreSQL exécute les triggers de même événement par ordre alphabétique.
create trigger z_visit_request_to_appointment
  after insert on public.contact_requests
  for each row execute function public.create_appointment_from_visit_request();

create function public.notify_client_on_appointment_status()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.client_notifications (user_id, email, kind, title, body)
  select lead.user_id, lead.email, 'request_status',
    'Votre rendez-vous a changé de statut',
    'Rendez-vous du ' || to_char(new.starts_at at time zone 'Africa/Dakar', 'DD/MM/YYYY à HH24:MI')
      || ' (heure du Sénégal) : ' || new.status || '. Consultez Mon espace pour le suivi.'
  from public.crm_leads as lead
  where lead.id = new.lead_id and lead.user_id is not null;
  return new;
end;
$$;

revoke all on function public.notify_client_on_appointment_status() from public, anon, authenticated;

create trigger appointment_status_notification
  after update of status on public.admin_appointments
  for each row
  when (old.status is distinct from new.status)
  execute function public.notify_client_on_appointment_status();

-- L'effacement du compte doit aussi anonymiser les rendez-vous liés à ses demandes.
create or replace function public.erase_client_account(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_anonymised integer;
begin
  update public.admin_appointments
  set contact_name = 'Compte supprimé',
      contact_email = 'supprime@invalid.example',
      purpose = 'Rendez-vous anonymisé',
      location = '',
      updated_at = now()
  where lead_id in (select id from public.crm_leads where user_id = p_user);

  delete from public.lead_events where lead_id in (select id from public.crm_leads where user_id = p_user);
  delete from public.lead_reminders where lead_id in (select id from public.crm_leads where user_id = p_user);
  update public.crm_leads
  set full_name = 'Compte supprimé', email = 'supprime@invalid.example', message = '',
      user_id = null, assigned_to = null, updated_at = now()
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
