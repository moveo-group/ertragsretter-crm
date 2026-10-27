# Ertragsretter CRM

Cloud-CRM von Solar-Ertragsretter: Kunden, Anlagen, Buchungseingang, Kundenakte mit Fotos, Zugangsbewertung, Rechnungsstatus und Historie.
Technik: **Next.js** (gehostet auf Vercel) + **Supabase** (Datenbank, Login, Foto-Speicher, Region Frankfurt).

## Stand (Ausbaustufe 1 – Grundgerüst)

| Bereich | Stand |
|---|---|
| Login nur für Team (Marcel, Thomas, Marie) | ✅ |
| Übersicht mit Kennzahlen und Buchungseingang, „Annehmen“ setzt Besetzung + Richtpreis nach Regeln | ✅ |
| Kundenliste, Suche, neuer Kunde | ✅ |
| Kundenakte: Ansprechpartner, Anlagen, Ertragsverlust-Hinweis, Fotos mit Kategorien, Zugang & Arbeitsmittel, Aufträge, Rechnungen & Zahlungsstatus, Historie | ✅ |
| Disposition (Wochenplan, Regeln, Kalender-Sync) | Stufe 2 |
| Lexware Office: Angebote/Rechnungen erzeugen, Zahlungen abgleichen | Stufe 3 |
| Kunden-App (Web-App) + Website-Formular | Stufe 4 |

Zugriffsrechte sind in der Datenbank selbst festgelegt (Row-Level-Security) und mit 21 automatischen Tests geprüft.

---

## Einrichtung (kostenlose Tarife, ca. 30 Minuten)

### 1. Supabase-Projekt anlegen
1. Auf [supabase.com](https://supabase.com) mit dem GitHub-Konto anmelden → **New project**.
2. Name `ertragsretter-crm`, **Region: Central EU (Frankfurt)**, sicheres Datenbank-Passwort (im Passwort-Manager speichern).
3. Links **SQL Editor** → nacheinander den Inhalt dieser Dateien einfügen und mit **Run** ausführen:
   1. `supabase/migrations/20261027000001_schema.sql`
   2. `supabase/migrations/20261027000002_security.sql`
   3. `supabase/seed.sql` (Leistungen, Preise, Regeln)
   4. *optional* `supabase/demo.sql` (Beispielkunden Weber & Lindner zum Ausprobieren)
4. **Authentication → Sign In / Providers → „Allow new users to sign up“ ausschalten.** Bis die Kunden-App kommt, legen nur wir Konten an.

### 2. Team-Konten anlegen
1. **Authentication → Users → Add user → Create new user**: E-Mail + Passwort für Marcel, Thomas, Marie („Auto Confirm User“ anhaken).
2. Im **SQL Editor** die drei Personen als Team eintragen (E-Mails anpassen):

```sql
insert into staff (id, full_name, initials, role, can_work_alone, is_drone_pilot)
select id, 'Marcel', 'MT', 'admin', true, true from auth.users where email = 'marcel@…';
insert into staff (id, full_name, initials, role, can_work_alone, is_drone_pilot)
select id, 'Thomas', 'TH', 'field', true, false from auth.users where email = 'thomas@…';
insert into staff (id, full_name, initials, role, can_work_alone, is_drone_pilot)
select id, 'Marie', 'MA', 'office', false, false from auth.users where email = 'marie@…';
```

### 3. Auf Vercel veröffentlichen
1. Auf [vercel.com](https://vercel.com) mit GitHub anmelden → **Add New → Project** → dieses Repository importieren.
2. Unter **Environment Variables** eintragen (Werte aus Supabase → **Project Settings → API**):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **Settings → Functions → Region: Frankfurt (fra1)**, damit Daten in der EU bleiben.
4. **Deploy**. Nach ca. 2 Minuten ist das CRM unter `https://<projekt>.vercel.app` erreichbar.

> Hinweis zu den Gratis-Tarifen: Supabase pausiert kostenlose Projekte nach einer Woche ohne Nutzung (mit einem Klick wieder aktiv), Vercel erlaubt im Gratis-Tarif keine kommerzielle Nutzung. Vor dem echten Start beide auf **Pro** umstellen und die Verträge zur Auftragsverarbeitung (DSGVO) abschließen.

---

## Entwicklung

```bash
npm install
cp .env.example .env.local   # Werte eintragen
npm run dev                  # http://localhost:3000
npm test                     # Geschäftsregeln (Preise, Ertragsverlust, Besetzung)
supabase/tests/run.sh        # Zugriffsrechte gegen lokales Postgres (PGHOST/PGPORT/PGUSER setzen)
```

### Aufbau
```
src/lib/rules.ts             Geschäftsregeln (Preise, Ertragsverlust, Besetzung, Einsatzdauer)
src/app/(crm)/page.tsx       Übersicht & Buchungseingang
src/app/(crm)/kunden/        Kundenliste und Kundenakte (+ Server-Actions)
src/app/login/               Login (nur Team)
supabase/migrations/         Datenbankschema und Zugriffsrechte
supabase/seed.sql            Leistungen, Preise, Regeln
```

### Regeln & Rechenwerte
Stehen in der Tabelle `settings` und `services` und lassen sich ohne Code ändern:
Preise 1,56 / 2,70 €/m², Pauschale 450 € unter 300 m², 2er-Trupp ab 1.000 m² oder Freifläche,
Flächenleistung 600 / 1.500 m² pro Tag, 950 kWh/kWp und 0,30 €/kWh für die Verlustanzeige.
