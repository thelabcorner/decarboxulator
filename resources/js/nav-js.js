
    // Mobile menu toggle functionality - define globally to avoid timing issues
window.toggleMobileMenu = function() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const mobileNav = document.getElementById('mobileNav');

    if (toggle && mobileNav) {
    toggle.classList.toggle('active');
    mobileNav.classList.toggle('show');
}
};

    // Enhanced include HTML function to handle scripts
async function includeHTML(id, url) {
    const el = document.getElementById(id);
    const response = await fetch(url);
    if (!response.ok) {
        console.error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
        return;
    }
    const html = await response.text();
    el.innerHTML = html;

    // Execute any scripts in the loaded HTML
    const scripts = el.querySelectorAll('script');
    scripts.forEach(script => {
        const newScript = document.createElement('script');
        newScript.textContent = script.textContent;
        document.head.appendChild(newScript);
    });
}

    // Process includes and set up mobile menu handlers
document.addEventListener('DOMContentLoaded', async function() {
    // Process link[rel="include"] elements first
    const includeLinks = document.querySelectorAll('link[rel="include"]');
    for (const link of includeLinks) {
    const res = await fetch(link.getAttribute('href'));
    const html = await res.text();
    link.insertAdjacentHTML('beforebegin', html);
    link.remove();
}

    // Process nav and footer
await Promise.all([
    includeHTML("nav", "/decarboxulator/pages/v2/dynamic/nav.html"),
    includeHTML("footer", "/decarboxulator/pages/v2/dynamic/footer.html")
    ]);

    // Set up mobile menu event handlers after nav is loaded
    setupMobileMenuHandlers();
});

function setupMobileMenuHandlers() {
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(event) {
        const toggle = document.querySelector('.mobile-menu-toggle');
        const mobileNav = document.getElementById('mobileNav');
        const navbar = document.querySelector('.navbar-modern');

        if (navbar && toggle && mobileNav &&
            !navbar.contains(event.target) &&
            mobileNav.classList.contains('show')) {
            toggle.classList.remove('active');
            mobileNav.classList.remove('show');
        }
    });

    // Close mobile menu when clicking on a nav link
    document.querySelectorAll('.nav-link-mobile').forEach(link => {
    link.addEventListener('click', function() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const mobileNav = document.getElementById('mobileNav');

    if (toggle && mobileNav) {
    toggle.classList.remove('active');
    mobileNav.classList.remove('show');
}
});
});

    // Handle window resize
window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const mobileNav = document.getElementById('mobileNav');

    if (toggle && mobileNav) {
    toggle.classList.remove('active');
    mobileNav.classList.remove('show');
}
}
});
}

function setActiveNavLink() {
    const currentPath = window.location.pathname.replace(/\/$/, ''); // Remove trailing slash
    document.querySelectorAll('.nav-link').forEach(link => {
        // Normalize href to compare only the path part
        const linkPath = new URL(link.href, window.location.origin).pathname.replace(/\/$/, '');
        if (linkPath === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    setActiveNavLink();
});

