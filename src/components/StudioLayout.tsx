import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  BookOpenText, ChevronRight, Command, Download,
  History, LayoutGrid, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun,
} from 'lucide-react';
import { APP_MAJOR_VERSION, CREATOR_NAME, CREATOR_URL, FAQ_PATH, GUIDE_PATH, NAV_ITEMS, SOURCE_URL, TOOLS } from '../lib/site';
const ToolSearch = lazy(() => import('./ToolSearch').then(module => ({default:module.ToolSearch})));
const HistoryDrawer = lazy(() => import('./HistoryDrawer').then(module => ({default:module.HistoryDrawer})));
import { SavedLibraryContext } from '../lib/SavedLibraryContext';
import { ActivationDeltaMark } from './ActivationDeltaMark';
import { ScrollView } from './ScrollView';
import { InstallAppDialog } from './InstallAppDialog';
import { VersionBadge } from './VersionBadge';

type Theme = 'light' | 'dark';
type NavEntry = (typeof NAV_ITEMS)[number];

const OVERVIEW = NAV_ITEMS[0];
const MOBILE_NAV_QUERY = '(max-width: 760px)';
function subscribeMobileNav(onChange: () => void) {
  const query = window.matchMedia(MOBILE_NAV_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
function getMobileNav() { return window.matchMedia(MOBILE_NAV_QUERY).matches; }
function getServerMobileNav() { return false; }

function RailButton({ label, children, onClick, active = false }: {
  label: string; children: React.ReactNode; onClick: () => void; active?: boolean;
}) {
  return (
    <button type="button" className="rail-control" title={label} aria-label={label}
      aria-pressed={active} data-active={active} onClick={onClick}>{children}</button>
  );
}

function SidebarLink({ item, current, onNavigate, compact = false }: {
  item: NavEntry; current: string; onNavigate: () => void; compact?: boolean;
}) {
  return (
    <Link to={item.path} className={compact ? 'rail-route' : 'studio-nav-link'}
      title={compact ? item.name : undefined} aria-label={compact ? item.name : undefined}
      data-active={current === item.path} activeProps={{ 'aria-current': 'page' }}
      onClick={onNavigate}>
      <item.icon size={compact ? 18 : 15} strokeWidth={1.75} aria-hidden="true"/>
      {compact ? null : <span className="studio-nav-title">{item.name}</span>}
      {compact ? null : item.version ? <VersionBadge version={item.version}/> :
        <ChevronRight className="studio-nav-chevron" size={13} strokeWidth={1.7} aria-hidden="true"/>}
    </Link>
  );
}

/** One shared navigation model drives desktop rail, tool pane and mobile drawer. */
export function StudioLayout() {
  const pathname = useRouterState({
    select: state => state.matches[state.matches.length - 1]?.routeId ?? '/',
  });
  const current = NAV_ITEMS.find(item => item.path === pathname) ?? OVERVIEW;
  const isMobile = useSyncExternalStore(subscribeMobileNav, getMobileNav, getServerMobileNav);
  const [theme, setTheme] = useState<Theme>('light');
  const [paneExpanded, setPaneExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [libraryRecordId, setLibraryRecordId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const openLibrary = (id?: string) => {
    setMobileOpen(false);
    setSearchOpen(false);
    setInstallOpen(false);
    setLibraryRecordId(id ?? null);
    setHistoryOpen(true);
  };

  useEffect(() => {
    const saved = localStorage.getItem('decarboxulator-theme');
    setTheme(saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light');
    setPaneExpanded(localStorage.getItem('decarboxulator-pane') !== 'collapsed');
  }, []);
  useEffect(() => {
    // Silently prepare offline capability. Both the installation guide and
    // native browser install prompt remain exclusive to the rail download action.
    if (!window.isSecureContext || !('serviceWorker' in navigator)) return;
    const register = () => {
      const script = import.meta.env.BASE_URL + 'sw.js';
      // Check the MIME type: Vite's development fallback serves HTML for
      // missing routes. Register only a real built service worker.
      void fetch(script, { method: 'HEAD', cache: 'no-store' })
        .then(response => {
          if (!response.ok || !/javascript/i.test(response.headers.get('content-type') ?? '')) return;
          return navigator.serviceWorker.register(script, { scope: import.meta.env.BASE_URL });
        })
        .catch(() => { /* Manual installation guidance remains available. */ });
    };
    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register, { once: true });
      return () => window.removeEventListener('load', register);
    }
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  useEffect(() => { setMobileOpen(false); setInstallOpen(false); }, [pathname]);
  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(value => !value);
        setInstallOpen(false);
        setMobileOpen(false);
        setHistoryOpen(false);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        if (isMobile) {
          setMobileOpen(open => !open);
        } else {
          setPaneExpanded(prev => {
            localStorage.setItem('decarboxulator-pane', prev ? 'collapsed' : 'expanded');
            return !prev;
          });
        }
      }
      if (event.key === 'Escape') {
        setMobileOpen(false);
        setSearchOpen(false);
        setInstallOpen(false);
        setHistoryOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeys);
    return () => document.removeEventListener('keydown', handleKeys);
  }, [isMobile]);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [mobileOpen]);

  useEffect(() => {
    // Centralized for every stage-owned overlay (command, install and share).
    // The virtual keyboard shrinks the visual viewport without consistently
    // changing 100dvh; keep dialogs inside its visible area, not over the rail.
    const visual = window.visualViewport;
    const stage = stageRef.current;
    if (!visual || !stage) return;
    const updateInset = () => {
      const bounds = stage.getBoundingClientRect();
      const visualBottom = visual.offsetTop + visual.height;
      const bottomInset = Math.max(0, Math.ceil(bounds.bottom - visualBottom));
      const topInset = Math.max(0, Math.ceil(visual.offsetTop - bounds.top));
      stage.style.setProperty('--dialog-visual-bottom-inset', bottomInset + 'px');
      stage.style.setProperty('--dialog-visual-top-inset', topInset + 'px');
    };
    updateInset();
    visual.addEventListener('resize', updateInset);
    visual.addEventListener('scroll', updateInset);
    window.addEventListener('resize', updateInset);
    window.addEventListener('pageshow', updateInset);
    window.addEventListener('orientationchange', updateInset);
    return () => {
      visual.removeEventListener('resize', updateInset);
      visual.removeEventListener('scroll', updateInset);
      window.removeEventListener('resize', updateInset);
      window.removeEventListener('pageshow', updateInset);
      window.removeEventListener('orientationchange', updateInset);
      stage.style.removeProperty('--dialog-visual-bottom-inset');
      stage.style.removeProperty('--dialog-visual-top-inset');
    };
  }, []);

  const closeMobile = () => setMobileOpen(false);
  const openSearch = () => {
    setMobileOpen(false);
    setInstallOpen(false);
    setHistoryOpen(false);
    setSearchOpen(true);
  };
  const openInstall = () => {
    setMobileOpen(false);
    setSearchOpen(false);
    setHistoryOpen(false);
    setInstallOpen(true);
  };
  const toggleTheme = () => setTheme(previous => {
    const next = previous === 'dark' ? 'light' : 'dark';
    localStorage.setItem('decarboxulator-theme', next);
    return next;
  });
  const togglePane = () => setPaneExpanded(previous => {
    localStorage.setItem('decarboxulator-pane', previous ? 'collapsed' : 'expanded');
    return !previous;
  });
  const toggleNavigation = () => {
    if (isMobile) {
      setMobileOpen(open => !open);
    } else {
      togglePane();
    }
  };

  return (
    <SavedLibraryContext.Provider value={openLibrary}>
    <div className="app-shell" data-pane-expanded={paneExpanded} data-mobile-open={mobileOpen}>
      <a className="skip-link" href="#main">Skip to calculator</a>
      {mobileOpen ? <button type="button" className="studio-sidebar-scrim" aria-label="Close calculator navigation" onClick={closeMobile}/> : null}
      <aside className="studio-sidebar" id="studio-navigation" aria-label="Workspace navigation">
        <div className="studio-rail">
          <Link to="/" onClick={closeMobile} className="rail-brand" aria-label="Decarboxulator overview" title="Decarboxulator">
             <ActivationDeltaMark className="activation-delta-mark"/>
          </Link>
          <nav className="rail-routes" aria-label="Primary sections">
            <SidebarLink item={OVERVIEW} current={pathname} onNavigate={closeMobile} compact/>
            <button type="button" className="rail-control rail-browse-button"
              title="Browse calculators" aria-label="Browse calculators"
              aria-controls="studio-tool-pane" aria-expanded={isMobile ? mobileOpen : paneExpanded}
              data-active={isMobile ? mobileOpen : paneExpanded}
              onClick={toggleNavigation}>
              <LayoutGrid size={18} strokeWidth={1.75}/>
            </button>
            <SidebarLink item={NAV_ITEMS[NAV_ITEMS.length - 1]} current={pathname} onNavigate={closeMobile} compact/>
          </nav>
          <div className="rail-bottom">
            <RailButton label="Search calculators" onClick={openSearch}><Search size={18} strokeWidth={1.75}/></RailButton>
            <RailButton label="Saved calculations" onClick={() => openLibrary()}><History size={18} strokeWidth={1.75}/></RailButton>
            <RailButton label="Install Decarboxulator app" onClick={openInstall} active={installOpen}><Download size={18} strokeWidth={1.75}/></RailButton>
            <RailButton label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={18} strokeWidth={1.75}/> : <Moon size={18} strokeWidth={1.75}/>}
            </RailButton>
          </div>
        </div>
        <div className="studio-section-pane" id="studio-tool-pane">
          <div className="studio-pane-heading">
            <div className="studio-pane-title"><strong>Decarboxulator</strong><span className="brand-trademark">™</span></div>
             <span className="studio-pane-version">{APP_MAJOR_VERSION}</span>
          </div>
          <ScrollView className="studio-pane-body" viewportLabel="Calculator navigation">
            <div className="studio-pane-group">
              <div className="studio-group-heading">Workspace</div>
              <SidebarLink item={OVERVIEW} current={pathname} onNavigate={closeMobile}/>
            </div>
            <div className="studio-pane-group">
              <div className="studio-group-heading">Calculators <span>{TOOLS.length}</span></div>
              <nav className="studio-tool-list" aria-label="All calculators">
                {NAV_ITEMS.slice(1, 1 + TOOLS.length).map(item =>
                  <SidebarLink key={item.path} item={item} current={pathname} onNavigate={closeMobile}/>)}
              </nav>
            </div>
            <div className="studio-pane-group">
              <div className="studio-group-heading">Reference</div>
              {NAV_ITEMS.filter(item => item.path === FAQ_PATH || item.path === GUIDE_PATH)
                .map(item => <SidebarLink key={item.path} item={item} current={pathname} onNavigate={closeMobile}/>)}
            </div>
          </ScrollView>
          <div className="studio-pane-bottom">
            <span className="studio-pane-bottom-icon"><BookOpenText size={14} strokeWidth={1.8}/></span>
            <a href={CREATOR_URL} target="_blank" rel="noopener noreferrer" title="TheDabCorner · Created by Jackson Cummings">{CREATOR_NAME}</a>
            <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" title="Decarboxulator source code">GitHub</a>
            <button className="pane-collapse" onClick={toggleNavigation} aria-label="Collapse sidebar" title="Collapse sidebar (⌘ B)" type="button">
              <PanelLeftClose size={16}/>
            </button>
          </div>
        </div>
      </aside>
       <div className="workspace-stage" ref={stageRef}>
        <header className="workspace-toolbar">
          <div className="workspace-toolbar-leading">
            <button type="button" className="icon-button desktop-pane-button" onClick={togglePane}
              aria-label={paneExpanded ? 'Collapse navigation pane' : 'Expand navigation pane'}>
              {paneExpanded ? <PanelLeftClose size={16}/> : <PanelLeftOpen size={16}/>}
            </button>
            <span className="workspace-toolbar-section">Decarboxulator</span>
            <ChevronRight className="toolbar-chevron" size={14} aria-hidden="true"/>
            <span className="workspace-toolbar-current">{pathname === GUIDE_PATH || pathname === FAQ_PATH ? 'Reference' : current.name}</span>
          </div>
          <div className="workspace-toolbar-actions">
            <button type="button" className="toolbar-search" onClick={openSearch} aria-label="Search calculators">
              <Search size={15}/><span>Find a tool</span><kbd><Command size={11}/> K</kbd>
            </button>
            <button type="button" className="icon-button" title="Saved calculations" aria-label="Saved calculations" onClick={() => openLibrary()}>
              <History size={16}/>
            </button>
            <button type="button" className="icon-button toolbar-theme-button" title="Change theme" aria-label="Change theme" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}
            </button>
          </div>
        </header>
         <ScrollView key={pathname} as="main" id="main" className="content-main" viewportLabel="Calculator workspace" restoreKey={pathname}><Outlet/></ScrollView>
        <footer className="studio-statusbar">
          <span>Decarboxulator <span className="statusbar-divider">/</span> Created by <a href={CREATOR_URL} target="_blank" rel="noopener noreferrer">{CREATOR_NAME}</a></span>
          <span className="studio-statusbar-links">
            <a href={CREATOR_URL} target="_blank" rel="noopener noreferrer">TheDabCorner <ChevronRight size={12}/></a>
            <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">GitHub <ChevronRight size={12}/></a>
            <Link to={FAQ_PATH}>FAQ <ChevronRight size={12}/></Link>
          </span>
        </footer>
        {searchOpen ? <Suspense fallback={null}><ToolSearch open onClose={() => setSearchOpen(false)}/></Suspense> : null}
        <InstallAppDialog open={installOpen} onClose={() => setInstallOpen(false)}/>
      </div>
      {historyOpen ? <Suspense fallback={null}><HistoryDrawer open requestedId={libraryRecordId} onClose={() => setHistoryOpen(false)}/></Suspense> : null}
    </div>
    </SavedLibraryContext.Provider>
  );
}
