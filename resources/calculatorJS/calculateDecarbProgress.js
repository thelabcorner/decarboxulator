// Define global variables
let chartData = [];
let chart;
let bar; // Initialize the progress bar

document.addEventListener('DOMContentLoaded', function () {
    const ctx = document.getElementById('chartContainer').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'THCa Remaining',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
                yAxisID: 'y'
            }, {
                label: 'Decarboxylated THC',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1,
                yAxisID: 'y1'
            }, {
                label: 'Percent Decarboxylated',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1,
                yAxisID: 'y2'
            }]
        },
        options: {
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        stepSize: 10,
                        displayFormats: {
                            minute: 'hh:mm a'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Weight (grams)'
                    }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    display: false,
                    title: {
                        display: false,
                        text: 'Weight (grams)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                },
                y2: {
                    type: 'linear',
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Percent Decarboxylated (%)'
                    },
                    grid: {
                        drawOnChartArea: false
                    },
                    min: 0,
                    max: 100
                }
            },
            plugins: {
                legend: {
                    display: true
                }
            }
        }
    });

    // Load saved session data
    if (checkForSessionCookie()) {
        loadSessionData();
        startTracking();
        updateDecarbProgressBar(getMostRecentDecarbProgressData());
    }

    document.getElementById("startTrackingButton").addEventListener("click", startTracking);
});

let TRACKING = false; // Initialize TRACKING boolean
let stopTrackingButton = null; // Initialize stopTrackingButton

function startTracking() {
    const startTrackingButton = document.getElementById("startTrackingButton");
    const clearSessionButton = document.getElementById("clearSessionButton");
    const tareWeightInput = document.getElementById("tareWeight");
    const thcaStartWeightInput = document.getElementById("thcaStartWeight");

    if (!TRACKING) {
        // If not currently tracking, start tracking
        TRACKING = true;
        document.getElementById("currentWeightDiv").style.display = "block";

        startTrackingButton.innerText = "Add Point";
        startTrackingButton.classList.remove("btn-primary");
        startTrackingButton.classList.add("btn-success");
        startTrackingButton.removeEventListener("click", startTracking);
        startTrackingButton.addEventListener("click", addDataPoint);

        // Disable tareWeight and THCAWeight inputs
        tareWeightInput.disabled = true;
        thcaStartWeightInput.disabled = true;

        // Only create stopTrackingButton if it doesn't exist
        if (!stopTrackingButton) {
            stopTrackingButton = document.createElement("button");
            stopTrackingButton.innerText = "Stop Tracking";
            stopTrackingButton.className = "btn btn-danger ml-2";
            stopTrackingButton.id = "stopTrackingButton";
            startTrackingButton.parentNode.insertBefore(stopTrackingButton, startTrackingButton.nextSibling);

            clearSessionButton.style.display = "inline"; // Hide the clear session button

            stopTrackingButton.addEventListener("click", function() {
                TRACKING = false;
                startTrackingButton.textContent = "Start Tracking";
                startTrackingButton.classList.remove("btn-success");
                startTrackingButton.classList.add("btn-primary");
                startTrackingButton.removeEventListener("click", addDataPoint);
                startTrackingButton.addEventListener("click", startTracking);
                document.getElementById("currentWeightDiv").style.display = "none"; // Hide the current weight input

                // Enable tareWeight and THCAWeight inputs
                tareWeightInput.disabled = false;
                thcaStartWeightInput.disabled = false;

                // Remove the stopTrackingButton from the DOM
                stopTrackingButton.parentNode.removeChild(stopTrackingButton);
                // Set stopTrackingButton to null so it can be recreated if needed
                stopTrackingButton = null;
            });
        }

        document.getElementById("currentWeight").style.display = "block"; // Show the current weight input
    } else {
        // If currently tracking, add data point
        addDataPoint();
    }
}

function addDataPoint() {
    const currentWeight = parseFloat(document.getElementById("currentWeight").value);
    const tareWeight = parseFloat(document.getElementById("tareWeight").value);
    const initialTHCAWeight = parseFloat(document.getElementById("thcaStartWeight").value);
    const otherCannabinoidWeight = parseFloat(document.getElementById("otherCannabinoidWeight").value) || 0;


    if (isNaN(currentWeight) || currentWeight <= 0) {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: 'Invalid Current Total Weight',
            showConfirmButton: false,
            timer: 3000
        });
        return;
    }

    const dataPoint = calculateDecarbProgress();

    updateDecarbProgressBar(dataPoint.decarbCompletion)

    if (dataPoint) {
        const timeStamp = new Date();
        chart.data.datasets[0].data.push({ x: timeStamp, y: dataPoint.remainingTHCAWeight });
        chart.data.datasets[1].data.push({ x: timeStamp, y: dataPoint.convertedTHCWeight });
        chart.data.datasets[2].data.push({ x: timeStamp, y: dataPoint.decarbCompletion });
        chart.update();

        // Save the updated chart data to session storage
        saveSessionData();
    }
}

