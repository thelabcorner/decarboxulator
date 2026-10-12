import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeCalculationLibrary, encodeCalculationLibrary, filterCalculations,
  sanitizeCalculationUrl, sanitizeSavedCalculation, type SavedCalculation,
} from '../src/lib/history';

const origin = 'https://example.com';
function record(overrides: Partial<SavedCalculation> = {}): SavedCalculation {
  return {
    id:'a1',tool:'THCa → THC',result:'8.772 g',url:'/tools/thca-to-thc?amount=10&unit=g',
    savedAt: 1_790_000_000_000,updatedAt:1_790_000_000_000,
    name:'First batch',note:'Reference',favorite:false,tags:['batch 1'],
    ...overrides,
  };
}

describe('saved calculation library', () => {
  it('allows only same-origin calculator snapshot routes and rejects untrusted URLs', () => {
    expect(sanitizeCalculationUrl('https://example.com/tools/thca-to-thc?amount=10',origin))
      .toBe('/tools/thca-to-thc?amount=10');
    expect(sanitizeCalculationUrl('/decarboxulator/tools/batch-yield?amount=20',origin))
      .toBe('/decarboxulator/tools/batch-yield?amount=20');
    for(const value of ['javascript:alert(1)','https://evil.example/tools/thca-to-thc',
      '//evil.example/tools/thca-to-thc','/admin','/tools/../../admin','#fragment']) {
      expect(sanitizeCalculationUrl(value,origin)).toBeNull();
    }
  });
  it('upgrades original history snapshot entries to versioned records', () => {
    const legacy = {id:'legacy',tool:'Batch yield',result:'74 g',url:'/tools/batch-yield?amount=100',savedAt:1_790_000_000_000};
    const [entry] = decodeCalculationLibrary(JSON.stringify([legacy]),origin);
    expect(entry).toMatchObject({id:'legacy',name:'Batch yield',note:'',tags:[],favorite:false});
    const [restored] = decodeCalculationLibrary(encodeCalculationLibrary([entry]),origin);
    expect(restored).toEqual(entry);
  });
  it('preserves metadata and rejects malformed record imports without partial acceptance', () => {
    const valid = record();
    expect(sanitizeSavedCalculation({...valid,tags:['lab','lab','second']},origin)?.tags).toEqual(['lab','second']);
    expect(decodeCalculationLibrary(encodeCalculationLibrary([valid]),origin)[0]).toEqual(valid);
    expect(()=>decodeCalculationLibrary(JSON.stringify({version:2,entries:[valid,{...valid,url:'https://evil.example'}]}),origin)).toThrow();
    expect(()=>decodeCalculationLibrary(JSON.stringify({version:99,entries:[valid]}),origin)).toThrow();
  });
  it('supports search, favorites and deterministic sorting', () => {
    const a = record({id:'a',name:'Alpha batch',favorite:true,updatedAt:12,note:'Lab reference'});
    const b = record({id:'b',name:'Beta formulation',tool:'Edible',url:'/tools/edible-dosage',updatedAt:13,tags:['production']});
    const c = record({id:'c',name:'Gamma sample',tool:'Pressure',url:'/tools/max-pressure',updatedAt:14});
    const items=[a,b,c];
    expect(filterCalculations(items,{query:'lab'}).map(x=>x.id)).toEqual(['a']);
    expect(filterCalculations(items,{query:'production'}).map(x=>x.id)).toEqual(['b']);
    expect(filterCalculations(items,{favorites:true}).map(x=>x.id)).toEqual(['a']);
    expect(filterCalculations(items,{tool:'Edible'}).map(x=>x.id)).toEqual(['b']);
    expect(filterCalculations(items,{sort:'name'}).map(x=>x.id)).toEqual(['a','b','c']);
    expect(filterCalculations(items,{sort:'recent'}).map(x=>x.id)).toEqual(['a','c','b']);
  });
});

describe('browser persistence and mutation', () => {
  const map = new Map<string,string>();
  beforeEach(() => {
    map.clear();
    vi.resetModules();
    vi.stubGlobal('window',{
      location:{origin,pathname:'/tools/thca-to-thc'},
      addEventListener:vi.fn(),removeEventListener:vi.fn(),
    });
    vi.stubGlobal('localStorage',{
      getItem:(key:string)=>map.get(key)??null,
      setItem:(key:string,value:string)=>{map.set(key,value);},
    });
  });
  it('migrates prior history when the first new record is saved and deduplicates repeated saves', async () => {
    map.set('decarboxulator-v4:history',JSON.stringify([record({id:'legacy',name:'Old work'})]));
    const h = await import('../src/lib/history');
    const url=origin+'/tools/thca-to-thc?amount=10&unit=g';
    expect(h.saveCalculation('THCa → THC','8.772 g',url)).toBe(true);
    const rows=JSON.parse(map.get('decarboxulator-v4:saved-calculations')!).entries;
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Old work');
    expect(h.isCalculationSaved('THCa → THC',url,rows)).toBe(true);
  });
  it('supports renaming, favorites, notes, deletion, restoration and import', async () => {
    const h=await import('../src/lib/history');
    const url=origin+'/tools/thca-to-thc?amount=25';
    expect(h.saveCalculation('Conversion','21.9 g',url)).toBe(true);
    const id=JSON.parse(map.get('decarboxulator-v4:saved-calculations')!).entries[0].id;
    expect(h.updateCalculation(id,{name:'Research 07',note:'Trial run',favorite:true,tags:['trial']})).toBe(true);
    const current=JSON.parse(map.get('decarboxulator-v4:saved-calculations')!).entries[0] as SavedCalculation;
    expect(current).toMatchObject({name:'Research 07',note:'Trial run',favorite:true,tags:['trial']});
    expect(h.removeCalculation(id)).toBe(true);
    expect(JSON.parse(map.get('decarboxulator-v4:saved-calculations')!).entries).toHaveLength(0);
    expect(h.restoreCalculation(current)).toBe(true);
    const exported=h.exportCalculationLibrary();
    expect(h.importCalculationLibrary(exported)).toBe(0);
    expect(h.clearCalculationHistory()).toBe(true);
    expect(h.importCalculationLibrary(exported)).toBe(1);
  });
  it('does not announce success when browser storage rejects writes', async () => {
    vi.stubGlobal('localStorage', {getItem:()=>null,setItem:()=>{throw new Error('quota');}});
    const h=await import('../src/lib/history');
    expect(h.saveCalculation('Conversion','1 g',origin+'/tools/thca-to-thc?amount=1')).toBe(false);
  });
});
