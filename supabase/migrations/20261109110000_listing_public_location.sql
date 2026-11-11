-- Position publique approximative d'une annonce : arrondie à 0,01° (environ 1 km), jamais l'emplacement exact.
-- Elle suit le circuit de validation existant : toute modification retire l'annonce publiée et exige une nouvelle approbation.
alter table public.property_listings
  add column if not exists public_latitude numeric(5, 2),
  add column if not exists public_longitude numeric(5, 2);

alter table public.property_listings
  add constraint property_listings_public_location_check check (
    (public_latitude is null and public_longitude is null)
    or (public_latitude between 12.0 and 16.8 and public_longitude between -17.8 and -11.3)
  );

create or replace function public.save_reviewable_listing(
  p_property_id uuid, p_listing jsonb, p_photos jsonb, p_actor uuid
)
returns table (id uuid)
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
begin
  if p_actor is null or p_listing->>'publication_status' not in ('draft', 'review', 'archived') then
    raise exception 'invalid reviewable listing' using errcode = '22023';
  end if;
  if (nullif(p_listing->>'public_latitude', '') is null) <> (nullif(p_listing->>'public_longitude', '') is null) then
    raise exception 'invalid listing location' using errcode = '22023';
  end if;
  if p_property_id is not null then
    perform 1 from public.property_listings where property_listings.id = p_property_id for update;
    if not found then raise exception 'listing not found' using errcode = 'P0002'; end if;
  end if;
  select saved.id into v_id
  from public.save_admin_property_listing(p_property_id, p_listing, p_photos) as saved;
  update public.property_listings
  set public_latitude = round(nullif(p_listing->>'public_latitude', '')::numeric, 2),
      public_longitude = round(nullif(p_listing->>'public_longitude', '')::numeric, 2)
  where property_listings.id = v_id;
  insert into public.listing_review_state (property_id, revision, edited_by)
  values (v_id, 1, p_actor)
  on conflict (property_id) do update
    set revision = listing_review_state.revision + 1,
        edited_by = excluded.edited_by, approved_by = null, approved_at = null;
  insert into public.listing_review_contributors (property_id, user_id)
  values (v_id, p_actor) on conflict do nothing;
  return query select v_id;
end;
$$;
