-- Espace client : rattache une demande de contact à un compte authentifié et à son prospect CRM.
alter table public.contact_requests
  add column if not exists user_id uuid references auth.users (id) on delete set null;

alter table public.crm_leads
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create index if not exists contact_requests_user_id_idx
  on public.contact_requests (user_id, created_at desc) where user_id is not null;

create index if not exists crm_leads_user_id_idx
  on public.crm_leads (user_id, created_at desc) where user_id is not null;

create or replace function public.create_crm_lead_from_contact_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.crm_leads (
    contact_request_id, user_id, full_name, email, interest, source, message
  )
  values (
    new.id,
    new.user_id,
    new.full_name,
    new.email,
    case new.subject
      when 'property' then 'Demande sur un bien'
      when 'visit' then 'Demande de visite'
      when 'geospatial' then 'Étude géospatiale'
      when 'report' then 'Signalement'
      else 'Autre demande'
    end || case
      when new.property_reference is null then ''
      else ' · Réf. ' || new.property_reference
    end,
    'Site web',
    new.message
  )
  on conflict (contact_request_id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_crm_lead_from_contact_request() from public, anon, authenticated;