// Update progress bar
function updateDecarbProgressBar(decarbCompletion) {
    // Ensure decarbCompletion is a number
    if (isNaN(decarbCompletion)) {
        decarbCompletion = 0; // Set a default value
    }

    const progressBar = document.getElementById("decarbProgressBar");
    progressBar.style.width = `${decarbCompletion}%`;
    progressBar.setAttribute("aria-valuenow", decarbCompletion);
    let decarbRounded = decarbCompletion.toFixed(2);
    progressBar.textContent = `${decarbRounded}%`;

    // Change color based on percentage
    if (decarbCompletion > 100 || decarbCompletion < -0.0000000000000000000000001) {
        progressBar.classList.remove("progress-bar-animated");
        progressBar.classList.add("progress-bar-error");
    } else {
        progressBar.classList.remove("progress-bar-error");
        progressBar.classList.add("progress-bar-animated");
    }
}


function calculateDecarbProgress() {
    const THCA_MW = 358.21440943; // g/mol
    const THC_MW = 314.224580195; // g/mol
    const DECARB_CONSTANT = THC_MW / THCA_MW; // Ratio of THC MW to THCA MW

    const initialTHCAWeight = parseFloat(document.getElementById("thcaStartWeight").value);
    const tareWeight = parseFloat(document.getElementById("tareWeight").value);
    const otherCannabinoidWeight = parseFloat(document.getElementById("otherCannabinoidWeight").value) || 0;
    const currentTotalVesselWeight = parseFloat(document.getElementById("currentWeight").value);

    if (isNaN(initialTHCAWeight) || initialTHCAWeight <= 0) {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: 'Invalid THCA Start Weight',
            showConfirmButton: false,
            timer: 3000
        });
        return;
    }

    if (isNaN(tareWeight) || tareWeight <= -0.00000001) {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: 'Invalid Tare Weight',
            showConfirmButton: false,
            timer: 3000
        });
        return;
    }

    if (isNaN(currentTotalVesselWeight) || currentTotalVesselWeight <= -0.00000001) {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: 'Invalid Current Weight',
            showConfirmButton: false,
            timer: 3000
        });
        return;
    }

    const currentContentWeight = currentTotalVesselWeight - tareWeight;
    const totalInitialWeight = initialTHCAWeight + otherCannabinoidWeight;
    const expectedFinalTHCWeight = initialTHCAWeight * DECARB_CONSTANT;
    const expectedCO2LossWeight = initialTHCAWeight - expectedFinalTHCWeight;
    const weightLossSoFar = initialTHCAWeight - (currentContentWeight - otherCannabinoidWeight);
    const decarbCompletion = (weightLossSoFar / expectedCO2LossWeight) * 100;
    const convertedTHCWeight = (currentContentWeight - otherCannabinoidWeight) * (decarbCompletion / 100);
    const remainingTHCAWeight = (currentContentWeight - otherCannabinoidWeight) - convertedTHCWeight;

    const slurryTHCAPercent = (remainingTHCAWeight / totalInitialWeight) * 100;
    const slurryTHCPercent = (convertedTHCWeight / totalInitialWeight) * 100;
    const otherCannabinoidPercent = (otherCannabinoidWeight / totalInitialWeight) * 100;

    document.getElementById("decarbProgressResult").innerHTML = `
    <b>Input THC-A Weight:</b> ${initialTHCAWeight.toFixed(2)} grams
    <br><b>Fully Decarboxylated Weight:</b> ${expectedFinalTHCWeight.toFixed(2)} grams
    <br><b>Total Expected Weight Loss:</b> ${expectedCO2LossWeight.toFixed(2)} grams
    <hr>
    <b>Current Slurry Weight:</b> ${currentContentWeight.toFixed(2)} grams
    <br><b>Weight Loss Seen:</b> ${weightLossSoFar.toFixed(2)} grams (${(100 - ((weightLossSoFar / initialTHCAWeight) * 100)).toFixed(3)}% loss ratio)
    <br><b>Percent Decarboxylated:</b> ${decarbCompletion.toFixed(2)}% / 100%
    <br><b>Slurry THC-A Weight:</b> ${remainingTHCAWeight.toFixed(2)} grams (${slurryTHCAPercent.toFixed(2)}%)
    <br><b>Slurry THC Weight:</b> ${convertedTHCWeight.toFixed(2)} grams (${slurryTHCPercent.toFixed(2)}%)
    <br><b>Other Cannabinoid Weight:</b> ${otherCannabinoidWeight.toFixed(2)} grams (${otherCannabinoidPercent.toFixed(2)}%)
  `;

    return {
        initialTHCAWeight,
        expectedFinalTHCWeight,
        currentContentWeight,
        weightLossSoFar,
        expectedCO2LossWeight,
        decarbCompletion,
        remainingTHCAWeight,
        convertedTHCWeight,
        slurryTHCAPercent,
        slurryTHCPercent,
        otherCannabinoidPercent
    };
}

