-- Fiches SIG internes distinctes des données publiques : aucun accès direct aux rôles navigateur.
create table public.listing_geospatial_profiles (
  property_id uuid primary key references public.property_listings(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.listing_geospatial_profiles enable row level security;
revoke all on public.listing_geospatial_profiles from public, anon, authenticated;
grant select, insert, update, delete on public.listing_geospatial_profiles to service_role;
