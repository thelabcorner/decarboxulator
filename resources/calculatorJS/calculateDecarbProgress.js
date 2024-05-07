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

function startTracking() {
    const startTrackingButton = document.getElementById("startTrackingButton");
    startTrackingButton.innerText = "Add Point";
    startTrackingButton.classList.remove("btn-primary");
    startTrackingButton.classList.add("btn-success");
    startTrackingButton.removeEventListener("click", startTracking);
    startTrackingButton.addEventListener("click", addDataPoint);

    const stopTrackingButton = document.createElement("button");
    stopTrackingButton.innerText = "Stop Tracking";
    stopTrackingButton.className = "btn btn-danger ml-2";
    stopTrackingButton.id = "stopTrackingButton";
    startTrackingButton.parentNode.insertBefore(stopTrackingButton, startTrackingButton.nextSibling);

    stopTrackingButton.addEventListener("click", function() {
        startTrackingButton.textContent = "Start Tracking";
        startTrackingButton.classList.remove("btn-success");
        startTrackingButton.classList.add("btn-primary");
        startTrackingButton.removeEventListener("click", addDataPoint);
        startTrackingButton.addEventListener("click", startTracking);
        this.remove();
        document.getElementById("currentWeight").style.display = "none"; // Hide the current weight input
    });

    document.getElementById("currentWeight").style.display = "block"; // Show the current weight input
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
    // Constants
    const THCA_MW = 358.21440943; // Molecular weight of THCA
    const THC_MW = 314.224580195; // Molecular weight of THC

    // Input values
    const inputWeight = parseFloat(document.getElementById("thcaStartWeight").value); // Initial weight of THCA
    const tareWeight = parseFloat(document.getElementById("tareWeight").value); // Tare weight of the container
    const otherCannabinoidWeight = parseFloat(document.getElementById("otherCannabinoidWeight").value) || 0; // Weight of other cannabinoids
    const currentWeight = parseFloat(document.getElementById("currentWeight").value); // Current weight after some decarboxylation

    // Adjust current weight by subtracting tare and other cannabinoid weights
    const adjustedCurrentWeight = currentWeight - tareWeight - otherCannabinoidWeight;

    // Theoretical maximum weight of THC from given THCA
    const expectedTHCWeight = inputWeight * (THC_MW / THCA_MW);

    // Weight of THCA that has been decarboxylated
    const decarbedWeight = inputWeight - adjustedCurrentWeight;

    // Remaining weight after accounting for theoretical THC conversion
    const weightLeft = adjustedCurrentWeight - expectedTHCWeight;

    // Percentage of decarboxylation completion
    const percentDecarbed = (decarbedWeight / inputWeight) * 100;

    // Display results
    document.getElementById("decarbProgressResult").innerHTML = `
    <b>Expected THC Weight:</b> ${expectedTHCWeight.toFixed(2)} grams
    <br><b>Decarboxylated Weight:</b> ${decarbedWeight.toFixed(2)} grams
    <br><b>Weight Left:</b> ${weightLeft.toFixed(2)} grams
    <br><b>Decarboxylation Percent:</b> ${percentDecarbed.toFixed(2)}%
  `;

    // Return object with calculated values
    return {
        expectedTHCWeight,
        decarbedWeight,
        weightLeft,
        percentDecarbed
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
    // Implement the logic to save the session data
    console.log("Save session functionality is not implemented yet.");
}