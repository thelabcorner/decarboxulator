/**
 * PWA Install Banner Logic - Cross-Platform Optimized
 */
class PWAInstallBanner {
    STORAGE_KEY = 'pwa-banner-dismissed';
    HIDE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

    constructor() {
        if (this.shouldSkip()) return;

        this.deferredPrompt = null;
        this.elements = {};
        this.init();
    }

    shouldSkip() {
        // 1. Check if already installed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone
            || document.referrer.includes('android-app://');
        if (isStandalone) return true;

        // 2. Check for In-App Browsers (FB, Instagram, etc.) - PWA install usually fails here
        const ua = navigator.userAgent || navigator.vendor || window.opera;
        const isInApp = (ua.indexOf("FBAN") > -1) || (ua.indexOf("FBAV") > -1) || (ua.indexOf("Instagram") > -1);
        if (isInApp) return true;

        // 3. Check LocalStorage dismissal
        const dismissedAt = localStorage.getItem(this.STORAGE_KEY);
        if (dismissedAt === 'true') return true;
        if (dismissedAt && Date.now() - parseInt(dismissedAt) < this.HIDE_DURATION) return true;

        return false;
    }

    init() {
        this.loadFontAwesome();
        this.render();
        this.cacheDOM();

        const device = this.detectDevice();
        this.setupInstructions(device);
        this.bindEvents();

        window.addEventListener('load', () => {
            setTimeout(() => this.toggleVisibility(true), 2000);
        });
    }

    detectDevice() {
        const ua = navigator.userAgent;
        // Handle iPadOS where it identifies as Macintosh
        const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        if (isIOS) return 'ios';
        if (/Android/i.test(ua)) return 'android';
        return 'desktop';
    }

    getStyles() {
        return `
            :root {
                --pwa-bg: #1a1a1a;
                --pwa-accent: #3b82f6;
                --pwa-text: #ffffff;
                --pwa-muted: #a1a1aa;
                --pwa-border: rgba(255, 255, 255, 0.1);
            }
            .pwa-install-banner {
                position: fixed;
                bottom: 10px; left: 10px; right: 10px; /* Changed to bottom for better thumb reach */
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
                    <div class="pwa-icon-box"><i class="fas fa-mobile-alt"></i></div>
                    <div class="pwa-body">
                        <h3 class="pwa-title">Install Decarboxulator&trade;</h3>
                        <p class="pwa-desc">Add the app to your homescreen for a faster, full-screen experience.</p>
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
            steps: document.getElementById('pwaSteps'),
            installBtn: document.getElementById('pwaInstallBtn'),
            laterBtn: document.getElementById('pwaLaterBtn'),
            closeBtn: document.getElementById('pwaCloseBtn')
        };
    }

    bindEvents() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.elements.installBtn.style.display = 'block';
            // Hide manual steps if native install is available
            this.elements.steps.style.display = 'none';
        });

        this.elements.installBtn.addEventListener('click', () => this.handleInstall());
        this.elements.laterBtn.addEventListener('click', () => this.dismiss(false));
        this.elements.closeBtn.addEventListener('click', () => this.dismiss(true));
        window.addEventListener('appinstalled', () => this.dismiss(true));
    }

    setupInstructions(device) {
        const configs = {
            ios: [
                { icon: 'fa-share-square', text: 'Tap the "Share" button' },
                { icon: 'fa-plus-square', text: 'Select "Add to Home Screen"' }
            ],
            android: [
                { icon: 'fa-ellipsis-v', text: 'Tap the three dots (menu)' },
                { icon: 'fa-arrow-down', text: 'Tap "Install App" or "Add to Home"' }
            ],
            desktop: [
                { icon: 'fa-desktop', text: 'Click the install icon in the address bar' }
            ]
        };

        const steps = configs[device] || configs.desktop;
        this.elements.steps.innerHTML = steps.map(s => `
            <div class="pwa-step">
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
        localStorage.setItem(this.STORAGE_KEY, permanent ? 'true' : Date.now().toString());
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