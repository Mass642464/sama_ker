-- Un seul changement en attente par visite ; la ligne est verrouillée lors de chaque transition.
create table public.visit_workflows (
  appointment_id uuid primary key references public.admin_appointments(id) on delete cascade,
  pending text not null default 'none' check (pending in ('none', 'cancel', 'reschedule', 'offer')),
  proposed_at timestamptz,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  check ((pending in ('reschedule', 'offer')) = (proposed_at is not null))
);

alter table public.visit_workflows enable row level security;
revoke all on table public.visit_workflows from public, anon, authenticated;
grant all on table public.visit_workflows to service_role;

insert into public.visit_workflows (appointment_id)
select a.id from public.admin_appointments a
join public.crm_leads l on l.id = a.lead_id
join public.contact_requests c on c.id = l.contact_request_id
where c.visit_starts_at is not null
on conflict do nothing;

create function public.register_visit_workflow()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if exists (
    select 1 from public.crm_leads l join public.contact_requests c on c.id = l.contact_request_id
    where l.id = new.lead_id and c.visit_starts_at is not null
  ) then
    insert into public.visit_workflows (appointment_id) values (new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.register_visit_workflow() from public, anon, authenticated;
create trigger appointment_visit_workflow after insert on public.admin_appointments
for each row execute function public.register_visit_workflow();

-- Les anciens changements de statut ne doivent pas contourner les demandes en attente.
create function public.guard_visit_appointment()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if (new.status is distinct from old.status or new.starts_at is distinct from old.starts_at)
    and exists (select 1 from public.visit_workflows where appointment_id = old.id)
    and current_setting('sama_keur.visit_transition', true) is distinct from 'allowed'
  then
    raise exception 'use visit workflow' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_visit_appointment() from public, anon, authenticated;
create trigger guard_visit_appointment before update on public.admin_appointments
for each row execute function public.guard_visit_appointment();

create function public.list_visit_workflows(p_user uuid, p_offset integer)
returns jsonb language sql security definer set search_path = pg_catalog, public
as $$
  select coalesce(jsonb_agg(item order by updated_at desc, appointment_id desc), '[]'::jsonb)
  from (
    select w.updated_at, w.appointment_id, jsonb_build_object(
      'id', a.id, 'startsAt', a.starts_at, 'status', a.status,
      'purpose', a.purpose, 'pending', w.pending, 'proposedAt', w.proposed_at,
      'revision', w.revision
    ) || case when p_user is null then jsonb_build_object(
      'contactName', a.contact_name, 'contactEmail', a.contact_email
    ) else '{}'::jsonb end as item
    from public.visit_workflows w
    join public.admin_appointments a on a.id = w.appointment_id
    join public.crm_leads l on l.id = a.lead_id
    where (p_user is null or l.user_id = p_user)
    order by w.updated_at desc, w.appointment_id desc
    limit 51 offset p_offset
  ) x;
$$;
revoke all on function public.list_visit_workflows(uuid, integer) from public, anon, authenticated;
grant execute on function public.list_visit_workflows(uuid, integer) to service_role;

create function public.transition_visit(
  p_appointment uuid, p_user uuid, p_action text, p_proposed timestamptz, p_revision integer
)
returns boolean language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_appt public.admin_appointments%rowtype;
  v_flow public.visit_workflows%rowtype;
  v_user uuid;
  v_email text;
  v_pending text;
  v_proposed timestamptz;
  v_status text;
  v_start timestamptz;
begin
  select a.* into v_appt from public.admin_appointments a where a.id = p_appointment for update;
  if not found then return false; end if;
  select * into v_flow from public.visit_workflows where appointment_id = p_appointment for update;
  if not found or v_flow.revision <> p_revision then return false; end if;
  select user_id, email into v_user, v_email from public.crm_leads where id = v_appt.lead_id;
  if v_user is null or (p_user is not null and p_user <> v_user) or v_appt.status = 'Annulé' then
    return false;
  end if;
  v_pending := v_flow.pending;
  v_proposed := v_flow.proposed_at;
  v_status := v_appt.status;
  v_start := v_appt.starts_at;

  if p_user is not null then
    if p_action = 'accept_offer' and v_pending = 'offer' and v_proposed > now() then
      v_start := v_proposed; v_status := 'Confirmé'; v_pending := 'none'; v_proposed := null;
    elsif p_action = 'request_cancel' and v_pending in ('none', 'offer') then
      v_pending := 'cancel'; v_proposed := null;
    elsif p_action = 'request_reschedule' and v_pending in ('none', 'offer')
      and p_proposed > now() then
      v_pending := 'reschedule'; v_proposed := p_proposed;
    else return false;
    end if;
  else
    if p_action = 'confirm' and v_pending = 'none' and v_status = 'À confirmer' and v_start > now() then
      v_status := 'Confirmé';
    elsif p_action = 'accept_cancel' and v_pending = 'cancel' then
      v_status := 'Annulé'; v_pending := 'none'; v_proposed := null;
    elsif p_action = 'reject_request' and v_pending in ('cancel', 'reschedule') then
      v_pending := 'none'; v_proposed := null;
    elsif p_action = 'propose' and v_pending in ('none', 'reschedule', 'offer') and p_proposed > now() then
      v_pending := 'offer'; v_proposed := p_proposed;
    else return false;
    end if;
  end if;

  perform set_config('sama_keur.visit_transition', 'allowed', true);
  update public.admin_appointments set status = v_status, starts_at = v_start, updated_at = now()
  where id = p_appointment;
  perform set_config('sama_keur.visit_transition', '', true);
  update public.visit_workflows set pending = v_pending, proposed_at = v_proposed,
    revision = revision + 1, updated_at = now() where appointment_id = p_appointment;

  if p_user is null and p_action in ('propose', 'reject_request') then
    insert into public.client_notifications (user_id, email, kind, title, body)
    values (v_user, v_email, 'request_status', 'Votre visite a été actualisée',
      case when p_action = 'propose' then 'Une nouvelle date vous est proposée. Consultez Mon espace pour l’accepter.'
      else 'L’agence a répondu à votre demande de modification. Consultez Mon espace.' end);
  end if;
  return true;
end;
$$;
revoke all on function public.transition_visit(uuid, uuid, text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.transition_visit(uuid, uuid, text, timestamptz, integer) to service_role;
