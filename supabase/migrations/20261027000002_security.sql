-- Zugriffsrechte (Row-Level-Security)
-- Grundsatz:
--   • Team-Mitglieder (Tabelle staff, aktiv) bekommen Rechte einzeln:
--       perm_customers  Kunden, Ansprechpartner, Anlagen, Fotos, Zugang, Aufträge
--       perm_dispatch   Termine/Disposition (liest dafür auch Kunden- und Auftragsdaten)
--       perm_finance    Angebote, Rechnungen, Zahlungen, offene Posten, Umsätze, Finanz-Historie
--       perm_team       Mitarbeiter anlegen, Rechte vergeben
--       perm_settings   Preise, Leistungen, Regeln ändern
--   • Endkunden (customer_users) sehen nur ihre eigenen Daten, dürfen ihre Anlagen pflegen,
--     Buchungen anlegen (immer Status „neu“, Quelle „app“) und Fotos hochladen.
--   • Nicht angemeldete Besucher sehen nichts.

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where id = auth.uid() and active);
$$;

-- Prüft ein einzelnes Recht des angemeldeten Mitarbeiters
create or replace function has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case p
      when 'customers' then perm_customers
      when 'dispatch'  then perm_dispatch
      when 'finance'   then perm_finance
      when 'team'      then perm_team
      when 'settings'  then perm_settings
      else false end
    from staff where id = auth.uid() and active
  ), false);
$$;

create or replace function my_customer_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select customer_id from customer_users where user_id = auth.uid();
$$;

revoke all on function is_staff() from public;
revoke all on function has_perm(text) from public;
revoke all on function my_customer_ids() from public;
grant execute on function is_staff() to authenticated;
grant execute on function has_perm(text) to authenticated;
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

-- ── Team: Stammdaten der Kunden ─────────────────────────────
-- Lesen: Kunden-Recht oder Disposition (die Planung braucht Namen, Adresse, Anlage, Zugang)
-- Schreiben: nur Kunden-Recht
do $$
declare t text;
begin
  foreach t in array array['customers','contacts','plants','site_assessments','photos']
  loop
    execute format('create policy staff_read on %I for select to authenticated using (has_perm(''customers'') or has_perm(''dispatch''))', t);
    execute format('create policy staff_write on %I for insert to authenticated with check (has_perm(''customers''))', t);
    execute format('create policy staff_update on %I for update to authenticated using (has_perm(''customers'')) with check (has_perm(''customers''))', t);
    execute format('create policy staff_delete on %I for delete to authenticated using (has_perm(''customers''))', t);
  end loop;
end $$;

create policy staff_all on customer_users for all to authenticated
  using (has_perm('customers')) with check (has_perm('customers'));

-- ── Team: Aufträge (Kunden-Recht oder Disposition) ──────────
create policy staff_all on orders for all to authenticated
  using (has_perm('customers') or has_perm('dispatch'))
  with check (has_perm('customers') or has_perm('dispatch'));

-- ── Team: Termine (Disposition; Kunden-Recht darf lesen) ────
create policy staff_read on appointments for select to authenticated using (has_perm('dispatch') or has_perm('customers'));
create policy staff_write on appointments for all to authenticated using (has_perm('dispatch')) with check (has_perm('dispatch'));
create policy staff_read on appointment_staff for select to authenticated using (has_perm('dispatch') or has_perm('customers'));
create policy staff_write on appointment_staff for all to authenticated using (has_perm('dispatch')) with check (has_perm('dispatch'));

-- ── Team: Finanzen ──────────────────────────────────────────
create policy staff_all on documents for all to authenticated
  using (has_perm('finance')) with check (has_perm('finance'));

-- ── Team: Historie – Finanz-Einträge nur mit Finanz-Recht ───
create policy staff_read on events for select to authenticated
  using ((has_perm('customers') or has_perm('dispatch'))
         and (kind not in ('rechnung', 'zahlung', 'mahnung') or has_perm('finance')));
create policy staff_write on events for insert to authenticated
  with check ((has_perm('customers') or has_perm('dispatch'))
              and (kind not in ('rechnung', 'zahlung', 'mahnung') or has_perm('finance')));

-- ── Team: Mitarbeiter ───────────────────────────────────────
-- Alle aktiven Team-Mitglieder sehen die Kollegen (Namen für Disposition), Rechte ändern nur mit Team-Recht
create policy staff_read on staff for select to authenticated using (is_staff() or id = auth.uid());
create policy staff_manage on staff for all to authenticated using (has_perm('team')) with check (has_perm('team'));

-- Schutz vor Aussperren: niemand nimmt sich selbst das Team-Recht oder deaktiviert sich selbst
create or replace function guard_staff_self() returns trigger
language plpgsql as $$
begin
  if new.id = auth.uid() and (not new.perm_team or not new.active) then
    raise exception 'Du kannst dir das Recht „Mitarbeiter verwalten“ nicht selbst entziehen oder dich deaktivieren.';
  end if;
  return new;
end $$;
create trigger staff_guard_self before update on staff for each row execute function guard_staff_self();

-- ── Leistungen & Einstellungen ──────────────────────────────
create policy read_services on services for select to authenticated using (active or is_staff());
create policy staff_write on services for all to authenticated using (has_perm('settings')) with check (has_perm('settings'));
create policy read_settings on settings for select to authenticated using (true);
create policy staff_write on settings for all to authenticated using (has_perm('settings')) with check (has_perm('settings'));

-- ── Endkunden ───────────────────────────────────────────────
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

create policy photos_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (has_perm('customers') or has_perm('dispatch')));
create policy photos_staff_write on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and has_perm('customers'));
create policy photos_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and has_perm('customers'));

create policy photos_customer_read on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] in (select id::text from my_customer_ids() as id));

create policy photos_customer_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] in (select id::text from my_customer_ids() as id));
