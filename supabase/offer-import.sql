alter table public.clothing_catalog_products
  add column old_price integer check (old_price between 1 and 99999999 and old_price > price),
  add column gallery_keys text[] not null default '{}' check (
    cardinality(gallery_keys) <= 49
    and array_to_string(gallery_keys, ',') ~ '^([0-9a-f-]{36}(,[0-9a-f-]{36})*)?$'
  );
