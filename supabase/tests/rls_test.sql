-- Tests der Zugriffsrechte. Ausführen: supabase/tests/run.sh
\set ON_ERROR_STOP 1

-- Testdaten (als Superuser, umgeht RLS)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'marcel@team'),
  ('00000000-0000-0000-0000-00000000000b', 'kunde.a@app'),
  ('00000000-0000-0000-0000-00000000000c', 'kunde.b@app'),
  ('00000000-0000-0000-0000-00000000000d', 'ex.mitarbeiter@team');
insert into staff (id, full_name, initials, role, can_work_alone, is_drone_pilot) values
  ('00000000-0000-0000-0000-00000000000a', 'Marcel', 'MT', 'admin', true, true),
  ('00000000-0000-0000-0000-00000000000d', 'Ehemalig', 'EH', 'field', false, false);
update staff set active = false where id = '00000000-0000-0000-0000-00000000000d';
insert into customers (id, name) values
  ('10000000-0000-0000-0000-00000000000a', 'Familie Weber'),
  ('10000000-0000-0000-0000-00000000000b', 'Hof Lindner GbR');
insert into customer_users values
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-00000000000b');
insert into plants (id, customer_id, kwp, area_m2, module_count) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 9.8, 42, 24),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 256, 1250, 640);
insert into documents (customer_id, type, number, status, net_amount) values
  ('10000000-0000-0000-0000-00000000000a', 'angebot', null, 'entwurf', 450),
  ('10000000-0000-0000-0000-00000000000a', 'rechnung', 'RE-1', 'versendet', 450);

create or replace function assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'TEST FEHLGESCHLAGEN: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;
grant execute on function assert(boolean, text) to anon, authenticated;

-- ── Team ────────────────────────────────────────────────────
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select assert((select count(*) from customers) = 2, 'Team sieht alle Kunden');
select assert((select count(*) from documents) = 2, 'Team sieht alle Belege inkl. Entwurf');
insert into orders (customer_id, service_id, source, crew_size, estimated_price) values
  ('10000000-0000-0000-0000-00000000000b', 'reinigung', 'website', 2, 1950);
select assert((select estimated_price from orders where source = 'website') = 1950, 'Team darf Richtpreis setzen');
select assert((select order_no from orders where source = 'website') ~ '^SE-\d{2}-\d{4}$', 'Auftragsnummer wird erzeugt');
select assert((select count(*) from events where kind = 'buchung') = 1, 'Buchung landet in der Historie');
update orders set status = 'angenommen' where source = 'website';
select assert((select count(*) from events where kind = 'status') = 1, 'Statuswechsel landet in der Historie');
commit;

-- ── Ehemaliger Mitarbeiter (deaktiviert) ────────────────────
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true);
select assert((select count(*) from customers) = 0, 'Deaktivierter Mitarbeiter sieht keine Kunden');
commit;

-- ── Kunde A ─────────────────────────────────────────────────
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
select assert((select count(*) from customers) = 1, 'Kunde sieht nur sich selbst');
select assert((select count(*) from plants) = 1, 'Kunde sieht nur eigene Anlage');
select assert((select count(*) from orders) = 0, 'Kunde sieht fremde Aufträge nicht');
select assert((select count(*) from events) = 0, 'Kunde sieht keine interne Historie');
select assert((select count(*) from documents) = 1, 'Kunde sieht nur versendete Belege, keine Entwürfe');
select assert((select count(*) from services) = 3, 'Kunde sieht Leistungen und Preise');
update plants set kwp = 10.2, heavily_soiled = true where id = '20000000-0000-0000-0000-00000000000a';
select assert((select kwp from plants where id = '20000000-0000-0000-0000-00000000000a') = 10.2, 'Kunde kann eigene kWp ändern');
select assert((select heavily_soiled from plants where id = '20000000-0000-0000-0000-00000000000a') = false, 'Kunde kann Verschmutzungs-Einstufung nicht ändern');
update plants set kwp = 1 where id = '20000000-0000-0000-0000-00000000000b';
commit;
select assert((select kwp from plants where id = '20000000-0000-0000-0000-00000000000b') = 256, 'Kunde kann fremde Anlage nicht ändern');

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
insert into orders (customer_id, plant_id, service_id, source, wish_slot, estimated_price) values
  ('10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'reinigung', 'app', 'vormittag', 1);
select assert((select count(*) from orders) = 1, 'Kunde kann eigene Buchung anlegen und sehen');
select assert((select estimated_price from orders) is null, 'Richtpreis vom Handy wird verworfen');
commit;

-- Verbotene Buchungen müssen scheitern
do $$
declare blocked int := 0;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
  set local role authenticated;
  begin
    insert into orders (customer_id, service_id, source) values ('10000000-0000-0000-0000-00000000000b', 'reinigung', 'app');
  exception when insufficient_privilege then blocked := blocked + 1; end;
  begin
    insert into orders (customer_id, service_id, source, status) values ('10000000-0000-0000-0000-00000000000a', 'reinigung', 'app', 'eingeplant');
  exception when insufficient_privilege then blocked := blocked + 1; end;
  begin
    insert into orders (customer_id, plant_id, service_id, source) values ('10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000b', 'reinigung', 'app');
  exception when insufficient_privilege then blocked := blocked + 1; end;
  begin
    update orders set status = 'erledigt';
    if found then raise exception 'Kunde konnte Status ändern'; end if;
    blocked := blocked + 1;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('photos', '10000000-0000-0000-0000-00000000000b/x.jpg');
  exception when insufficient_privilege then blocked := blocked + 1; end;
  insert into storage.objects (bucket_id, name) values ('photos', '10000000-0000-0000-0000-00000000000a/dach.jpg');
  perform assert(blocked = 5, 'Fremde Buchung, Status-Manipulation, fremde Anlage, Statusänderung und fremder Foto-Ordner blockiert; eigener Upload erlaubt');
end $$;

-- ── Nicht angemeldet ────────────────────────────────────────
begin;
set local role anon;
select assert((select count(*) from customers) = 0, 'Anonym sieht keine Kunden');
select assert((select count(*) from services) = 0, 'Anonym sieht keine Preise');
commit;

\echo 'ALLE TESTS BESTANDEN'
