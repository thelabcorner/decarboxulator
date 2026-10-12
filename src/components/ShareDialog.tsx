import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, ExternalLink, Link2, Share2, X } from 'lucide-react';
import { useDialogFocus } from '../lib/useDialogFocus';
import { isLocalShareUrl } from '../lib/share';
import { ScrollView } from './ScrollView';
import './ShareDialog.css';

export function ShareDialog({
  url, title, result, onClose,
}: {url: string; title: string; result: string | null; onClose: () => void}) {
  const dialogRef = useDialogFocus<HTMLElement>(true, onClose);
  const fieldRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const localOnly = isLocalShareUrl(url);
  const nativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function copyLink() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        fieldRef.current?.focus();
        fieldRef.current?.select();
        if (!document.execCommand('copy')) throw new Error('No clipboard API');
      }
      setCopied(true);
      setMessage('Calculation link copied.');
    } catch {
      fieldRef.current?.focus();
      fieldRef.current?.select();
      setMessage('Select the link above and copy it manually.');
    }
  }

  async function shareLink() {
    if (!nativeShare) return;
    try {
      await navigator.share({title: title + ' · Decarboxulator', text: result ?? undefined, url});
      setMessage('Shared using your device.');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setMessage('Device sharing is unavailable. You can still copy the link.');
    }
  }

  // Portaling into the content stage keeps this sheet out of the calculator's
  // clipped ScrollView and inside the persistent mobile rail's right edge.
  const stage = document.querySelector<HTMLElement>('.workspace-stage');
  if (!stage) return null;

  return createPortal(<div className="share-layer">
    <button className="share-scrim" type="button" aria-label="Close sharing panel" onClick={onClose}/>
    <section ref={dialogRef} className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title">
      <div className="share-header">
        <div className="share-header-icon"><Link2 size={17} strokeWidth={1.8}/></div>
        <div className="share-header-copy">
          <span>Workspace / Share</span>
          <h2 id="share-dialog-title">Share calculation</h2>
        </div>
        <button type="button" className="share-close" onClick={onClose} data-dialog-initial aria-label="Close sharing panel"><X size={17}/></button>
      </div>
      <ScrollView className="share-body" viewportLabel="Share calculation details">
        <div className="share-snapshot">
          <span className="share-small-label">Current calculator</span>
          <strong>{title}</strong>
          {result && <div className="share-result"><span>Current result</span><strong>{result}</strong></div>}
        </div>
        <label className="share-small-label" htmlFor="share-url-field">Calculation link</label>
        <div className="share-link-field">
          <input id="share-url-field" ref={fieldRef} type="text" readOnly value={url}
            onFocus={event=>event.target.select()} aria-describedby="share-link-hint"/>
          <button type="button" onClick={()=>void copyLink()} aria-label="Copy calculation link" title="Copy link">
            {copied ? <Check size={16}/> : <Copy size={16}/>}
          </button>
        </div>
        <p id="share-link-hint" className="share-hint">
          {localOnly
            ? 'This is a local development link. It works only where this device/server can be reached; it is not a public URL.'
            : 'Opening the link restores these exact inputs. Nothing is uploaded or synced to an account.'}
        </p>
        <div className="share-actions">
          <button type="button" className="share-action-copy" onClick={()=>void copyLink()}>
            {copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? 'Copied' : 'Copy link'}
          </button>
          {nativeShare
            ? <button type="button" className="share-action-secondary" onClick={()=>void shareLink()}><Share2 size={15}/> Share via device</button>
            : <a className="share-action-secondary" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Open snapshot</a>}
        </div>
        <span className="share-feedback" role="status" aria-live="polite">{message}</span>
      </ScrollView>
    </section>
  </div>, stage);
}
