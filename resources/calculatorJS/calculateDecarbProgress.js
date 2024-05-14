// Define global variables
let chartData = [];
let chart;

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
                    title: {
                        display: true,
                        text: 'Weight (grams)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: true
                }
            }
        }
    });
    document.getElementById("startTrackingButton").addEventListener("click", startTracking);
});



let TRACKING = false; // Initialize TRACKING boolean
let stopTrackingButton = null; // Initialize stopTrackingButton

function startTracking() {
    const startTrackingButton = document.getElementById("startTrackingButton");

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
    const dataPoint = calculateDecarbProgress(currentWeight);
    if (dataPoint) {
        chart.data.datasets[0].data.push({ x: new Date(), y: dataPoint.thcaRemaining });
        chart.data.datasets[1].data.push({ x: new Date(), y: dataPoint.decarboxylatedWeight });
        chart.update();
    }
}



function calculateDecarbProgress() {
    // Constants: Molecular weights of tetrahydrocannabinolic acid (THCA) and delta-9-tetrahydrocannabinol (THC)
    const THCA_MW = 358.21440943; // g/mol
    const THC_MW = 314.224580195; // g/mol
    const CO2_MW = 44.0095; // g/mol for CO2

    const DECARB_CONSTANT = 0.8771969298917993; // Ratio of THC MW to THCA MW

    // Input retrieval with validation
    const initialTHCAWeight = parseFloat(document.getElementById("thcaStartWeight").value); // Initial mass of THCA
    const tareWeight = parseFloat(document.getElementById("tareWeight").value); // Mass of the container
    const otherCannabinoidWeight = parseFloat(document.getElementById("otherCannabinoidWeight").value) || 0; // Mass of other cannabinoids

    const currentTotalVesselWeight = parseFloat(document.getElementById("currentWeight").value); // Current total mass in container

    const inputTotalVesselWeight = tareWeight + otherCannabinoidWeight + initialTHCAWeight; // Total weight of the vessel

    if (isNaN(initialTHCAWeight) || isNaN(tareWeight) || isNaN(currentTotalVesselWeight)) {
        document.getElementById("decarbProgressResult").innerHTML = "Invalid input. Please enter valid weights.";
        return;
    }

    const currentContentWeight = currentTotalVesselWeight - tareWeight - otherCannabinoidWeight; // Current mass of content in the container

    const expectedFinalTHCWeight = initialTHCAWeight * DECARB_CONSTANT; // Expected final mass of THC after decarboxylation
    const expectedCO2LossWeight = initialTHCAWeight - expectedFinalTHCWeight; // Expected mass of CO2 produced during decarboxylation

    // Decarboxylation progress calculations
    const weightLossSoFar = initialTHCAWeight - currentContentWeight;
    const decarbCompletion = (weightLossSoFar / expectedCO2LossWeight) * 100;

    // Display calculated values
    document.getElementById("decarbProgressResult").innerHTML = `
        <b>Initial Weight (Carboxylated):</b> ${initialTHCAWeight.toFixed(2)} grams
        <br><b>Expected Final Weight (Decarboxylated):</b> ${expectedFinalTHCWeight.toFixed(2)} grams
        <br><b>Current Content Weight:</b> ${currentContentWeight.toFixed(2)} grams
        <br><b>Weight Loss So Far:</b> ${weightLossSoFar.toFixed(2)} grams
        <br><b>Total Expected Weight Loss:</b> ${expectedCO2LossWeight.toFixed(2)} grams
        <br><b>Decarboxylation Completion:</b> ${decarbCompletion.toFixed(2)}%
    `;

    // Return structured data for potential further processing
    return {
        initialTHCAWeight,
        expectedFinalTHCWeight,
        currentContentWeight,
        weightLossSoFar,
        expectedCO2LossWeight,
        decarbCompletion
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



// Function to save the session
function saveSession() {
    // Implement the logic to save the session data to cookie so when user refreshes the page, the data is still there
}