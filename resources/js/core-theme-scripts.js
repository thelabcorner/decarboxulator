/*!
* Start Bootstrap - Simple Sidebar v6.0.6 (https://startbootstrap.com/template/simple-sidebar)
* Copyright 2013-2023 Start Bootstrap
* Licensed under MIT (https://github.com/StartBootstrap/startbootstrap-simple-sidebar/blob/master/LICENSE)
*/
// 
// Scripts
// 

window.addEventListener('DOMContentLoaded', event => {

    // Toggle the side navigation
    const sidebarToggle = document.body.querySelector('#sidebarToggle');
    if (sidebarToggle) {
        // Uncomment Below to persist sidebar toggle between refreshes
        // if (localStorage.getItem('sb|sidebar-toggle') === 'true') {
        //     document.body.classList.toggle('sb-sidenav-toggled');
        // }
        sidebarToggle.addEventListener('click', event => {
            event.preventDefault();
            document.body.classList.toggle('sb-sidenav-toggled');
            localStorage.setItem('sb|sidebar-toggle', document.body.classList.contains('sb-sidenav-toggled'));
        });
    }

});

// Dark Mode
document.addEventListener('DOMContentLoaded', function() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const body = document.body;

    // Check user's preferred color scheme on load
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    body.classList.toggle('dark-mode', isDarkMode);

    // Update the checkbox state based on the initial mode
    darkModeToggle.checked = isDarkMode;

    // Listen for changes in the user's preferred color scheme
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
        body.classList.toggle('dark-mode', event.matches);
        darkModeToggle.checked = event.matches;
    });

    // Listen for manual toggle changes
    darkModeToggle.addEventListener('change', function() {
        body.classList.toggle('dark-mode', this.checked);
    });
});
