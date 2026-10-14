import { trackerSetup, trackerSnapshot, type TrackerConfig, type TrackerSnapshot } from './decarb';
import type { TrackerReading } from './workspacePayload';
import { isAcidCannabinoid, type AcidCannabinoid } from './cannabinoids';

export type TrackerPoint = TrackerReading & { snapshot: TrackerSnapshot };
export type TrackerInputMode = 'manual' | 'percentage';
export type TrackerGraph = 'completion' | 'composition' | 'loss' | 'rate';

export function trackerConfigFromPercent(tareG: number, totalContentG: number, thcaPct: number, otherPct: number, cannabinoid?: AcidCannabinoid): TrackerConfig | null {
  if (![tareG,totalContentG,thcaPct,otherPct].every(Number.isFinite) ||
      tareG < 0 || !(totalContentG > 0) || thcaPct <= 0 || thcaPct > 100 ||
      otherPct < 0 || otherPct > 100 || Math.abs(thcaPct + otherPct - 100) > 1e-7) return null;
  return {tareG,thcaG:totalContentG*thcaPct/100,otherG:totalContentG*otherPct/100,cannabinoid};
}
export function validatedTrackerConfig(cfg: TrackerConfig | null): TrackerConfig | null {
  if (!cfg || ![cfg.tareG,cfg.thcaG,cfg.otherG].every(Number.isFinite) ||
    cfg.tareG < 0 || !(cfg.thcaG > 0) || cfg.otherG < 0 ||
    (cfg.cannabinoid !== undefined && !isAcidCannabinoid(cfg.cannabinoid))) return null;
  return cfg;
}
export function restoreTrackerPoints(readings: TrackerReading[], cfg: TrackerConfig): TrackerPoint[] {
  const setup = trackerSetup(cfg);
  let previous = 0;
  return readings.flatMap(p => {
    if (!Number.isSafeInteger(p.timestamp) || p.timestamp < previous) return [];
    previous = p.timestamp;
    const snapshot = trackerSnapshot(p.weightG,cfg,setup);
    return snapshot ? [{...p,snapshot}] : [];
  });
}
export interface TrackerAnalysis {
  elapsedHours: number | null;
  avgThcRateGph: number | null;
  intervalThcRateGph: number | null;
  intervalLossRateGph: number | null;
  estimatedRemainingHours: number | null;
  lastIntervalHours: number | null;
  massRebound: boolean;
}
export function analyzeTrackerSeries(points: TrackerPoint[], cfg: TrackerConfig, startedAt: number): TrackerAnalysis {
  const setup = trackerSetup(cfg);
  const last = points.at(-1);
  const prev = points.at(-2);
  const elapsedHours = last && startedAt > 0 && last.timestamp > startedAt
    ? (last.timestamp - startedAt)/3600000 : null;
  // A single post-start measurement does not establish a trend: it may have
  // been taken after conversion already began. Never annualize near-zero
  // elapsed times into spurious six-figure g/h rates from one observation.
  const avgThcRateGph = last && prev && elapsedHours && elapsedHours > 0
    ? last.snapshot.convertedThcG/elapsedHours : null;
  const lastIntervalHours = last && prev && last.timestamp > prev.timestamp
    ? (last.timestamp-prev.timestamp)/3600000 : null;
  const intervalThcRateGph = last && prev && lastIntervalHours && lastIntervalHours > 0
    ? (last.snapshot.convertedThcG-prev.snapshot.convertedThcG)/lastIntervalHours : null;
  const intervalLossRateGph = last && prev && lastIntervalHours && lastIntervalHours > 0
    ? (last.snapshot.weightLossG-prev.snapshot.weightLossG)/lastIntervalHours : null;
  // A linear extrapolation, not an Arrhenius/first-order kinetic model.
  const estimatedRemainingHours = last && intervalThcRateGph !== null &&
    Number.isFinite(intervalThcRateGph) && intervalThcRateGph > 0 && last.snapshot.completion < 100
    ? (setup.expectedFinalThcG - last.snapshot.convertedThcG)/intervalThcRateGph : null;
  return { elapsedHours,avgThcRateGph,intervalThcRateGph,intervalLossRateGph,
    estimatedRemainingHours,lastIntervalHours,
    massRebound: Boolean(last && prev && last.weightG > prev.weightG) };
}
export function trackerCSV(points: TrackerPoint[]): string {
  const header = 'index,timestamp_utc,vessel_mass_g,loss_g,completion_percent,remaining_thca_g,converted_thc_g,thca_percent,thc_percent,measured_temperature_c,technician_note';
  const csvCell=(value:string)=>{
    // Quote every free-text field; neutralize formulas when opened as spreadsheets.
    const safe=/^[=+@-]/.test(value.trimStart())?"'"+value:value;
    return '"'+safe.replace(/"/g,'""')+'"';
  };
  return [header,...points.map((p,i)=>[
    i+1,new Date(p.timestamp).toISOString(),p.weightG,p.snapshot.weightLossG,
    p.snapshot.completion,p.snapshot.remainingThcaG,p.snapshot.convertedThcG,
    p.snapshot.thcaPct,p.snapshot.thcPct,
    p.temperatureC??'',csvCell(p.note??''),
    ].join(','))].join('\r\n')+'\r\n';
}

/** Preserve every measured balance value, including out-of-model observations. */
export function trackerRawCSV(readings:TrackerReading[],cfg:TrackerConfig|null):string {
  const setup=cfg?trackerSetup(cfg):null;
  const quote=(value:string)=>{
    const safe=/^[=+@-]/.test(value.trimStart())?"'"+value:value;
    return '"'+safe.replace(/"/g,'""')+'"';
  };
  const header='index,timestamp_utc,vessel_mass_g,loss_g,completion_percent,remaining_thca_g,converted_thc_g,thca_percent,thc_percent,measured_temperature_c,technician_note,model_status,acidic_cannabinoid';
  return [header,...readings.map((r,i)=>{
    const snapshot=cfg&&setup?trackerSnapshot(r.weightG,cfg,setup):null;
    return [i+1,new Date(r.timestamp).toISOString(),r.weightG,
      setup?Number((setup.initialTotalG-r.weightG).toPrecision(12)):'',
      snapshot?.completion??'',snapshot?.remainingThcaG??'',snapshot?.convertedThcG??'',
      snapshot?.thcaPct??'',snapshot?.thcPct??'',r.temperatureC??'',
      quote(r.note??''),snapshot?'within_CO2_model':cfg?'outside_CO2_model':'baseline_unavailable',cfg?.cannabinoid??'THCa',
    ].join(',');
  })].join('\r\n')+'\r\n';
}
