import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Copy, Download, Ellipsis, ExternalLink, MonitorDown, Plus, Share2, Smartphone, X } from 'lucide-react';
import { DcxrMark } from './DcxrMark';
import { useDialogFocus } from '../lib/useDialogFocus';
import { ScrollView } from './ScrollView';
import './InstallAppDialog.css';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
type Platform = 'ios-safari' | 'ios-other' | 'android' | 'desktop' | 'embedded';

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (/FBAN|FBAV|Instagram|TikTok|Snapchat|LinkedIn|Line\/|; wv\)|; wv\b/i.test(ua)) return 'embedded';
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua) ? 'ios-other' : 'ios-safari';
  return /Android/i.test(ua) ? 'android' : 'desktop';
}
function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

/** Always mounted to retain beforeinstallprompt, but visible only after an explicit rail click. */
export function InstallAppDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useDialogFocus<HTMLElement>(open, onClose);
  const nativePrompt = useRef<InstallPromptEvent | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [secureOrigin, setSecureOrigin] = useState(true);
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isInstalled());
    setSecureOrigin(window.isSecureContext);
    const onPrompt = (event: Event) => {
      event.preventDefault(); // Defer the native dialog until a deliberate click.
      nativePrompt.current = event as InstallPromptEvent;
      setCanPrompt(true);
    };
    const onInstalled = () => { setInstalled(true); setCanPrompt(false); nativePrompt.current = null; };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function promptInstall() {
    const prompt = nativePrompt.current;
    if (!prompt) return;
    nativePrompt.current = null;
    setCanPrompt(false);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') onClose();
    } catch { /* Keep manual instructions available when the browser declines. */ }
  }
  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
    } catch { setCopied(false); }
  }

  if (!open) return null;
  const isIOS = platform === 'ios-safari' || platform === 'ios-other';
  const steps = installed ? [] : platform === 'embedded' ? [
    { icon: <Ellipsis size={15}/>, text: 'Open the browser menu in this app.' },
    { icon: <ExternalLink size={15}/>, text: 'Choose Open in Browser, Safari, or Chrome, then return here.' },
  ] : platform === 'ios-other' ? [
    { icon: <Copy size={15}/>, text: 'Copy the current page address.' },
    { icon: <ExternalLink size={15}/>, text: 'Open the address in Safari for the standard home-screen flow.' },
    { icon: <Share2 size={15}/>, text: 'Use Share → Add to Home Screen, then tap Add.' },
  ] : platform === 'ios-safari' ? [
    { icon: <Share2 size={15}/>, text: 'Tap the Share button in the Safari toolbar.' },
    { icon: <Plus size={15}/>, text: 'Choose Add to Home Screen in the share sheet.' },
    { icon: <Check size={15}/>, text: 'Confirm Add to launch Decarboxulator from your Home Screen.' },
  ] : platform === 'android' ? [
    { icon: <Ellipsis size={15}/>, text: 'Open the browser menu.' },
    { icon: <Plus size={15}/>, text: 'Choose Install app or Add to Home screen.' },
  ] : [
    { icon: <MonitorDown size={15}/>, text: 'Use the install icon in your browser address bar, if available.' },
    { icon: <Ellipsis size={15}/>, text: 'Or check the browser menu for Install Decarboxulator.' },
  ];
  return <div className="tool-search-layer install-layer">
    <button type="button" className="tool-search-backdrop" aria-label="Close install guide" onClick={onClose}/>
    <section ref={ref} className="install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-heading">
      <div className="install-header">
        <span className="install-mark"><DcxrMark/></span>
        <span className="install-header-copy"><span className="install-eyebrow">DECARBOXULATOR / V4</span>
          <strong id="install-heading">{installed ? 'Already installed' : 'Install the app'}</strong></span>
        <button type="button" className="install-icon-button" aria-label="Close install guide" data-dialog-initial onClick={onClose}><X size={16}/></button>
      </div>
      <ScrollView className="install-content" viewportLabel="Installation instructions">
         <div className="install-intro">
          <span className="install-intro-icon">{installed ? <Check size={19}/> : isIOS || platform === 'android' ? <Smartphone size={19}/> : <Download size={19}/>}</span>
          <p>{installed ? 'Decarboxulator is already running as an installed app.' :
            platform === 'embedded' ? 'Open Decarboxulator in your system browser before adding it to your device.' :
            'Keep the calculator studio one tap away in its own app window.'}</p>
        </div>
        {steps.length > 0 && <div className="install-steps" aria-label="Installation instructions">
          {steps.map((step, i) => <div className="install-step" key={i}>
            <span className="install-step-number">{String(i + 1).padStart(2, '0')}</span>
            <span className="install-step-icon">{step.icon}</span>
            <span>{step.text}</span>
          </div>)}
         </div>}
         {!installed && !secureOrigin && <div className="install-security-note" role="note">
           This HTTP network address may not support full app installation. Open the HTTPS-hosted version of Decarboxulator for reliable PWA installation.
         </div>}
        {!installed && (platform === 'ios-other' || platform === 'embedded') &&
          <button type="button" className="install-copy" onClick={() => void copyAddress()}>
            {copied ? <Check size={14}/> : <Copy size={14}/>}
            {copied ? 'Link copied' : 'Copy page link'}
          </button>}
      </ScrollView>
      <div className="install-footer">
        <span>{installed ? 'Ready to use' : 'No account required'}</span>
        {canPrompt && !installed && platform !== 'embedded' ?
          <button type="button" className="install-primary" onClick={() => void promptInstall()}>
            <Download size={14}/> Install now <ArrowUpRight size={13}/>
          </button> :
          <button type="button" className="install-secondary" onClick={onClose}>{installed ? 'Done' : 'Close'}</button>}
      </div>
    </section>
  </div>;
}
