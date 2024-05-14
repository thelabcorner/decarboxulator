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
    const THCA_MW = 358.21440943; // g/mol
    const THC_MW = 314.224580195; // g/mol
    const DECARB_CONSTANT = THC_MW / THCA_MW; // Ratio of THC MW to THCA MW

    const initialTHCAWeight = parseFloat(document.getElementById("thcaStartWeight").value);
    const tareWeight = parseFloat(document.getElementById("tareWeight").value);
    const otherCannabinoidWeight = parseFloat(document.getElementById("otherCannabinoidWeight").value) || 0;
    const currentTotalVesselWeight = parseFloat(document.getElementById("currentWeight").value);

    if (isNaN(initialTHCAWeight) || isNaN(tareWeight) || isNaN(currentTotalVesselWeight)) {
        document.getElementById("decarbProgressResult").innerHTML = "Invalid input. Please enter valid weights.";
        return;
    }

    const currentContentWeight = currentTotalVesselWeight - tareWeight - otherCannabinoidWeight;
    const expectedFinalTHCWeight = initialTHCAWeight * DECARB_CONSTANT;
    const expectedCO2LossWeight = initialTHCAWeight - expectedFinalTHCWeight;
    const weightLossSoFar = initialTHCAWeight - currentContentWeight;
    const decarbCompletion = (weightLossSoFar / expectedCO2LossWeight) * 100;

    const convertedTHCWeight = currentContentWeight * (decarbCompletion / 100);
    const remainingTHCAWeight = currentContentWeight - convertedTHCWeight;

    document.getElementById("decarbProgressResult").innerHTML =
        `<b>Input THC-A Weight:</b> ${initialTHCAWeight.toFixed(2)} grams 
            <br><b>Fully Decarboxylated Weight:</b> ${expectedFinalTHCWeight.toFixed(2)} grams 
            <br><b>Total Expected Weight Loss:</b> ${expectedCO2LossWeight.toFixed(2)} grams 
            <hr>
            <b>Current Slurry Weight:</b> ${currentContentWeight.toFixed(2)} grams 
            <br><b>Weight Loss Seen:</b> ${weightLossSoFar.toFixed(2)} grams (${(100 - ((weightLossSoFar / initialTHCAWeight) * 100)).toFixed(3)}% loss ratio)
            <br><b>Percent Decarboxylated:</b> ${decarbCompletion.toFixed(2)}% / 100% 
            <br><b>Slurry THC-A Weight:</b> ${remainingTHCAWeight.toFixed(2)} grams (${((remainingTHCAWeight / currentContentWeight) * 100).toFixed(2)}%)
            <br><b>Slurry THC Weight:</b> ${convertedTHCWeight.toFixed(2)} grams (${((convertedTHCWeight / currentContentWeight) * 100).toFixed(2)}%)
        `;

    return {
        initialTHCAWeight,
        expectedFinalTHCWeight,
        currentContentWeight,
        weightLossSoFar,
        expectedCO2LossWeight,
        decarbCompletion,
        remainingTHCAWeight,
        convertedTHCWeight
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