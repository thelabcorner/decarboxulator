const licenseLink = document.querySelector('a[href="#license-modal"]');
const licenseModal = document.querySelector('#license-modal');
const closeBtn = licenseModal.querySelector('button');

if (!licenseLink) {
    console.error('License link not found.');
}

if (!licenseModal) {
    console.error('License modal not found.');
}


if (!closeBtn) {
    console.error('Close button not found.');
}

licenseLink.addEventListener('click', () => {
    console.log('Opening modal');
    licenseModal.showModal();
});

closeBtn.addEventListener('click', () => {
    console.log('Closing modal');
    licenseModal.close();
});

licenseModal.addEventListener('click', (event) => {
    if (event.target === licenseModal) {
        console.log('Closing modal');
        licenseModal.close();
    }
});