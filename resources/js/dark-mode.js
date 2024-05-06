document.addEventListener('DOMContentLoaded', function() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const body = document.body;

    // Check if the user has a preferred mode stored in a cookie
    const darkModeCookie = getCookie('darkMode');
    let isDarkMode;

    if (darkModeCookie === 'true') {
        isDarkMode = true;
    } else if (darkModeCookie === 'false') {
        isDarkMode = false;
    } else {
        // If no cookie is set, use the user's preferred color scheme
        isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    body.classList.toggle('dark-mode', isDarkMode);
    darkModeToggle.checked = isDarkMode;

    // Listen for changes in the user's preferred color scheme
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
        // Only update the mode if the user hasn't set a preference in the cookie
        if (getCookie('darkMode') === '') {
            body.classList.toggle('dark-mode', event.matches);
            darkModeToggle.checked = event.matches;
        }
    });

    // Listen for manual toggle changes
    darkModeToggle.addEventListener('change', function() {
        const isDarkMode = this.checked;
        body.classList.toggle('dark-mode', isDarkMode);
        setCookie('darkMode', isDarkMode, 365); // Set the cookie to expire in 1 year
        console.log(`Dark mode set to ${isDarkMode}`);
    });

    // Helper functions for working with cookies
    function setCookie(name, value, days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = 'expires=' + date.toUTCString();
        document.cookie = `${name}=${value};${expires};path=/`;
    }

    function getCookie(name) {
        const nameEQ = `${name}=`;
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return '';
    }
});