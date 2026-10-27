-- OPTIONAL: Beispieldaten zum Ausprobieren (Familie Weber, Hof Lindner GbR).
-- Vor dem echten Start wieder löschen:  delete from customers where lead_source = 'DEMO';
do $$
declare
  weber uuid; lindner uuid; p_weber uuid; p_frei uuid; p_scheune uuid;
begin
  insert into customers (name, kind, street, zip, city, lead_source, created_at)
    values ('Familie Weber', 'privat', 'Sonnenweg 12', '00000', 'Musterstadt', 'DEMO', now() - interval '2 days')
    returning id into weber;
  insert into customers (name, kind, street, zip, city, lead_source, created_at)
    values ('Hof Lindner GbR', 'landwirtschaft', 'Feldweg 3', '00000', 'Musterdorf', 'DEMO', '2026-03-28')
    returning id into lindner;

  insert into plants (customer_id, name, kwp, area_m2, module_count, roof, build_year, last_cleaning)
    values (weber, 'Hausdach', 9.8, 42, 24, 'schraegdach', 2019, 'ueber_24') returning id into p_weber;
  insert into plants (customer_id, name, kwp, area_m2, module_count, roof, tilt_deg, build_year, last_cleaned_on)
    values (lindner, 'Freifläche Süd', 256, 1250, 640, 'freiflaeche', 20, 2015, '2026-04-22') returning id into p_frei;
  insert into plants (customer_id, name, kwp, area_m2, module_count, roof, tilt_deg, build_year, last_cleaned_on, heavily_soiled)
    values (lindner, 'Scheunendach', 84, 420, 210, 'schraegdach', 30, 2018, '2026-04-22', true) returning id into p_scheune;

  insert into site_assessments (plant_id, lift, lift_note, drone_hose, drone_hose_note, robot, robot_note, water, water_note, access_road, access_road_note, assessed_on) values
    (p_frei, 'nein', 'nicht nötig', 'pruefen', 'Mittelspannungsleitung im Nordosten', 'ja', 'durchgehende Modulreihen, 20°', 'ja', 'Hydrant am Hof, ca. 40 m Schlauch', 'pruefen', 'Feldweg unbefestigt, bei Nässe eingeschränkt', '2026-04-02'),
    (p_scheune, 'ja', 'Hofeinfahrt gepflastert, Stellfläche 6 × 4 m', 'pruefen', 'Baumreihe Westseite 8 m', 'nein', 'Schrägdach 30°', 'ja', 'Hydrant am Hof', 'ja', 'gepflastert', '2026-04-02'),
    (p_weber, 'pruefen', null, 'pruefen', null, 'nein', null, 'ja', 'Wasseranschluss am Carport', 'ja', null, null);

  insert into contacts (customer_id, name, role, is_decision_maker) values (lindner, 'Hubert Lindner', 'Inhaber', true);
  insert into contacts (customer_id, name, role, is_invoice_recipient) values (lindner, 'Katrin Lindner', 'Buchhaltung', true);
  insert into contacts (customer_id, name, role, is_onsite_contact) values (lindner, 'Lukas Bauer', 'Hofmitarbeiter', true);

  insert into documents (customer_id, type, number, description, issued_on, due_on, net_amount, status, sent_on, paid_on, reminder_on) values
    (lindner, 'rechnung', 'RE-2026-0118', 'Reinigung Freifläche 1.250 m² × 1,56 €/m²', '2026-04-22', '2026-05-06', 1950, 'bezahlt', '2026-04-22', '2026-05-06', null),
    (lindner, 'rechnung', 'RE-2026-0131', 'Reinigung Scheunendach 420 m² × 2,70 €/m² (stark verschmutzt)', '2026-04-22', '2026-05-06', 1134, 'bezahlt', '2026-04-22', '2026-05-20', '2026-05-13');

  insert into orders (customer_id, plant_id, service_id, source, wish_date, wish_slot, customer_note, area_m2, created_at) values
    (lindner, p_frei, 'reinigung', 'website', '2026-11-05', 'ganztags', 'Zweite Reinigung nach April. Starker Staub durch Ernte.', 1250, now() - interval '40 minutes'),
    (weber, p_weber, 'reinigung', 'app', '2026-11-04', 'vormittag', 'Wasseranschluss am Carport.', 42, now() - interval '2 minutes');
end $$;
