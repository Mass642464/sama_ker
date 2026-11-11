create table public.listing_review_state (
  property_id uuid primary key references public.property_listings(id) on delete cascade,
  revision integer not null check (revision > 0),
  edited_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  check ((approved_by is null) = (approved_at is null))
);

alter table public.listing_review_state enable row level security;
revoke all on public.listing_review_state from public, anon, authenticated;
grant select on public.listing_review_state to service_role;

create table public.listing_review_contributors (
  property_id uuid not null references public.property_listings(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  primary key (property_id, user_id)
);
alter table public.listing_review_contributors enable row level security;
revoke all on public.listing_review_contributors from public, anon, authenticated;

-- Existing published records have no recorded approver and must be reviewed again.
update public.property_listings set publication_status = 'review', published_at = null, updated_at = now()
where publication_status = 'published';
update public.property_listing_media set is_published = false where is_published;

-- Only the wrappers below may call the original save operation.
revoke execute on function public.save_admin_property_listing(uuid, jsonb, jsonb) from service_role;

create function public.save_reviewable_listing(
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
  if p_property_id is not null then
    perform 1 from public.property_listings where property_listings.id = p_property_id for update;
    if not found then raise exception 'listing not found' using errcode = 'P0002'; end if;
  end if;
  select saved.id into v_id
  from public.save_admin_property_listing(p_property_id, p_listing, p_photos) as saved;
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

create function public.change_reviewable_availability(
  p_property_id uuid, p_status text, p_actor uuid
)
returns table (id uuid)
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if p_actor is null or p_status not in ('Disponible', 'À louer', 'Réservé', 'Vendu') then
    raise exception 'invalid availability' using errcode = '22023';
  end if;
  perform 1 from public.property_listings where property_listings.id = p_property_id for update;
  if not found then raise exception 'listing not found' using errcode = 'P0002'; end if;
  update public.property_listings
  set availability_status = p_status,
      publication_status = case when publication_status = 'published' then 'review' else publication_status end,
      published_at = null, updated_at = now()
  where property_listings.id = p_property_id;
  update public.property_listing_media set is_published = false where property_id = p_property_id;
  insert into public.listing_review_state (property_id, revision, edited_by)
  values (p_property_id, 1, p_actor)
  on conflict (property_id) do update
    set revision = listing_review_state.revision + 1,
        edited_by = excluded.edited_by, approved_by = null, approved_at = null;
  insert into public.listing_review_contributors (property_id, user_id)
  values (p_property_id, p_actor) on conflict do nothing;
  return query select p_property_id;
end;
$$;

create function public.approve_reviewable_listing(
  p_property_id uuid, p_revision integer, p_actor uuid
)
returns table (id uuid)
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  v_listing public.property_listings%rowtype;
  v_review public.listing_review_state%rowtype;
begin
  select * into v_listing from public.property_listings where property_listings.id = p_property_id for update;
  if not found then raise exception 'listing not found' using errcode = 'P0002'; end if;
  select * into v_review from public.listing_review_state where property_id = p_property_id for update;
  if not found or p_actor is null or exists (
    select 1 from public.listing_review_contributors
    where property_id = p_property_id and user_id = p_actor
  )
    or v_review.revision <> p_revision or v_listing.publication_status <> 'review'
    or not exists (select 1 from public.property_listing_media where property_id = p_property_id) then
    raise exception 'listing cannot be approved' using errcode = 'P0001';
  end if;
  update public.property_listings set publication_status = 'published', published_at = now(), updated_at = now()
    where property_listings.id = p_property_id;
  update public.property_listing_media set is_published = true where property_id = p_property_id;
  update public.listing_review_state set approved_by = p_actor, approved_at = now() where property_id = p_property_id;
  return query select p_property_id;
end;
$$;

revoke all on function public.save_reviewable_listing(uuid, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.change_reviewable_availability(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.approve_reviewable_listing(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.save_reviewable_listing(uuid, jsonb, jsonb, uuid) to service_role;
grant execute on function public.change_reviewable_availability(uuid, text, uuid) to service_role;
grant execute on function public.approve_reviewable_listing(uuid, integer, uuid) to service_role;
