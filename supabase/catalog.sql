create table public.clothing_catalog_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.clothing_catalog_admins enable row level security;
revoke all on public.clothing_catalog_admins from anon, authenticated;
grant select on public.clothing_catalog_admins to authenticated;
create policy "Catalog admin sees own membership" on public.clothing_catalog_admins
  for select to authenticated using (user_id = (select auth.uid()));

create table public.clothing_catalog_products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  category text not null check (char_length(trim(category)) between 1 and 60),
  description text not null check (char_length(trim(description)) between 1 and 2000),
  price integer not null check (price between 1 and 99999999),
  sizes text not null default '' check (char_length(sizes) <= 100),
  image_key text not null check (image_key ~ '^[0-9a-f-]{36}$'),
  created_at timestamptz not null default now()
);
alter table public.clothing_catalog_products enable row level security;
revoke all on public.clothing_catalog_products from anon, authenticated;
grant select on public.clothing_catalog_products to anon, authenticated;
grant insert, update, delete on public.clothing_catalog_products to authenticated;
create policy "Catalog products are public" on public.clothing_catalog_products
  for select to anon, authenticated using (true);
create policy "Catalog admins manage products" on public.clothing_catalog_products
  for all to authenticated
  using ((select exists (select 1 from public.clothing_catalog_admins where user_id = (select auth.uid()))))
  with check ((select exists (select 1 from public.clothing_catalog_admins where user_id = (select auth.uid()))));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clothing-catalog-photos', 'clothing-catalog-photos', true, 52428800, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Catalog admins read photo objects" on storage.objects for select to authenticated
  using (bucket_id = 'clothing-catalog-photos' and (select exists (select 1 from public.clothing_catalog_admins where user_id = (select auth.uid()))));
create policy "Catalog admins upload photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'clothing-catalog-photos' and name ~ '^[0-9a-f-]{36}$' and (select exists (select 1 from public.clothing_catalog_admins where user_id = (select auth.uid()))));
create policy "Catalog admins remove photos" on storage.objects for delete to authenticated
  using (bucket_id = 'clothing-catalog-photos' and (select exists (select 1 from public.clothing_catalog_admins where user_id = (select auth.uid()))));
