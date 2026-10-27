-- Stammdaten: Leistungen, Preise und Regeln (Stand Finanzplanung 26.10.2026)
insert into services (id, name, description, bookable_in_app, price_per_m2, price_per_m2_heavy, min_price, min_price_below_m2, flat_price, duration_minutes, sort) values
  ('reinigung',    'PV-Reinigung',
   'Schonende Modulreinigung mit entmineralisiertem Wasser – per Hand, Hebebühne oder Reinigungsroboter. Inklusive Vorher-Nachher-Fotos.',
   true, 1.56, 2.70, 450.00, 300, null, null, 1),
  ('inspektion',   'Optische Inspektion & Vorgespräch',
   'Sichtprüfung vor Ort, Klärung von Zugang, Wasseranschluss und Reinigungsmethode.',
   true, null, null, null, null, null, 75, 2),
  ('thermografie', 'Thermografieflug',
   'Drohnenflug mit Wärmebildkamera, nur bei klarem Himmel und hoher Einstrahlung.',
   false, null, null, null, null, null, 90, 3)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, price_per_m2 = excluded.price_per_m2,
  price_per_m2_heavy = excluded.price_per_m2_heavy, min_price = excluded.min_price,
  min_price_below_m2 = excluded.min_price_below_m2, duration_minutes = excluded.duration_minutes;

insert into settings (key, value, description) values
  ('two_person_threshold_m2', '1000',  'Ab dieser Fläche (oder bei Freifläche) fährt ein 2er-Trupp mit Roboter'),
  ('solo_m2_per_day',         '600',   'Planwert Flächenleistung allein, manuell'),
  ('robot_m2_per_day',        '1500',  'Planwert Flächenleistung 2er-Trupp mit Roboter'),
  ('specific_yield_kwh_kwp',  '950',   'Annahme Jahresertrag je kWp für die Verlustanzeige'),
  ('power_price_eur_kwh',     '0.30',  'Annahme Strompreis/Einspeisewert für die Verlustanzeige'),
  ('thermography_window',     '{"from":"11:00","to":"15:00"}', 'Zeitfenster für Thermografieflüge')
on conflict (key) do nothing;
