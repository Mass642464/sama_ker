create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  contact_request_id uuid unique references public.contact_requests (id) on delete set null,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  email text not null check (char_length(email) between 3 and 254),
  interest text not null check (char_length(btrim(interest)) between 2 and 240),
  source text not null check (char_length(btrim(source)) between 2 and 80),
  message text not null default '' check (char_length(message) <= 4000),
  pipeline_stage text not null default 'Nouveau'
    check (pipeline_stage in ('Nouveau', 'À qualifier', 'Visite planifiée', 'Dossier ouvert', 'Fermé')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_leads_created_at_idx on public.crm_leads (created_at desc);
create index if not exists crm_leads_pipeline_stage_idx on public.crm_leads (pipeline_stage, created_at desc);

alter table public.crm_leads enable row level security;
revoke all on table public.crm_leads from anon, authenticated;
grant all on table public.crm_leads to service_role;

create or replace function public.create_crm_lead_from_contact_request()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.crm_leads (
    contact_request_id, full_name, email, interest, source, message
  )
  values (
    new.id,
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

drop trigger if exists contact_request_to_crm_lead on public.contact_requests;
create trigger contact_request_to_crm_lead
  after insert on public.contact_requests
  for each row execute function public.create_crm_lead_from_contact_request();

insert into public.crm_leads (
  contact_request_id, full_name, email, interest, source, message, created_at
)
select
  id,
  full_name,
  email,
  case subject
    when 'property' then 'Demande sur un bien'
    when 'visit' then 'Demande de visite'
    when 'geospatial' then 'Étude géospatiale'
    when 'report' then 'Signalement'
    else 'Autre demande'
  end || case
    when property_reference is null then ''
    else ' · Réf. ' || property_reference
  end,
  'Site web',
  message,
  created_at
from public.contact_requests
on conflict (contact_request_id) do nothing;

create table if not exists public.admin_appointments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads (id) on delete set null,
  contact_name text not null check (char_length(btrim(contact_name)) between 2 and 120),
  contact_email text not null check (char_length(contact_email) between 3 and 254),
  purpose text not null check (char_length(btrim(purpose)) between 3 and 240),
  starts_at timestamptz not null,
  location text not null default '' check (char_length(location) <= 240),
  status text not null default 'À confirmer'
    check (status in ('À confirmer', 'Confirmé', 'Annulé')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_appointments_starts_at_idx
  on public.admin_appointments (starts_at);

alter table public.admin_appointments enable row level security;
revoke all on table public.admin_appointments from anon, authenticated;
grant all on table public.admin_appointments to service_role;

create or replace function public.save_admin_property_listing(
  p_property_id uuid,
  p_listing jsonb,
  p_photos jsonb
)
returns table (id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
  v_features text[];
begin
  if jsonb_typeof(p_listing) is distinct from 'object'
    or jsonb_typeof(p_photos) is distinct from 'array' then
    raise exception 'invalid listing payload' using errcode = '22023';
  end if;
  if jsonb_array_length(p_photos) > 12 then
    raise exception 'invalid listing payload' using errcode = '22023';
  end if;
  if p_listing ? 'features' then
    if jsonb_typeof(p_listing->'features') is distinct from 'array' then
      raise exception 'invalid listing payload' using errcode = '22023';
    end if;
  end if;
  if jsonb_array_length(coalesce(p_listing->'features', '[]'::jsonb)) > 12 then
    raise exception 'invalid listing payload' using errcode = '22023';
  end if;

  select array_agg(feature)
  into v_features
  from jsonb_array_elements_text(coalesce(p_listing->'features', '[]'::jsonb)) as features(feature);

  if p_property_id is null then
    insert into public.property_listings (
      slug, reference, category, title, region, location_label, price_amount, price_period,
      area_m2, property_type, availability_status, description, features,
      publication_status, published_at
    )
    values (
      p_listing->>'slug',
      p_listing->>'reference',
      p_listing->>'category',
      p_listing->>'title',
      p_listing->>'region',
      p_listing->>'location_label',
      (p_listing->>'price_amount')::bigint,
      p_listing->>'price_period',
      (p_listing->>'area_m2')::numeric,
      p_listing->>'property_type',
      p_listing->>'availability_status',
      p_listing->>'description',
      coalesce(v_features, '{}'),
      p_listing->>'publication_status',
      case when p_listing->>'publication_status' = 'published' then now() else null end
    )
    returning property_listings.id into v_id;
  else
    update public.property_listings
    set reference = p_listing->>'reference',
        category = p_listing->>'category',
        title = p_listing->>'title',
        region = p_listing->>'region',
        location_label = p_listing->>'location_label',
        price_amount = (p_listing->>'price_amount')::bigint,
        price_period = p_listing->>'price_period',
        area_m2 = (p_listing->>'area_m2')::numeric,
        property_type = p_listing->>'property_type',
        availability_status = p_listing->>'availability_status',
        description = p_listing->>'description',
        features = coalesce(v_features, '{}'),
        publication_status = p_listing->>'publication_status',
        published_at = case
          when p_listing->>'publication_status' = 'published' then coalesce(property_listings.published_at, now())
          else null
        end,
        updated_at = now()
    where property_listings.id = p_property_id
    returning property_listings.id into v_id;

    if v_id is null then
      raise exception 'listing not found' using errcode = 'P0002';
    end if;
  end if;

  delete from public.property_listing_media where property_id = v_id;

  insert into public.property_listing_media (
    property_id, image_url, alt_text, credit, source_url, position, is_published
  )
  select
    v_id,
    photo->>'src',
    photo->>'alt',
    photo->>'credit',
    nullif(photo->>'sourceUrl', ''),
    (photo_number - 1)::smallint,
    p_listing->>'publication_status' = 'published'
  from jsonb_array_elements(p_photos) with ordinality as item(photo, photo_number);

  return query select v_id;
end;
$$;

revoke all on function public.save_admin_property_listing(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_admin_property_listing(uuid, jsonb, jsonb) to service_role;
