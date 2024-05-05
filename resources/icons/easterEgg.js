function easterEgg() {
    const audio = document.getElementById('audio');
    audio.volume = 1; // Set volume to 50%
    audio.play();
    fadeOut();

    // Define a function to gradually decrease the volume of the audio clip
    function fadeOut() {
        const fadeInterval = 50; // Time interval between volume changes (ms)
        const clipDuration = audio.duration * 1000; // Duration of the clip in milliseconds
        const fadeStart = clipDuration * 0.75; // Point at which the fade-out should start
        const fadeDuration = clipDuration - fadeStart; // Duration of the fade-out (ms)
        const fadeSteps = fadeDuration / fadeInterval; // Number of volume changes
        const fadeAmount = audio.volume / fadeSteps; // Amount to decrease volume by each step
        let step = 0;

        const fadeIntervalId = setInterval(() => {
            if (!audio.paused) {
                step++;
                audio.volume -= fadeAmount;
                if (audio.volume < 0) {
                    audio.volume = 0;
                }
                if (step >= fadeSteps) {
                    clearInterval(fadeIntervalId);
                    audio.pause();
                }
            } else {
                clearInterval(fadeIntervalId);
            }
        }, fadeInterval);
    }
}