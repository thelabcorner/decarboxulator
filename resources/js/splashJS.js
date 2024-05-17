window.addEventListener('load', function () {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const logo = document.getElementById('logo');
    const logoWidth = logo.getBBox().width;
    const logoHeight = logo.getBBox().height;
    const logoRatio = logoWidth / logoHeight;
    const container = document.getElementById('logo-container');
    let containerWidth, containerHeight;
    if (screenWidth / screenHeight > logoRatio) {
        containerWidth = screenHeight * logoRatio;
        containerHeight = screenHeight;
    } else {
        containerWidth = screenWidth;
        containerHeight = screenWidth / logoRatio;
    }
    container.style.width = containerWidth + 'px';
    container.style.height = containerHeight + 'px';

    const duration = Math.floor(Math.random() * (3220 - 140) + 140) / 1000;

    document.getElementById('splash-screen').style.animationDuration = duration + 's';
    console.log('Splash screen duration: ' + duration.toFixed(2) + 's');
});

const splashScreen = document.getElementById('splash-screen');
splashScreen.addEventListener('animationend', function () {
    splashScreen.remove();
});