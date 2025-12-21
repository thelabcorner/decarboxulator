/**
 * PWA Install Banner Logic - Cross-Platform Optimized
 * Updated: Handles In-App Browsers & Non-Safari iOS restrictions
 */
class PWAInstallBanner {
    STORAGE_KEY = 'pwa-banner-dismissed';
    HIDE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

    constructor() {
        this.environment = this.detectEnvironment();

        if (this.shouldSkip()) return;

        this.deferredPrompt = null;
        this.elements = {};
        this.init();
    }

    shouldSkip() {
        // 1. Check if already installed (Standalone mode)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone
            || document.referrer.includes('android-app://');
        if (isStandalone) return true;

        // 2. Check LocalStorage dismissal
        // We do NOT skip for In-App Browsers anymore; we want to warn them.
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            try {
                const data = JSON.parse(stored);
                if (data.permanent) return true;
                if (data.timestamp && Date.now() - data.timestamp < this.HIDE_DURATION) return true;
            } catch (e) {
                // Invalid JSON, ignore
            }
        }

        return false;
    }

    detectEnvironment() {
        const ua = navigator.userAgent || navigator.vendor || window.opera;

        // 1. Detect OS
        const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isAndroid = /Android/i.test(ua);

        // 2. Detect In-App Browsers (FB, IG, TikTok, Snapchat, Line, etc)
        // Note: 'wv' is often used for Android WebViews
        const isIAB = /FBAN|FBAV|Instagram|bytedance|Musical\.ly|TikTok|Snapchat|Line|Twitter|LinkedIn|wv/.test(ua);

        // 3. Detect Specific iOS Browsers
        // iOS Chrome = CriOS, iOS Firefox = FxiOS, iOS Edge = EdgiOS
        const isIOSChrome = isIOS && /CriOS/.test(ua);
        const isIOSNonSafari = isIOS && (isIOSChrome || /FxiOS|EdgiOS|OPiOS|MercuryiOS/.test(ua));

        // Strictly Safari (Not Chrome/Firefox on iOS)
        const isSafari = isIOS && /Safari/.test(ua) && !isIOSNonSafari;

        return { isIOS, isAndroid, isIAB, isSafari, isIOSNonSafari };
    }

    init() {
        this.loadFontAwesome();
        this.render();
        this.cacheDOM();

        this.setupInstructions();
        this.bindEvents();

        window.addEventListener('load', () => {
            setTimeout(() => this.toggleVisibility(true), 2000);
        });
    }

    getStyles() {
        return `
            :root {
                --pwa-bg: #1a1a1a;
                --pwa-accent: #3b82f6;
                --pwa-warning: #f59e0b;
                --pwa-text: #ffffff;
                --pwa-muted: #a1a1aa;
                --pwa-border: rgba(255, 255, 255, 0.1);
            }
            .pwa-install-banner {
                position: fixed;
                bottom: 10px; left: 10px; right: 10px;
                background: var(--pwa-bg);
                border: 1px solid var(--pwa-border);
                border-radius: 10px;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
                z-index: 9999;
                transform: translateY(150%);
                opacity: 0;
                transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            .pwa-install-banner.active { transform: translateY(0); opacity: 1; }
            .pwa-container { padding: 1.25rem; display: flex; gap: 1rem; position: relative; }
            .pwa-icon-box {
                width: 48px; height: 48px; flex-shrink: 0;
                background: linear-gradient(135deg, #3b82f6, #2563eb);
                border-radius: 12px; display: flex; align-items: center;
                justify-content: center; color: #fff; font-size: 1.25rem;
            }
            /* Change color for warning state (IAB/Non-Safari) */
            .pwa-icon-box.is-warning { background: linear-gradient(135deg, #f59e0b, #d97706); }
            
            .pwa-body { flex: 1; padding-right: 20px; }
            .pwa-title { margin: 0 0 4px; font-size: 1rem; color: var(--pwa-text); font-weight: 600; }
            .pwa-desc { margin: 0 0 12px; font-size: 0.85rem; color: var(--pwa-muted); line-height: 1.4; }
            .pwa-steps { display: grid; gap: 6px; margin-bottom: 12px; }
            .pwa-step {
                display: flex; align-items: center; gap: 8px;
                background: rgba(255,255,255,0.05); padding: 6px 10px;
                border-radius: 6px; font-size: 0.75rem; color: var(--pwa-text);
            }
            .pwa-step i { color: var(--pwa-accent); width: 14px; text-align: center; }
            .pwa-step.warning i { color: var(--pwa-warning); }
            
            .pwa-actions { display: flex; gap: 8px; }
            .pwa-btn {
                padding: 10px 16px; border-radius: 8px; border: 1px solid var(--pwa-border);
                font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: 0.2s;
            }
            .pwa-btn-main { background: var(--pwa-accent); color: #fff; border: none; flex: 2; }
            .pwa-btn-ghost { background: rgba(255,255,255,0.05); color: var(--pwa-text); flex: 1; }
            .pwa-close {
                position: absolute; top: 10px; right: 10px;
                background: none; border: none; color: var(--pwa-muted);
                cursor: pointer; font-size: 1.1rem; padding: 5px;
            }
            @media (min-width: 600px) {
                .pwa-install-banner { width: 400px; left: auto; right: 20px; }
            }
        `;
    }

    render() {
        const html = `
            <style>${this.getStyles()}</style>
            <div id="pwaBanner" class="pwa-install-banner">
                <div class="pwa-container">
                    <button id="pwaCloseBtn" class="pwa-close"><i class="fas fa-times"></i></button>
                    <div id="pwaIcon" class="pwa-icon-box"><i class="fas fa-mobile-alt"></i></div>
                    <div class="pwa-body">
                        <h3 id="pwaTitle" class="pwa-title">Install App</h3>
                        <p id="pwaDesc" class="pwa-desc">Add to homescreen for the best experience.</p>
                        <div id="pwaSteps" class="pwa-steps"></div>
                        <div class="pwa-actions">
                            <button id="pwaInstallBtn" class="pwa-btn pwa-btn-main" style="display:none;">Install Now</button>
                            <button id="pwaLaterBtn" class="pwa-btn pwa-btn-ghost">Later</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    }

    cacheDOM() {
        this.elements = {
            banner: document.getElementById('pwaBanner'),
            iconBox: document.getElementById('pwaIcon'),
            title: document.getElementById('pwaTitle'),
            desc: document.getElementById('pwaDesc'),
            steps: document.getElementById('pwaSteps'),
            installBtn: document.getElementById('pwaInstallBtn'),
            laterBtn: document.getElementById('pwaLaterBtn'),
            closeBtn: document.getElementById('pwaCloseBtn')
        };
    }

    bindEvents() {
        // Handle native install prompt (Android/Desktop)
        window.addEventListener('beforeinstallprompt', (e) => {
            // If we are in an IAB, we usually don't get this event,
            // but if we do, we should respect the specific IAB check logic first.
            if (this.environment.isIAB) return;

            e.preventDefault();
            this.deferredPrompt = e;
            this.elements.installBtn.style.display = 'block';
            this.elements.steps.style.display = 'none';
        });

        this.elements.installBtn.addEventListener('click', () => this.handleInstall());
        this.elements.laterBtn.addEventListener('click', () => this.dismiss(false));
        this.elements.closeBtn.addEventListener('click', () => this.dismiss(true));
        window.addEventListener('appinstalled', () => this.dismiss(true));
    }

    setupInstructions() {
        const { isIOS, isAndroid, isIAB, isSafari, isIOSNonSafari } = this.environment;
        let steps = [];
        let title = "Install Decarboxulator™";
        let desc = "Add to homescreen for a full-screen experience.";
        let icon = "fa-mobile-alt";
        let isWarning = false;

        // 1. In-App Browser Handling (IG, FB, TikTok)
        if (isIAB) {
            title = "Open in Browser";
            desc = "To install this app, you must open it in your system browser.";
            icon = "fa-external-link-alt";
            isWarning = true;

            if (isIOS) {
                steps = [
                    { icon: 'fa-ellipsis-h', text: 'Tap the menu icon (•••)' },
                    { icon: 'fa-compass', text: 'Select "Open in Safari" or "Open in Browser"' }
                ];
            } else {
                // Android IAB
                steps = [
                    { icon: 'fa-ellipsis-v', text: 'Tap the menu icon (⋮)' },
                    { icon: 'fa-chrome', text: 'Select "Open in Chrome" or "Browser"' }
                ];
            }
        }
        // 2. iOS Non-Safari Handling (Chrome on iOS, Firefox on iOS)
        else if (isIOSNonSafari) {
            title = "Open in Safari";
            desc = "Installation is only supported in the Safari browser.";
            icon = "fa-compass";
            isWarning = true;
            steps = [
                { icon: 'fa-copy', text: 'Copy this page URL' },
                { icon: 'fa-compass', text: 'Open the <b>Safari</b> app and paste URL' }
            ];
        }
        // 3. iOS Safari (Standard Manual Install)
        else if (isSafari) {
            steps = [
                { icon: 'fa-share-square', text: 'Tap the "Share" button' },
                { icon: 'fa-plus-square', text: 'Select "Add to Home Screen"' }
            ];
        }
        // 4. Android (Manual fallback if beforeinstallprompt fails)
        else if (isAndroid) {
            steps = [
                { icon: 'fa-ellipsis-v', text: 'Tap the three dots (menu)' },
                { icon: 'fa-arrow-down', text: 'Tap "Install App" or "Add to Home"' }
            ];
        }
        // 5. Desktop Default
        else {
            steps = [
                { icon: 'fa-desktop', text: 'Click the install icon in the address bar' }
            ];
        }

        // Update UI
        this.elements.title.innerText = title;
        this.elements.desc.innerText = desc;
        this.elements.iconBox.innerHTML = `<i class="fas ${icon}"></i>`;

        if (isWarning) {
            this.elements.iconBox.classList.add('is-warning');
            this.elements.laterBtn.innerText = "Close"; // 'Later' doesn't make sense for a redirect warning
        }

        this.elements.steps.innerHTML = steps.map(s => `
            <div class="pwa-step ${isWarning ? 'warning' : ''}">
                <i class="fas ${s.icon}"></i>
                <span>${s.text}</span>
            </div>
        `).join('');
    }

    async handleInstall() {
        if (!this.deferredPrompt) return;
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        if (outcome === 'accepted') this.dismiss(true);
        this.deferredPrompt = null;
    }

    toggleVisibility(show) {
        if (this.elements.banner) {
            this.elements.banner.classList.toggle('active', show);
        }
    }

    dismiss(permanent = false) {
        this.toggleVisibility(false);
        const data = {
            permanent: permanent,
            timestamp: permanent ? null : Date.now()
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    }

    loadFontAwesome() {
        if (!document.querySelector('link[href*="font-awesome"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
            document.head.appendChild(link);
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new PWAInstallBanner());
} else {
    new PWAInstallBanner();
}