import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateCleaningPrice, estimateYearlyLoss, decideCrew, estimateWorkDays,
  bucketFromDate, showsLossWarning, parseGermanNumber, areaFromModules,
} from './rules';

const svc = { price_per_m2: 1.56, price_per_m2_heavy: 2.7, min_price: 450, min_price_below_m2: 300 };

test('Pauschale unter 300 m²', () => {
  assert.deepEqual(estimateCleaningPrice(42, svc), { from: 450, to: 450, flatRate: true });
  assert.deepEqual(estimateCleaningPrice(299.9, svc, true), { from: 450, to: 450, flatRate: true });
});

test('Flächenpreis ab 300 m²', () => {
  assert.deepEqual(estimateCleaningPrice(1250, svc, false), { from: 1950, to: 1950, flatRate: false });
  assert.deepEqual(estimateCleaningPrice(420, svc, true), { from: 1134, to: 1134, flatRate: false });
  assert.deepEqual(estimateCleaningPrice(1250, svc), { from: 1950, to: 3375, flatRate: false });
  // 300 m² × 1,56 = 468 € liegt über der Pauschale
  assert.equal(estimateCleaningPrice(300, svc, false)?.from, 468);
});

test('Ungültige Fläche', () => {
  assert.equal(estimateCleaningPrice(0, svc), null);
  assert.equal(estimateCleaningPrice(NaN, svc), null);
});

test('Ertragsverlust Familie Weber (9,8 kWp, über 24 Monate)', () => {
  const l = estimateYearlyLoss(9.8, 'ueber_24')!;
  assert.equal(l.pctMin, 5); assert.equal(l.pctMax, 20);
  assert.equal(l.kwhMin, 470); assert.equal(l.kwhMax, 1860);
  assert.equal(l.eurMin, 140); assert.equal(l.eurMax, 559);
});

test('Warnung nur ab 24 Monaten', () => {
  assert.equal(showsLossWarning('ueber_24'), true);
  assert.equal(showsLossWarning('nie'), true);
  assert.equal(showsLossWarning('12_bis_24'), false);
  assert.equal(showsLossWarning(null), false);
});

test('Einstufung aus Datum', () => {
  const today = new Date('2026-10-27');
  assert.equal(bucketFromDate(new Date('2026-04-22'), today), 'unter_12');
  assert.equal(bucketFromDate(new Date('2025-01-10'), today), '12_bis_24');
  assert.equal(bucketFromDate(new Date('2024-10-27'), today), '12_bis_24');
  assert.equal(bucketFromDate(new Date('2024-09-01'), today), 'ueber_24');
  assert.equal(bucketFromDate(null, today), 'nie');
});

test('Besetzungsregel', () => {
  assert.equal(decideCrew('schraegdach', 42).crewSize, 1);
  assert.equal(decideCrew('flachdach', 999).crewSize, 1);
  assert.equal(decideCrew('flachdach', 1000).crewSize, 2);
  assert.deepEqual(decideCrew('freiflaeche', 200), { crewSize: 2, needsRobot: true, reason: 'Freifläche' });
  assert.equal(decideCrew('flachdach', 800, 500).crewSize, 2);
});

test('Einsatzdauer', () => {
  assert.equal(estimateWorkDays(1250, decideCrew('freiflaeche', 1250)), 1);
  assert.equal(estimateWorkDays(42, decideCrew('schraegdach', 42)), 0.25);
  assert.equal(estimateWorkDays(2100, decideCrew('flachdach', 2100)), 1.5);
});

test('Deutsche Zahlen', () => {
  assert.equal(parseGermanNumber('9,8'), 9.8);
  assert.equal(parseGermanNumber('1.250'), 1250);
  assert.equal(parseGermanNumber('1.250,5'), 1250.5);
  assert.equal(parseGermanNumber('42'), 42);
  assert.equal(parseGermanNumber('9.8'), 9.8);
  assert.ok(Number.isNaN(parseGermanNumber('')));
  assert.equal(areaFromModules(24), 42);
});
