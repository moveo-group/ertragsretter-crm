-- Solar-Ertragsretter CRM – Grundschema
-- Läuft in Supabase (Postgres 15+). Alle Tabellen im Schema public, Zugriff nur über Row-Level-Security.

-- ─────────────────────────────────────────────────────────────
-- Aufzählungen
-- ─────────────────────────────────────────────────────────────
create type staff_role        as enum ('admin', 'field', 'office');
create type customer_kind     as enum ('privat', 'gewerbe', 'landwirtschaft', 'kommune');
create type roof_type         as enum ('schraegdach', 'flachdach', 'freiflaeche');
create type cleaning_bucket   as enum ('unter_12', '12_bis_24', 'ueber_24', 'nie');
create type order_status      as enum ('neu', 'angenommen', 'eingeplant', 'erledigt', 'abgerechnet', 'storniert');
create type order_source      as enum ('app', 'website', 'telefon', 'email', 'sonstiges');
create type wish_slot         as enum ('vormittag', 'nachmittag', 'ganztags');
create type assessment_value  as enum ('ja', 'nein', 'pruefen');
create type appointment_kind  as enum ('reinigung', 'vorgespraech', 'thermografie', 'buero', 'sonstiges');
create type document_type     as enum ('angebot', 'rechnung');
create type document_status   as enum ('entwurf', 'versendet', 'bezahlt', 'ueberfaellig', 'storniert');
create type photo_category    as enum ('dach_anlage', 'umgebung', 'zufahrt', 'vorher_nachher');
create type photo_source      as enum ('handy', 'drohne', 'kunde');

