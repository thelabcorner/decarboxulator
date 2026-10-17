import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Bookmark, BookmarkPlus, Check, FolderOpen, Link2, RotateCcw } from 'lucide-react';
import { saveCalculation, sanitizeCalculationUrl, useCalculationHistory } from '../lib/history';
import { useSavedLibrary } from '../lib/SavedLibraryContext';
import { ShareDialog } from './ShareDialog';

const noopSubscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

/** Shared actions preserve their labels and success semantics across every calculator. */
export function WorkspaceActions({ onReset, shareUrl, tool, result }: {
  onReset: () => void;
  shareUrl: () => string;
  tool: string;
  result: string | null;
}) {
  const records = useCalculationHistory();
  const openLibrary = useSavedLibrary();
  const [status, setStatus] = useState<'idle' | 'copied' | 'saved' | 'failed'>('idle');
  const [shareOpen, setShareOpen] = useState(false);
  const hydrated = useSyncExternalStore(noopSubscribe, clientReady, serverReady);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  let currentUrl: string | null = null;
  if (hydrated && typeof window !== 'undefined') {
    try { currentUrl = sanitizeCalculationUrl(shareUrl(), window.location.origin); }
    catch { currentUrl = null; }
  }
  const savedRecord = currentUrl ? records.find(entry => entry.tool === tool && entry.url === currentUrl) : undefined;

  function updateStatus(next: 'copied' | 'saved' | 'failed') {
    setStatus(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus('idle'), 2600);
  }
  async function save() {
    if (!result || !currentUrl) return;
    const success = await saveCalculation(tool, result, shareUrl());
    updateStatus(success ? 'saved' : 'failed');
  }

  return <div className="workspace-actions">
    <button className="text-button" type="button" onClick={onReset} aria-label="Reset inputs to defaults" title="Reset inputs to defaults">
      <RotateCcw size={13} aria-hidden="true"/><span>Reset</span>
    </button>
    <button className="text-button" type="button" onClick={() => setShareOpen(true)}
      disabled={!currentUrl} aria-label="Share" title="Share an exact input snapshot" aria-haspopup="dialog">
      <Link2 size={13}/><span>Share</span>
    </button>
    <button className="text-button" type="button" onClick={() => void save()} disabled={!result || !currentUrl}
      aria-label={savedRecord ? 'Update saved calculation' : 'Save calculation'}
      title={savedRecord ? 'Update the saved calculation' : 'Save the current inputs and result'}>
      {status === 'saved' ? <Check size={13}/> : savedRecord ? <Bookmark size={13}/> : <BookmarkPlus size={13}/>}
      <span>{status === 'saved' ? 'Saved' : savedRecord ? 'Update' : 'Save'}</span>
    </button>
    {savedRecord && openLibrary ? <button className="text-button workspace-library-open" type="button"
      onClick={() => openLibrary(savedRecord.id)} aria-label="Open this saved calculation" title="Open this saved calculation">
      <FolderOpen size={13}/><span>View</span>
    </button> : null}
    <span className="sr-only" role="status" aria-live="polite">
      {status === 'failed' ?
        'The action failed. Check browser permissions and device storage.' :
        status === 'saved' ? 'Calculation saved in your library' : ''}
    </span>
    {shareOpen && currentUrl && <ShareDialog url={shareUrl()} title={tool} result={result}
      onClose={() => setShareOpen(false)}/>}
  </div>;
}
