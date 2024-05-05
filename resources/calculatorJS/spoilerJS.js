function toggleSpoiler(spoilerId) {
    const spoilerContent = document.getElementById(spoilerId);
    if (spoilerContent.style.maxHeight) {
        spoilerContent.style.maxHeight = null;
    } else {
        spoilerContent.style.maxHeight = spoilerContent.scrollHeight + "px";
    }
}