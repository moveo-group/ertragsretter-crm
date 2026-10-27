-- Zugriffsrechte (Row-Level-Security)
-- Grundsatz:
--   • Team (Tabelle staff, aktiv) darf alles lesen und schreiben.
--   • Endkunden (customer_users) sehen nur ihre eigenen Daten, dürfen ihre Anlagen pflegen,
--     Buchungen anlegen (immer Status „neu“, Quelle „app“) und Fotos hochladen.
--   • Nicht angemeldete Besucher sehen nichts.

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where id = auth.uid() and active);
$$;

create or replace function my_customer_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select customer_id from customer_users where user_id = auth.uid();
$$;

revoke all on function is_staff() from public;
revoke all on function my_customer_ids() from public;
grant execute on function is_staff() to authenticated;
grant execute on function my_customer_ids() to authenticated;

-- RLS auf allen Tabellen einschalten
alter table settings          enable row level security;
alter table staff             enable row level security;
alter table customers         enable row level security;
alter table customer_users    enable row level security;
alter table contacts          enable row level security;
alter table plants            enable row level security;
alter table site_assessments  enable row level security;
alter table photos            enable row level security;
alter table services          enable row level security;
alter table orders            enable row level security;
alter table appointments      enable row level security;
alter table appointment_staff enable row level security;
alter table documents         enable row level security;
alter table events            enable row level security;

-- Team: Vollzugriff auf alles
do $$
declare t text;
begin
  foreach t in array array['settings','staff','customers','customer_users','contacts','plants',
                           'site_assessments','photos','services','orders','appointments',
                           'appointment_staff','documents','events']
  loop
    execute format('create policy staff_all on %I for all to authenticated using (is_staff()) with check (is_staff())', t);
  end loop;
end $$;

-- Alle Angemeldeten: Leistungen und Rechenwerte lesen (für Preis- und Verlustanzeige in der App)
create policy read_services on services for select to authenticated using (active);
create policy read_settings on settings for select to authenticated using (true);

-- Team-Mitglied sieht sich selbst (auch wenn deaktiviert, für Login-Hinweis)
create policy staff_self on staff for select to authenticated using (id = auth.uid());

-- Endkunden ───────────────────────────────────────────────────
create policy cust_own_link on customer_users for select to authenticated
  using (user_id = auth.uid());

create policy cust_read on customers for select to authenticated
  using (id in (select my_customer_ids()));

create policy cust_contacts_read on contacts for select to authenticated
  using (customer_id in (select my_customer_ids()));

create policy cust_plants_read on plants for select to authenticated
  using (customer_id in (select my_customer_ids()));
create policy cust_plants_insert on plants for insert to authenticated
  with check (customer_id in (select my_customer_ids()));
create policy cust_plants_update on plants for update to authenticated
  using (customer_id in (select my_customer_ids()))
  with check (customer_id in (select my_customer_ids()));

create policy cust_orders_read on orders for select to authenticated
  using (customer_id in (select my_customer_ids()));
create policy cust_orders_insert on orders for insert to authenticated
  with check (
    customer_id in (select my_customer_ids())
    and status = 'neu'
    and source = 'app'
    and crew_size is null
    and (plant_id is null or plant_id in (select id from plants where customer_id in (select my_customer_ids())))
  );

create policy cust_documents_read on documents for select to authenticated
  using (customer_id in (select my_customer_ids()) and status <> 'entwurf');

create policy cust_photos_read on photos for select to authenticated
  using (customer_id in (select my_customer_ids()));
create policy cust_photos_insert on photos for insert to authenticated
  with check (customer_id in (select my_customer_ids()) and source = 'kunde');

-- Endkunden dürfen an Anlagen nur Stammdaten ändern, nicht die Verschmutzungs-Einstufung des Teams
create or replace function guard_plant_customer_update() returns trigger
language plpgsql as $$
begin
  if not is_staff() then
    new.heavily_soiled := old.heavily_soiled;
    new.customer_id    := old.customer_id;
  end if;
  return new;
end $$;
create trigger plants_guard before update on plants for each row execute function guard_plant_customer_update();

-- Endkunden-Buchungen: Richtpreis und Besetzung setzt der Server, nicht das Handy
create or replace function guard_order_customer_insert() returns trigger
language plpgsql as $$
begin
  if not is_staff() then
    new.estimated_price := null;
    new.needs_robot     := false;
    new.created_by      := auth.uid();
  end if;
  return new;
end $$;
create trigger orders_guard before insert on orders for each row execute function guard_order_customer_insert();

-- ─────────────────────────────────────────────────────────────
-- Storage: privater Bucket „photos“, Ordner = customer_id
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('photos', 'photos', false)
on conflict (id) do nothing;

create policy photos_staff_all on storage.objects for all to authenticated
  using (bucket_id = 'photos' and is_staff())
  with check (bucket_id = 'photos' and is_staff());

create policy photos_customer_read on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] in (select id::text from my_customer_ids() as id));

create policy photos_customer_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] in (select id::text from my_customer_ids() as id));
