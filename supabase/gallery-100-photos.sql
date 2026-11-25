alter table public.clothing_catalog_products
  drop constraint clothing_catalog_products_gallery_keys_check,
  add constraint clothing_catalog_products_gallery_keys_check check (
    cardinality(gallery_keys) <= 99
    and array_to_string(gallery_keys, ',') ~ '^([0-9a-f-]{36}(,[0-9a-f-]{36})*)?$'
  );
