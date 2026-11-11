-- Fichiers privés des annonces (justificatifs, documents) : bucket Supabase Storage non public, 10 Mo, jpg/png/pdf.
-- Aucune URL publique : le backend signe des liens de téléchargement de courte durée pour l'équipe habilitée.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-files', 'private-files', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table public.listing_files (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.property_listings (id) on delete cascade,
  object_path text not null unique check (object_path ~ '^listing/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|pdf)$'),
  original_name text not null check (char_length(btrim(original_name)) between 1 and 120),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'application/pdf')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index listing_files_property_idx on public.listing_files (property_id, created_at desc);

alter table public.listing_files enable row level security;
revoke all on table public.listing_files from public, anon, authenticated;
grant all on table public.listing_files to service_role;
