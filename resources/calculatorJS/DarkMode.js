// Tab Javascript & Dark Mode

if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('dark');
    setTabContentDarkMode(true);
}

function setTabContentDarkMode(isDarkMode) {
    const tabContents = document.getElementsByClassName('tabcontent');
    const tabLinks = document.getElementsByClassName('tablinks');
    for (let i = 0; i < tabContents.length; i++) {
        if (isDarkMode) {
            tabContents[i].classList.add('dark');
            tabLinks[i].classList.add('dark');
        } else {
            tabContents[i].classList.remove('dark');
            tabLinks[i].classList.remove('dark');
        }
    }
}