function toggleLabTestMode() {
    const labTestModeCheckbox = document.getElementById('labTestMode');
    const otherCannabinoidDiv = document.getElementById('otherCannabinoidWeightDiv');
    const isolateModeSpan = document.getElementById('isolateModeSpan');

    if (labTestModeCheckbox.checked) {
        otherCannabinoidDiv.style.display = 'block';
        isolateModeSpan.innerText = 'Lab Test Mode: ON - Enter Other Cannabinoid Weights Above';
    } else {
        otherCannabinoidDiv.style.display = 'none';
        isolateModeSpan.innerText = 'Isolate Mode: ON - Assuming No Other Cannabinoids in Solution';
    }
}

// Function to save the session data
function saveSessionData() {
    const sessionData = {
        chartData: chart.data.datasets.map(dataset => dataset.data),
        tareWeight: document.getElementById("tareWeight").value,
        thcaStartWeight: document.getElementById("thcaStartWeight").value,
        otherCannabinoidWeight: document.getElementById("otherCannabinoidWeight").value
    };
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30); // Set the expiration date to 30 days from now
    const cookie = `sessionData=${encodeURIComponent(JSON.stringify(sessionData))};expires=${expirationDate.toUTCString()};path=/`;
    document.cookie = cookie;
}

// Function to clear the session data
function clearSessionData() {
    document.cookie = "sessionData=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
    chart.data.datasets[0].data = [];
    chart.data.datasets[1].data = [];
    chart.data.datasets[2].data = [];
    chart.update();
    document.getElementById("tareWeight").value = '';
    document.getElementById("thcaStartWeight").value = '';
    document.getElementById("otherCannabinoidWeight").value = '';
}

// Function to load the session data
function loadSessionData() {
    const cookies = document.cookie.split(';');
    let sessionData = null;
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.startsWith('sessionData=')) {
            sessionData = JSON.parse(decodeURIComponent(cookie.substring('sessionData='.length)));
            break;
        }
    }
    if (sessionData) {
        chart.data.datasets[0].data = sessionData.chartData[0] || [];
        chart.data.datasets[1].data = sessionData.chartData[1] || [];
        chart.data.datasets[2].data = sessionData.chartData[2] || [];
        chart.update();
        document.getElementById("tareWeight").value = sessionData.tareWeight || '';
        document.getElementById("thcaStartWeight").value = sessionData.thcaStartWeight || '';
        document.getElementById("otherCannabinoidWeight").value = sessionData.otherCannabinoidWeight || '';
    }
}

// Function to grab the most recent decarb progress datapoint from the sessionData
function getMostRecentDecarbProgressData() {
    const cookies = document.cookie.split(';');
    let sessionData = null;
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.startsWith('sessionData=')) {
            sessionData = JSON.parse(decodeURIComponent(cookie.substring('sessionData='.length)));
            break;
        }
    }
    if (sessionData) {
        const mostRecentProgress = sessionData.chartData[2][sessionData.chartData[2].length - 1];
        console.log("Most Recent Progress Point" );
        console.log(mostRecentProgress);
        return mostRecentProgress.y; // Return only the y value
    }
    return null;
}

// Boolean function to detect if there is a session cookie available
function checkForSessionCookie() {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
        if (cookies[i].trim().startsWith('sessionData=')) {
            return true;
        }
    }
    return false;
}
