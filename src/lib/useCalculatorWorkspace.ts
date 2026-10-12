import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import type { UnitKey } from './decarb';
import { rescaleMassInput } from './massUnits';
import { migrateLegacyWorkspace, validWorkspaceValue } from './workspacePayload';
import { buildShareUrl, readSharedState } from './share';

type Fields = Record<string, string>;
type FieldKey<T extends Fields> = Extract<keyof T, string>;
const STORAGE_PREFIX = 'decarboxulator-v4:workspace:';
const NO_ENTRY_FIELDS: readonly never[] = [];

/**
 * State stays entirely local to the calculator. A shared URL is an explicit
 * snapshot; typing never creates navigation entries or indexable query routes.
 * The server uses defaults to keep prerendering and hydration deterministic.
 */
export function useCalculatorWorkspace<T extends Fields & {unit: UnitKey}>(
  id: string, defaults: T, {entryFields = NO_ENTRY_FIELDS}: {entryFields?: readonly FieldKey<T>[]} = {},
) {
  const initial = useRef(defaults);
  const [values, setValues] = useState<T>(defaults);
  const [ready, setReady] = useState(false);
  const routeHref = useRouterState({ select: state => state.location.href });

  useEffect(() => {
    initial.current = defaults;
    const saved = (() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_PREFIX + id);
        return raw ? JSON.parse(raw) as unknown : null;
      } catch { return null; }
    })();
    // TanStack's reactive location is authoritative during client-side
    // navigation; window.location can still reflect the outgoing route here.
    const sharedState = readSharedState(new URL(routeHref, window.location.origin).search, initial.current);
    const hasSharedState = sharedState !== null;
    const source: unknown = sharedState ?? saved;
    const restored = {...initial.current};
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      for (const key of Object.keys(initial.current) as FieldKey<T>[]) {
        // A tool entry selects its mode unless a shared URL explicitly specifies
        // a mode. Other fields still restore from the shared calculation library.
        if (!hasSharedState && entryFields.includes(key)) continue;
        const proposed = (source as Record<string, unknown>)[key];
        if (!validWorkspaceValue(key, proposed, initial.current[key])) continue;
        restored[key] = proposed as T[FieldKey<T>];
      }
    }
    setValues(migrateLegacyWorkspace(id, source, restored));
    setReady(true);
  }, [id, routeHref, defaults, entryFields]);

  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(values)); }
    catch { /* The calculator stays usable in private/restricted storage modes. */ }
  }, [id, ready, values]);

  const setField = useCallback(<K extends FieldKey<T>>(field: K, value: T[K]) => {
    setValues(current => ({...current, [field]: value}));
  }, []);

  const setFields = useCallback((patch: Partial<T>) => {
    setValues(current => ({...current, ...patch}));
  }, []);

  const setMassUnit = useCallback((nextUnit: UnitKey, massKeys: ReadonlyArray<FieldKey<T>>) => {
    setValues(current => {
      if (current.unit === nextUnit) return current;
      const next = {...current};
      for (const key of massKeys) {
        const rescaled = rescaleMassInput(current[key], current.unit, nextUnit);
        if (rescaled === null) return current;
        next[key] = rescaled as T[FieldKey<T>];
      }
      next.unit = nextUnit;
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setValues({...initial.current});
  }, []);

  const shareUrl = useCallback(() => {
    return buildShareUrl(window.location.href, values, initial.current);
  }, [values]);

  return {values, setField, setFields, setMassUnit, reset, shareUrl, ready};
}
