// Anzeige-Texte für die Aufzählungen aus der Datenbank.

export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  neu: { label: 'Neu', tone: 'amber' },
  angenommen: { label: 'Angenommen', tone: 'green' },
  eingeplant: { label: 'Eingeplant', tone: 'blue' },
  erledigt: { label: 'Erledigt', tone: 'green' },
  abgerechnet: { label: 'Abgerechnet', tone: 'grey' },
  storniert: { label: 'Storniert', tone: 'red' },
};

export const DOCUMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  entwurf: { label: 'Entwurf', tone: 'grey' },
  versendet: { label: 'Versendet', tone: 'amber' },
  bezahlt: { label: 'Bezahlt', tone: 'green' },
  ueberfaellig: { label: 'Überfällig', tone: 'red' },
  storniert: { label: 'Storniert', tone: 'grey' },
};

export const SOURCE: Record<string, string> = {
  app: 'App', website: 'Website', telefon: 'Telefon', email: 'E-Mail', sonstiges: 'Sonstiges',
};

export const ROOF: Record<string, string> = {
  schraegdach: 'Schrägdach', flachdach: 'Flachdach', freiflaeche: 'Freifläche',
};

export const SLOT: Record<string, string> = {
  vormittag: 'Vormittag', nachmittag: 'Nachmittag', ganztags: 'ganztägig',
};

export const CLEANING: Record<string, string> = {
  unter_12: 'unter 12 Monaten', '12_bis_24': '12–24 Monate', ueber_24: 'über 24 Monate', nie: 'noch nie',
};

export const PHOTO_CATEGORY: Record<string, string> = {
  dach_anlage: 'Dach & Anlage', umgebung: 'Umgebung', zufahrt: 'Zufahrt', vorher_nachher: 'Vorher/Nachher',
};

export const PHOTO_SOURCE: Record<string, string> = { handy: 'Handy', drohne: 'Drohne', kunde: 'Kunde' };

export const ASSESSMENT_ITEMS = [
  { key: 'lift', label: 'Hebebühne einsetzbar' },
  { key: 'drone_hose', label: 'Drohne mit Schlauch' },
  { key: 'robot', label: 'Reinigungsroboter (hyCLEANER)' },
  { key: 'water', label: 'Wasseranschluss vor Ort' },
  { key: 'access_road', label: 'Zufahrt mit Transporter' },
] as const;

export const CUSTOMER_KIND: Record<string, string> = {
  privat: 'Privat', gewerbe: 'Gewerbe', landwirtschaft: 'Landwirtschaft', kommune: 'Kommune',
};

export type Tone = 'amber' | 'green' | 'blue' | 'grey' | 'red';

export const date = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–';

export const dateShort = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' }) : '–';

export const num = (n: number | null | undefined, digits = 0) =>
  n == null ? '–' : Number(n).toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export const money = (n: number | null | undefined) =>
  n == null ? '–' : Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

export function timeAgo(iso: string, now = new Date()): string {
  const min = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  return d === 1 ? 'gestern' : `vor ${d} Tagen`;
}
