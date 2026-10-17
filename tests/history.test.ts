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

describe('browser persistence and mutation',()=>{
  const map=new Map<string,string>();
  beforeEach(async()=>{
    map.clear();vi.resetModules();
    const {IDBFactory}=await import('fake-indexeddb');
    vi.stubGlobal('indexedDB',new IDBFactory());
    const target=new EventTarget();
    vi.stubGlobal('window',{location:{origin,pathname:'/tools/thca-to-thc'},
      addEventListener:target.addEventListener.bind(target),
      removeEventListener:target.removeEventListener.bind(target),
      dispatchEvent:target.dispatchEvent.bind(target)});
    vi.stubGlobal('localStorage',{getItem:(key:string)=>map.get(key)??null,
      setItem:(key:string,value:string)=>{map.set(key,value);}});
  });
  it('migrates legacy records without deleting original data or reimporting later',async()=>{
    map.set('decarboxulator-v4:history',JSON.stringify([record({id:'legacy',name:'Old work'})]));
    const h=await import('../src/lib/history');
    const url=origin+'/tools/thca-to-thc?amount=10&unit=g';
    expect(await h.saveCalculation('THCa → THC','8.772 g',url)).toBe(true);
    expect(await h.saveCalculation('THCa → THC','8.772 g',url)).toBe(true);
    const rows=JSON.parse(h.exportCalculationLibrary()).entries;
    expect(rows).toHaveLength(1);expect(rows[0].name).toBe('Old work');
    expect(map.has('decarboxulator-v4:history')).toBe(true);
    expect(map.has('decarboxulator-v4:saved-calculations')).toBe(false);
    expect(await h.clearCalculationHistory()).toBe(true);
    expect((await h.calculationLibraryCounts()).calculations).toBe(0);
    const {readUnifiedLibrary}=await import('../src/lib/unifiedLibrary');
    expect((await readUnifiedLibrary()).calculations).toEqual([]);
  });
  it('supports metadata, deletion, undo and archive imports',async()=>{
    const h=await import('../src/lib/history');
    const url=origin+'/tools/thca-to-thc?amount=25';
    expect(await h.saveCalculation('Conversion','21.9 g',url)).toBe(true);
    const id=JSON.parse(h.exportCalculationLibrary()).entries[0].id;
    expect(await h.updateCalculation(id,{name:'Research 07',note:'Trial run',favorite:true,tags:['trial']})).toBe(true);
    const item=JSON.parse(h.exportCalculationLibrary()).entries[0] as SavedCalculation;
    expect(item).toMatchObject({name:'Research 07',note:'Trial run',favorite:true,tags:['trial']});
    expect(await h.removeCalculation(id)).toBe(true);
    expect(JSON.parse(h.exportCalculationLibrary()).entries).toHaveLength(0);
    expect(await h.restoreCalculation(item)).toBe(true);
    const exported=h.exportCalculationLibrary();
    expect(await h.importCalculationLibrary(exported)).toBe(0);
    expect(await h.clearCalculationHistory()).toBe(true);
    expect(await h.importCalculationLibrary(exported)).toBe(1);
  });
  it('never reports success when IndexedDB is unavailable',async()=>{
    vi.stubGlobal('indexedDB',undefined);
    const h=await import('../src/lib/history');
    expect(await h.saveCalculation('Conversion','1 g',origin+'/tools/thca-to-thc?amount=1')).toBe(false);
  });
});
