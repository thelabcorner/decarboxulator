import { MAX_INPUT, UNITS, parseAmount, type UnitKey } from './decarb';

/** Unit changes never redefine an already entered physical mass. */
export function rescaleMassInput(value: string, from: UnitKey, to: UnitKey): string | null {
  if (from === to || value.trim() === '') return value;
  const original = parseAmount(value);
  if (original.value === null) return value;
  const converted = original.value * UNITS[from].toGrams / UNITS[to].toGrams;
  if (!Number.isFinite(converted) || converted > MAX_INPUT) return null;
  return Number(converted.toPrecision(12)).toString();
}