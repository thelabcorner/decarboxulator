import {describe,expect,it} from 'vitest';
import {ACID_CANNABINOID_KEYS,cannabinoidChemistry} from '../src/lib/cannabinoids';
import {computePressure,buildPressureHeatmap} from '../src/lib/pressure';
import {newTrackerSession,parseTrackerSession,TRACKER_DEFAULTS} from '../src/lib/trackerSessions';
import {trackerConfigFromPercent,trackerRawCSV,validatedTrackerConfig,restoreTrackerPoints} from '../src/lib/trackerAnalytics';
import {trackerSetup,trackerSnapshot} from '../src/lib/decarb';
import {decodeTrackerBackup,encodeTrackerSession} from '../src/lib/trackerBackup';

describe('multi-acid pressure and tracker workflows',()=>{
  it('uses a different acid molecular mass for pressure and conserves CO2',()=>{
    const base={weightG:100,thcaPct:80,tempValue:200,tempUnit:'C' as const,headspaceFloz:16};
    const results=ACID_CANNABINOID_KEYS.map(cannabinoid=>{
      const model=computePressure({...base,cannabinoid})!;
      const {acidMw,co2Mw}=cannabinoidChemistry(cannabinoid);
      expect(model.thcaG).toBe(80);
      expect(model.nCo2Mol).toBeCloseTo(80/acidMw,11);
      expect(model.co2G).toBeCloseTo(model.nCo2Mol*co2Mw,11);
      expect(model.pAbsPsi).toBeCloseTo(model.pAirPsi+model.pCo2Psi,11);
      const field=buildPressureHeatmap({...base,cannabinoid});
      expect(field).toHaveLength(7);
      expect(field[3][3].pGaugePsi).toBeCloseTo(model.pGaugePsi,10);
      return model;
    });
    expect(computePressure(base)).toEqual(results[0]); // default THCa
    expect(results[2].pCo2Psi).not.toBe(results[0].pCo2Psi); // CBGa molecular mass
  });
  it('defaults to THCa and migrates pre-acid v1 tracker sessions with readings',()=>{
    expect(TRACKER_DEFAULTS.cannabinoid).toBe('THCa');
    const session=newTrackerSession(1_790_000_000_000);
    expect(session.fields.cannabinoid).toBe('THCa');
    const legacy=structuredClone(session) as unknown as Record<string,unknown>;
    const fields=legacy.fields as Record<string,string>;
    delete fields.cannabinoid;
    expect(parseTrackerSession(legacy)?.fields.cannabinoid).toBe('THCa');
    fields.cannabinoid='nonexistent';
    expect(parseTrackerSession(legacy)).toBeNull();
    fields.cannabinoid='CBDa';
    const rehydrated=parseTrackerSession(legacy)!;
    expect(rehydrated.fields.cannabinoid).toBe('CBDa');
    const archived=decodeTrackerBackup(encodeTrackerSession(rehydrated));
    expect(archived).not.toBeNull();
  });
  it('propagates per-run acid into baseline, snapshots, CSV, and percent input',()=>{
    for(const cannabinoid of ACID_CANNABINOID_KEYS){
      const cfg=trackerConfigFromPercent(5,100,65,35,cannabinoid)!;
      expect(cfg?.cannabinoid).toBe(cannabinoid);
      expect(validatedTrackerConfig(cfg)).toEqual(cfg);
      const chem=cannabinoidChemistry(cannabinoid);
      const setup=trackerSetup(cfg);
      expect(setup.expectedCo2LossG).toBeCloseTo(65*chem.co2Ratio,11);
      const first=setup.initialTotalG-setup.expectedCo2LossG*.25;
      const second=setup.initialTotalG-setup.expectedCo2LossG*.65;
      const snap=trackerSnapshot(second,cfg,setup)!;
      expect(snap.completion).toBeCloseTo(65,8);
      expect(snap.convertedThcG).toBeCloseTo(65*chem.ratio*.65,8);
      const readings=[
        {timestamp:1790000000000,weightG:first},
        {timestamp:1790000100000,weightG:second},
      ];
      const points=restoreTrackerPoints(readings,cfg);
      expect(points).toHaveLength(2);
      expect(points[1].snapshot.completion).toBeCloseTo(65,8);
      const csv=trackerRawCSV(readings,cfg);
      expect(csv).toContain('acidic_cannabinoid');
      expect(csv).toContain(','+cannabinoid);
    }
    expect(validatedTrackerConfig({tareG:5,thcaG:10,otherG:3,cannabinoid:'bad' as 'THCa'})).toBeNull();
  });
});