-- ─────────────────────────────────────────────────────────────
-- Hilfsfunktion: updated_at pflegen
-- ─────────────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Einstellungen (Regeln & Rechenwerte, im CRM änderbar)
-- ─────────────────────────────────────────────────────────────
create table settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Team (Marcel, Thomas, Marie …) – 1:1 zu auth.users
-- ─────────────────────────────────────────────────────────────
create table staff (
  id              uuid primary key references auth.users (id) on delete cascade,
  full_name       text not null,
  initials        text not null,
  role            staff_role not null default 'field',
  can_work_alone  boolean not null default false,   -- darf Kleinanlagen allein anfahren
  is_drone_pilot  boolean not null default false,   -- darf Thermografieflüge durchführen
  weekly_hours    numeric(4,1) not null default 40,
  active          boolean not null default true,
  email           text,
  -- Zugriffsrechte (pro Person frei kombinierbar)
  perm_customers  boolean not null default true,    -- Kunden, Anlagen, Fotos, Aufträge sehen & bearbeiten
  perm_dispatch   boolean not null default true,    -- Disposition / Termine planen
  perm_finance    boolean not null default false,   -- Angebote, Rechnungen, Zahlungen, offene Posten, Umsätze
  perm_team       boolean not null default false,   -- Mitarbeiter anlegen und Rechte vergeben
  perm_settings   boolean not null default false,   -- Preise und Regeln ändern
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Kunden
-- ─────────────────────────────────────────────────────────────
create sequence customer_no_seq start 1001;

create table customers (
  id           uuid primary key default gen_random_uuid(),
  customer_no  text not null unique default ('KD-' || nextval('customer_no_seq')),
  name         text not null,
  kind         customer_kind not null default 'privat',
  street       text,
  zip          text,
  city         text,
  email        text,
  phone        text,
  lead_source  text,                       -- z. B. „Google-Suche“, „Empfehlung“
  lexware_contact_id uuid,                 -- Verknüpfung zu Lexware Office
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger customers_updated before update on customers for each row execute function set_updated_at();

-- Login der Endkunden (Kunden-App) → Kunde
create table customer_users (
  user_id      uuid not null references auth.users (id) on delete cascade,
  customer_id  uuid not null references customers (id) on delete cascade,
  primary key (user_id, customer_id)
);

create table contacts (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references customers (id) on delete cascade,
  name                  text not null,
  role                  text,              -- z. B. „Inhaber“, „Buchhaltung“
  phone                 text,
  email                 text,
  is_decision_maker     boolean not null default false,
  is_invoice_recipient  boolean not null default false,
  is_onsite_contact     boolean not null default false,
  created_at            timestamptz not null default now()
);
create index on contacts (customer_id);

-- ─────────────────────────────────────────────────────────────
-- PV-Anlagen (Kunde kann eigene Anlagen in der App pflegen)
-- ─────────────────────────────────────────────────────────────
create table plants (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references customers (id) on delete cascade,
  name               text not null default 'Anlage',
  kwp                numeric(8,2) check (kwp is null or kwp > 0),
  area_m2            numeric(9,1) check (area_m2 is null or area_m2 > 0),
  module_count       integer check (module_count is null or module_count > 0),
  roof               roof_type not null default 'schraegdach',
  tilt_deg           numeric(4,1),
  build_year         integer,
  inverter           text,
  freely_accessible  boolean not null default true,
  last_cleaned_on    date,                 -- exaktes Datum, wenn bekannt (eigene Reinigung)
  last_cleaning      cleaning_bucket,      -- Selbstauskunft des Kunden
  heavily_soiled     boolean not null default false,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on plants (customer_id);
create trigger plants_updated before update on plants for each row execute function set_updated_at();

-- Zugang & Arbeitsmittel (eine Bewertung je Anlage)
create table site_assessments (
  plant_id        uuid primary key references plants (id) on delete cascade,
  lift            assessment_value not null default 'pruefen',
  lift_note       text,
  drone_hose      assessment_value not null default 'pruefen',
  drone_hose_note text,
  robot           assessment_value not null default 'pruefen',
  robot_note      text,
  water           assessment_value not null default 'pruefen',
  water_note      text,
  access_road     assessment_value not null default 'pruefen',
  access_road_note text,
  assessed_by     uuid references staff (id),
  assessed_on     date,
  updated_at      timestamptz not null default now()
);
create trigger site_assessments_updated before update on site_assessments for each row execute function set_updated_at();

-- Fotos (Dateien liegen im Storage-Bucket „photos“ unter <customer_id>/<datei>)
create table photos (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references customers (id) on delete cascade,
  plant_id      uuid references plants (id) on delete set null,
  category      photo_category not null,
  source        photo_source not null default 'handy',
  storage_path  text not null unique,
  caption       text,
  taken_on      date,
  uploaded_by   uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  constraint photos_path_in_customer_folder check (storage_path like customer_id::text || '/%')
);
create index on photos (customer_id);

-- ─────────────────────────────────────────────────────────────
-- Leistungen & Preise
-- ─────────────────────────────────────────────────────────────
create table services (
  id                  text primary key,          -- 'reinigung', 'inspektion', 'thermografie'
  name                text not null,
  description         text,
  bookable_in_app     boolean not null default true,
  price_per_m2        numeric(8,2),              -- Standard
  price_per_m2_heavy  numeric(8,2),              -- stark verschmutzt
  min_price           numeric(10,2),             -- Mindestpauschale
  min_price_below_m2  numeric(9,1),              -- Pauschale gilt unter dieser Fläche
  flat_price          numeric(10,2),             -- Festpreis (z. B. Vorgespräch)
  duration_minutes    integer,
  active              boolean not null default true,
  sort                integer not null default 0
);

-- ─────────────────────────────────────────────────────────────
-- Aufträge / Buchungen
-- ─────────────────────────────────────────────────────────────
create sequence order_no_seq start 1;

create table orders (
  id                 uuid primary key default gen_random_uuid(),
  order_no           text not null unique,
  customer_id        uuid not null references customers (id) on delete restrict,
  plant_id           uuid references plants (id) on delete set null,
  service_id         text not null references services (id),
  with_thermography  boolean not null default false,
  status             order_status not null default 'neu',
  source             order_source not null default 'sonstiges',
  wish_date          date,
  wish_slot          wish_slot,
  customer_note      text,
  area_m2            numeric(9,1),              -- Fläche zum Zeitpunkt der Buchung
  estimated_price    numeric(10,2),             -- Richtpreis netto
  crew_size          smallint check (crew_size in (1, 2)),
  needs_robot        boolean not null default false,
  created_by         uuid references auth.users (id) default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on orders (customer_id);
create index on orders (status);
create trigger orders_updated before update on orders for each row execute function set_updated_at();

create or replace function set_order_no() returns trigger
language plpgsql as $$
begin
  if new.order_no is null then
    new.order_no := 'SE-' || to_char(now(), 'YY') || '-' || lpad(nextval('order_no_seq')::text, 4, '0');
  end if;
  return new;
end $$;
create trigger orders_set_no before insert on orders for each row execute function set_order_no();

-- ─────────────────────────────────────────────────────────────
-- Termine & Disposition
-- ─────────────────────────────────────────────────────────────
create table appointments (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid references orders (id) on delete cascade,
  kind               appointment_kind not null,
  title              text not null,
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  notes              text,
  weather_dependent  boolean not null default false,
  calendar_event_id  text,                       -- Google/Outlook-Sync
  created_at         timestamptz not null default now(),
  constraint appointments_time_ok check (ends_at > starts_at)
);
create index on appointments (starts_at);

create table appointment_staff (
  appointment_id  uuid not null references appointments (id) on delete cascade,
  staff_id        uuid not null references staff (id) on delete cascade,
  primary key (appointment_id, staff_id)
);

-- ─────────────────────────────────────────────────────────────
-- Angebote & Rechnungen (Spiegel aus Lexware Office)
-- ─────────────────────────────────────────────────────────────
create table documents (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references customers (id) on delete restrict,
  order_id      uuid references orders (id) on delete set null,
  type          document_type not null,
  number        text,
  description   text,
  issued_on     date,
  due_on        date,
  net_amount    numeric(12,2),
  status        document_status not null default 'entwurf',
  sent_on       date,
  paid_on       date,
  reminder_on   date,
  lexware_id    uuid unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on documents (customer_id);
create trigger documents_updated before update on documents for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Historie (wird teils automatisch per Trigger geschrieben)
-- ─────────────────────────────────────────────────────────────
create table events (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers (id) on delete cascade,
  order_id     uuid references orders (id) on delete set null,
  kind         text not null,          -- 'anfrage', 'buchung', 'status', 'einsatz', 'rechnung', 'zahlung', 'mahnung', 'notiz'
  title        text not null,
  body         text,
  actor        uuid references auth.users (id) default auth.uid(),
  occurred_at  timestamptz not null default now()
);
create index on events (customer_id, occurred_at desc);

create or replace function log_order_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  svc text;
begin
  select name into svc from services where id = new.service_id;
  if tg_op = 'INSERT' then
    insert into events (customer_id, order_id, kind, title, body)
    values (new.customer_id, new.id, 'buchung',
            coalesce(svc, new.service_id) || ' gebucht (' || new.order_no || ')',
            'Quelle: ' || new.source::text);
  elsif new.status is distinct from old.status then
    insert into events (customer_id, order_id, kind, title)
    values (new.customer_id, new.id, 'status',
            new.order_no || ': ' || old.status::text || ' → ' || new.status::text);
  end if;
  return new;
end $$;
create trigger orders_log after insert or update of status on orders for each row execute function log_order_event();

create or replace function log_document_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  label text := case new.type when 'angebot' then 'Angebot' else 'Rechnung' end;
begin
  if tg_op = 'INSERT' then
    insert into events (customer_id, order_id, kind, title)
    values (new.customer_id, new.order_id, 'rechnung', label || ' ' || coalesce(new.number, '(Entwurf)') || ' angelegt');
  elsif new.status is distinct from old.status then
    insert into events (customer_id, order_id, kind, title)
    values (new.customer_id, new.order_id,
            case new.status when 'bezahlt' then 'zahlung' when 'ueberfaellig' then 'mahnung' else 'rechnung' end,
            label || ' ' || coalesce(new.number, '') || ': ' || new.status::text);
  end if;
  return new;
end $$;
create trigger documents_log after insert or update of status on documents for each row execute function log_document_event();
