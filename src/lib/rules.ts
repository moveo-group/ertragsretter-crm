// Geschäftsregeln von Solar-Ertragsretter.
// Reine Funktionen ohne Datenbankzugriff – werden im CRM, in der Kunden-App und in Tests genutzt.

export type RoofType = 'schraegdach' | 'flachdach' | 'freiflaeche';
export type CleaningBucket = 'unter_12' | '12_bis_24' | 'ueber_24' | 'nie';

export interface CleaningService {
  price_per_m2: number;        // 1,56 €/m²
  price_per_m2_heavy: number;  // 2,70 €/m² bei starker Verschmutzung
  min_price: number;           // 450 € Pauschale …
  min_price_below_m2: number;  // … für Anlagen unter 300 m²
}

export interface PriceEstimate {
  /** Richtpreis netto bei normaler Verschmutzung */
  from: number;
  /** Richtpreis netto bei starker Verschmutzung (gleich `from`, wenn Pauschale greift) */
  to: number;
  flatRate: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Richtpreis (netto) für eine Reinigung. Gibt null zurück, wenn keine gültige Fläche vorliegt. */
export function estimateCleaningPrice(areaM2: number, svc: CleaningService, heavilySoiled?: boolean): PriceEstimate | null {
  if (!Number.isFinite(areaM2) || areaM2 <= 0) return null;
  if (areaM2 < svc.min_price_below_m2) {
    return { from: svc.min_price, to: svc.min_price, flatRate: true };
  }
  const std = round2(Math.max(svc.min_price, areaM2 * svc.price_per_m2));
  const heavy = round2(Math.max(svc.min_price, areaM2 * svc.price_per_m2_heavy));
  if (heavilySoiled === true) return { from: heavy, to: heavy, flatRate: false };
  if (heavilySoiled === false) return { from: std, to: std, flatRate: false };
  return { from: std, to: heavy, flatRate: false };
}

/**
 * Typischer Ertragsverlust durch Verschmutzung in Prozent (Spanne).
 * Quellen: DLR ~2 % im deutschen Normalfall; EnBW/ADAC 5–20 % bei starker Verschmutzung.
 */
export const SOILING_LOSS_PCT: Record<CleaningBucket, { min: number; max: number }> = {
  unter_12: { min: 0, max: 2 },
  '12_bis_24': { min: 2, max: 5 },
  ueber_24: { min: 5, max: 20 },
  nie: { min: 5, max: 20 },
};

/** Die App zeigt die Verlust-Warnung, wenn seit über 24 Monaten (oder nie) gereinigt wurde. */
export function showsLossWarning(bucket: CleaningBucket | null | undefined): boolean {
  return bucket === 'ueber_24' || bucket === 'nie';
}

/** Leitet die Einstufung aus einem bekannten Reinigungsdatum ab. */
export function bucketFromDate(lastCleaned: Date | null, today: Date = new Date()): CleaningBucket {
  if (!lastCleaned) return 'nie';
  const months = (today.getFullYear() - lastCleaned.getFullYear()) * 12 + (today.getMonth() - lastCleaned.getMonth())
    - (today.getDate() < lastCleaned.getDate() ? 1 : 0);
  if (months < 12) return 'unter_12';
  if (months <= 24) return '12_bis_24';
  return 'ueber_24';
}

export interface LossEstimate {
  pctMin: number; pctMax: number;
  kwhMin: number; kwhMax: number;
  eurMin: number; eurMax: number;
}

export function estimateYearlyLoss(kwp: number, bucket: CleaningBucket, specificYieldKwhPerKwp = 950, eurPerKwh = 0.3): LossEstimate | null {
  if (!Number.isFinite(kwp) || kwp <= 0) return null;
  const { min, max } = SOILING_LOSS_PCT[bucket];
  const year = kwp * specificYieldKwhPerKwp;
  const kwh = (p: number) => Math.round((year * p) / 100 / 10) * 10;
  const eur = (p: number) => Math.round((year * p) / 100 * eurPerKwh);
  return { pctMin: min, pctMax: max, kwhMin: kwh(min), kwhMax: kwh(max), eurMin: eur(min), eurMax: eur(max) };
}

export interface CrewDecision {
  crewSize: 1 | 2;
  needsRobot: boolean;
  reason: string;
}

/**
 * Besetzungsregel: Freifläche oder ab Schwellenfläche → 2er-Trupp mit Roboter,
 * sonst eine Person (Marcel oder Thomas).
 */
export function decideCrew(roof: RoofType, areaM2: number, thresholdM2 = 1000): CrewDecision {
  if (roof === 'freiflaeche') return { crewSize: 2, needsRobot: true, reason: 'Freifläche' };
  if (areaM2 >= thresholdM2) return { crewSize: 2, needsRobot: true, reason: `ab ${thresholdM2.toLocaleString('de-DE')} m²` };
  return { crewSize: 1, needsRobot: false, reason: `Dachanlage unter ${thresholdM2.toLocaleString('de-DE')} m²` };
}

/** Geplante Einsatzdauer in Arbeitstagen nach Planwerten (allein 600 m²/Tag, Roboter 1.500 m²/Tag). */
export function estimateWorkDays(areaM2: number, crew: CrewDecision, soloPerDay = 600, robotPerDay = 1500): number {
  const perDay = crew.needsRobot ? robotPerDay : soloPerDay;
  return Math.max(0.25, Math.ceil((areaM2 / perDay) * 4) / 4); // auf Vierteltage gerundet
}

/** Grobe Modulfläche aus der Modulanzahl (ca. 1,75 m² je Modul). */
export function areaFromModules(modules: number): number {
  return Math.round(modules * 1.75);
}

/** Deutsche Zahleneingabe („9,8“ oder „1.250“) robust lesen. */
export function parseGermanNumber(input: string): number {
  const s = input.trim().replace(/\s/g, '');
  if (!s) return NaN;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s;
  return Number(normalized);
}

export const euro = (n: number, digits = 0) =>
  n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: digits, maximumFractionDigits: digits });
