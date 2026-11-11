create table if not exists public.property_listings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  reference text not null unique check (char_length(btrim(reference)) between 2 and 40),
  category text not null check (category in ('terrain', 'immobilier')),
  title text not null check (char_length(btrim(title)) between 5 and 140),
  region text not null check (char_length(btrim(region)) between 2 and 80),
  location_label text not null check (char_length(btrim(location_label)) between 2 and 100),
  price_amount bigint not null check (price_amount > 0),
  price_period text not null check (price_period in ('total', 'monthly')),
  area_m2 numeric(10, 2) not null check (area_m2 > 0),
  property_type text not null check (char_length(btrim(property_type)) between 2 and 80),
  availability_status text not null check (availability_status in ('Disponible', 'À louer', 'Réservé', 'Vendu')),
  description text not null check (char_length(btrim(description)) between 20 and 2000),
  features text[] not null default '{}',
  publication_status text not null default 'draft' check (publication_status in ('draft', 'review', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (publication_status <> 'published' or published_at is not null),
  check (cardinality(features) <= 12)
);

create index if not exists property_listings_public_order_idx
  on public.property_listings (published_at desc)
  where publication_status = 'published';

create table if not exists public.property_listing_media (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.property_listings (id) on delete cascade,
  image_url text not null check (image_url ~ '^https://'),
  alt_text text not null check (char_length(btrim(alt_text)) between 10 and 240),
  credit text not null check (char_length(btrim(credit)) between 2 and 160),
  source_url text check (source_url is null or source_url ~ '^https://'),
  position smallint not null default 0 check (position between 0 and 11),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (property_id, position)
);

create index if not exists property_listing_media_public_order_idx
  on public.property_listing_media (property_id, position)
  where is_published;

alter table public.property_listings enable row level security;
alter table public.property_listing_media enable row level security;

revoke all on table public.property_listings from anon, authenticated;
revoke all on table public.property_listing_media from anon, authenticated;
grant select on table public.property_listings to anon, authenticated;
grant select on table public.property_listing_media to anon, authenticated;

create policy "Public can read published listings"
  on public.property_listings
  for select
  to anon, authenticated
  using (publication_status = 'published');

create policy "Public can read published listing media"
  on public.property_listing_media
  for select
  to anon, authenticated
  using (
    is_published
    and exists (
      select 1
      from public.property_listings
      where property_listings.id = property_listing_media.property_id
        and property_listings.publication_status = 'published'
    )
  );
