/**
 * Open-Natural License
 *
 * Copyright (C) 2020-2024 Jackson Cummings - TheDabCorner™ LLC.
 *
 *     Preamble
 * This license recognizes that mathematics and logic, as fundamental
 * components of nature, are beyond exclusive ownership. The software
 * covered by this license is a creative and intuitive expression by
 * the author, Jackson Cummings, implementing principles of
 * stoichiometry, mathematics, and logical reasoning. This document
 * establishes the terms under which this software may be used, copied,
 *     and distributed.
 *
 *     Grant of License
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal with the Software without restriction,
 *     including without limitation the rights to use, copy, modify, merge,
 *     publish, distribute, sublicense, and/or sell copies of the Software,
 *     all subject to the following conditions:
 *
 *     I. Non-Commercial Use:
 *     A. The above copyright notice and this permission notice must be
 * included in all copies or substantial portions of the Software.
 *     B. If the Software is redistributed in a non-commercial context,
 *     the phrase "Powered by Decarboxulator™" must be prominently
 * displayed in the product or service.
 *
 *     II. Commercial Use:
 *     A. Open Source Option:
 *     1. If the Software is used in a commercial product or service,
 *     the complete source code of that product or service must be made
 * available to the public under this license or another permissive
 * open source license approved by the Open Source Initiative (OSI).
 * 2. A notation "Powered by Decarboxulator™" must be prominently
 * displayed in the product or service.
 *
 *     B. Commercial License Option:
 *     1. Use of the Software in commercial products or services without
 * disclosure of source code requires a commercial license obtained
 * from the Licensor.
 * 2. Contact the Licensor at admin@thedabcorner.site for licensing
 *     options and fees.
 * 3. Redistribution of the Software, or any derivative works, in
 * source or binary form, requires prior written consent from the
 * Licensor.
 * 4. A notation "Powered by Decarboxulator™" must be prominently
 * displayed in the product or service.
 *
 *     III. Research and Academic Use:
 *     A. The Software may be used for research and academic purposes
 * without obtaining a commercial license, provided that:
 *     1. The above copyright notice and this permission notice are
 * included in all copies or substantial portions of the Software.
 * 2. Proper attribution is given to the authors and the Software
 * in any publications or presentations resulting from the use of
 * the Software.
 *
 *     Warranty Disclaimer
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 *     EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
 * BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN
 * ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 *     Trademark Notice
 * This license does not grant any rights in the trademarks, service
 * marks, brand names, or logos of TheDabCorner™ LLC or Decarboxulator™.
 *
 * Termination
 * This license is subject to termination if its terms are violated.
 *     Upon termination, all rights granted under this license will cease
 * immediately without notice from the Licensor. Following termination,
 * re-acquisition of licensing rights requires express written consent
 * from the Licensor. The Licensor reserves the right to modify or
 * revoke the licenses of any third parties who have received copies or
 * derivative works of the Software from you, to protect the Licensor's
 * interests.
 */



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
                        tooltipFormat: 'M/d/yyyy | hh:mm:ss.SSS a',
                        unit: 'minute',
                        stepSize: 1,
                        minUnit: 'minute',  // Minimum unit of time
                        displayFormats: {
                            minute: 'hh:mm a',
                            hour: 'MMM D, hA', // Format for hours
                            day: 'MMM D',     // Format for days
                            week: 'MMM D'     // Format for weeks
                        }
                    },
                    title: {
                        display: true,
                        text: 'Time'
                    },
                    ticks: {
                        source: 'auto', // Use 'auto' to determine intervals based on data and scale size
                        autoSkip: true,
                        maxTicksLimit: 20 // Adjust to control the maximum number of ticks displayed
                    }
                },
                y: {
                    type: 'linear',
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Weight (grams)'
                    },
                    suggestedMin: 0,
                    suggestedMax: 100
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    display: false,
                    suggestedMin: 0,
                    suggestedMax: 100,
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
    if (checkForSessionData()) {
        loadSessionData();

        startTracking(firstPoint = false);
        updateDecarbProgressBar(getMostRecentDecarbProgressData());
    }
});



let TRACKING = false; // Initialize TRACKING boolean
let stopTrackingButton = null; // Initialize stopTrackingButton


function startTracking(firstPoint) {
    const startTrackingButton = document.getElementById("startTrackingButton");
    const clearSessionButton = document.getElementById("clearSessionButton");
    const exportDataButton = document.getElementById("exportDataButton");
    const tareWeightInput = document.getElementById("tareWeight");
    const thcaStartWeightInput = document.getElementById("thcaStartWeight");

    if (!TRACKING) {

        if (thcaStartWeightInput.value.trim() === '') {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'error',
                title: 'THCA Start Weight Required',
                showConfirmButton: false,
                timer: 3000
            });
            return;
        }

        TRACKING = true;
        document.getElementById("currentWeightDiv").style.display = "block";
        startTrackingButton.innerText = "Add Point";
        startTrackingButton.classList.remove("btn-primary");
        startTrackingButton.classList.add("btn-success");

        // Ensure event listener is properly managed
        startTrackingButton.removeEventListener("click", startTracking);

        tareWeightInput.disabled = true;
        thcaStartWeightInput.disabled = true;

        if (firstPoint) {
            addDataPoint(true); // Add the initial data point
        }

        if (!stopTrackingButton) {
            stopTrackingButton = document.createElement("button");
            stopTrackingButton.innerText = "Stop Tracking";
            stopTrackingButton.className = "btn btn-danger ml-2";
            stopTrackingButton.id = "stopTrackingButton";
            startTrackingButton.parentNode.insertBefore(stopTrackingButton, startTrackingButton.nextSibling);

            clearSessionButton.style.display = "inline";
            exportDataButton.style.display = "inline";

            stopTrackingButton.addEventListener("click", function (event) {
                event.preventDefault();
                stopTrackingPopup().then((confirmed) => {
                    if (confirmed) {
                        stopTracking();
                    }
                });
            });
        }
    } else {
        addDataPoint();
    }
}


function stopTracking() {
    const startTrackingButton = document.getElementById("startTrackingButton");
    const clearSessionButton = document.getElementById("clearSessionButton");
    const exportDataButton = document.getElementById("exportDataButton");
    const tareWeightInput = document.getElementById("tareWeight");
    const thcaStartWeightInput = document.getElementById("thcaStartWeight");

    // If user confirms, proceed to stop tracking
    TRACKING = false;

    // Update the startTrackingButton to reflect its new state
    startTrackingButton.textContent = "Start Tracking";
    startTrackingButton.classList.replace("btn-success", "btn-primary");

    // Switch the event listeners from stop to start tracking
    startTrackingButton.removeEventListener("click", addDataPoint);
    startTrackingButton.addEventListener("click", startTracking);

    // Hide the current weight input element
    document.getElementById("currentWeightDiv").style.display = "none";

    // Enable inputs for tare and initial THCA weight
    tareWeightInput.disabled = false;
    thcaStartWeightInput.disabled = false;

    clearSessionButton.style.display = "none"; // Hide the clear session button
    exportDataButton.style.display = "none"; // Hide the export session button

    // Remove the stopTrackingButton from the DOM and clear its variable
    stopTrackingButton.parentNode.removeChild(stopTrackingButton);
    stopTrackingButton = null;
}



function addDataPoint(firstPoint = false) {
    let currentWeight;
    let tareWeight;
    const initialTHCAWeight = parseFloat(document.getElementById("thcaStartWeight").value);
    const otherCannabinoidWeightInput = document.getElementById("otherCannabinoidWeight");
    let otherCannabinoidWeight = 0;

    if (otherCannabinoidWeightInput.value.trim() !== '') {
        otherCannabinoidWeight = parseFloat(otherCannabinoidWeightInput.value);
    }

    tareWeight = parseFloat(document.getElementById("tareWeight").value) || 0;

    if (firstPoint) {
        currentWeight = math.add(math.add(initialTHCAWeight, tareWeight), otherCannabinoidWeight);
    } else {
        currentWeight = parseFloat(document.getElementById("currentWeight").value);
    }

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

    const dataPoint = calculateDecarbProgress(currentWeight);
    if (dataPoint) {
        const chartTimeStamp = new Date(dataPoint.timestamp);

        // Check for duplicate entries based on precise timestamp (millisecond precision)
        if (!isDuplicate(chartTimeStamp)) {
            updateDecarbProgressBar(dataPoint.decarbCompletion);
            chart.data.datasets[0].data.push({ x: chartTimeStamp.toISOString(), y: dataPoint.remainingTHCAWeight });
            chart.data.datasets[1].data.push({ x: chartTimeStamp.toISOString(), y: dataPoint.convertedTHCWeight });
            chart.data.datasets[2].data.push({ x: chartTimeStamp.toISOString(), y: dataPoint.decarbCompletion });
            chart.update();
            saveSessionData(dataPoint.timestamp, dataPoint);
        }
    }
}

function isDuplicate(timestamp) {
    const timestampMilliseconds = timestamp.getTime();
    return chart.data.datasets.some(dataset => {
        return dataset.data.some(point => {
            const existingTimeStampMilliseconds = new Date(point.x).getTime();
            return existingTimeStampMilliseconds === timestampMilliseconds;
        });
    });
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
    if (decarbCompletion === 69 || decarbCompletion === 69.69) {
        progressBar.style.backgroundColor = '#c156ff';
        progressBar.textContent = `${decarbRounded}% - 🅽🅸🅲🅴!`;
    } else {
        progressBar.style.backgroundColor = ''; // Reset to default
    }

    // Handle error class for invalid percentages
    if (decarbCompletion > 100 || decarbCompletion < -0.0000000000000000000000001) {
        progressBar.classList.remove("progress-bar-animated");
        progressBar.classList.add("progress-bar-error");
    } else {
        progressBar.classList.remove("progress-bar-error");
        progressBar.classList.add("progress-bar-animated");
    }
}



function calculateDecarbProgress(currentWeight) {
    const THCA_MW = math.bignumber(358.21440943); // g/mol
    const THC_MW = math.bignumber(314.224580195); // g/mol
    const DECARB_CONSTANT = THC_MW.div(THCA_MW); // Ratio of THC MW to THCA MW

    const initialTHCAWeight = math.bignumber(document.getElementById("thcaStartWeight").value);
    const tareWeightInputValue = document.getElementById("tareWeight").value;
    const tareWeight = math.bignumber(tareWeightInputValue || 0);

    const otherCannabinoidWeightInput = document.getElementById("otherCannabinoidWeight");
    let otherCannabinoidWeight = math.bignumber(0);

    if (otherCannabinoidWeightInput.value.trim() !== '' && !isNaN(otherCannabinoidWeightInput.value)) {
        otherCannabinoidWeight = math.bignumber(otherCannabinoidWeightInput.value);
    }

    const currentTotalVesselWeight = math.bignumber(currentWeight);

    if (initialTHCAWeight.isNaN() || initialTHCAWeight.lte(0)) {
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

    if (tareWeight.isNaN() || tareWeight.lt(-0.00000001)) {
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

    if (currentTotalVesselWeight.isNaN() || currentTotalVesselWeight.lt(-0.00000001)) {
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

    const timestamp = new Date().getTime();

    const currentContentWeight = currentTotalVesselWeight.minus(tareWeight);
    const totalInitialWeight = initialTHCAWeight.plus(otherCannabinoidWeight);
    const expectedFinalTHCWeight = initialTHCAWeight.mul(DECARB_CONSTANT);
    const expectedCO2LossWeight = initialTHCAWeight.minus(expectedFinalTHCWeight);
    const expectedFinalContentWeight = totalInitialWeight.minus(expectedCO2LossWeight);
    const expectedFinalVesselWeight = expectedFinalContentWeight.plus(tareWeight);

    let startTime;
    if (chart && chart.data && chart.data.datasets[0] && chart.data.datasets[0].data[0]) {
        startTime = new Date(chart.data.datasets[0].data[0].x);
    } else {
        startTime = new Date(timestamp);
    }

    const elapsedTime = new Date() - startTime;



    const weightLossSoFar = initialTHCAWeight.minus(currentContentWeight.minus(otherCannabinoidWeight));
    const decarbCompletion = weightLossSoFar.div(expectedCO2LossWeight).mul(100);
    const convertedTHCWeight = currentContentWeight.minus(otherCannabinoidWeight).mul(decarbCompletion.div(100));
    const remainingTHCAWeight = currentContentWeight.minus(otherCannabinoidWeight).minus(convertedTHCWeight);

    // Calculate the decarboxylation rate based on the current weight loss with dynamic units
    const { rate, unit } = calculateDecarbRate(convertedTHCWeight, elapsedTime);

    // Calculating percentages based on the current slurry weight
    const slurryTHCAPercent = remainingTHCAWeight.div(currentContentWeight).mul(100);
    const slurryTHCPercent = convertedTHCWeight.div(currentContentWeight).mul(100);
    const otherCannabinoidPercent = otherCannabinoidWeight.div(currentContentWeight).mul(100);

    let date = new Date(timestamp);
    let timeString = date.toLocaleTimeString();
    let milliseconds = date.getMilliseconds();

// Pad milliseconds with leading zeros if necessary
    milliseconds = ("00" + milliseconds).slice(-3);

// Use a regular expression to insert milliseconds after seconds and before AM/PM
    let modifiedTimeString = timeString.replace(/(\d+:\d+:\d+)(\s)(AM|PM)/, `$1.${milliseconds} $3`);

    document.getElementById("decarbProgressResult").innerHTML = ` 
      <b>Start Time:</b> ${startTime.toLocaleString()}
      <br><b>Current Timestamp:</b> ${date.toLocaleDateString()} | ${modifiedTimeString}
      <br><b>Elapsed Time:</b> ${formatTime(elapsedTime)}
      <br><b>Decarboxylation Rate:</b> ${rate.toFixed(2)} ${unit} <i>[work in progress]</i>
      <hr>
      <b>Input THC-A Weight:</b> ${initialTHCAWeight.toFixed(2)} grams
      <br><b>Fully Decarboxylated THCa Weight:</b> ${expectedFinalTHCWeight.toFixed(2)} grams
      <br><b>Total Expected Weight Loss:</b> ${expectedCO2LossWeight.toFixed(2)} grams
      <br><b>Expected Final Content Weight:</b> ${expectedFinalContentWeight.toFixed(2)} grams
      ${tareWeight.toNumber() !== 0 ? `<br><b>Expected Final Vessel Weight:</b> ${expectedFinalVesselWeight.toFixed(2)} grams` : ''}
      <hr>
      <b>Current Slurry Weight:</b> ${currentContentWeight.toFixed(2)} grams
      <br><b>Weight Loss Seen:</b> ${weightLossSoFar.toFixed(2)} grams (${math.round((100 - ((weightLossSoFar.div(initialTHCAWeight)).mul(100))), 3)}% loss ratio)
      <br><b>Percent Decarboxylated:</b> ${decarbCompletion.toFixed(2)}% / 100%
      <br><b>Slurry THC-A Weight:</b> ${remainingTHCAWeight.toFixed(2)} grams (${slurryTHCAPercent.toFixed(2)}%)
      <br><b>Slurry THC Weight:</b> ${convertedTHCWeight.toFixed(2)} grams (${slurryTHCPercent.toFixed(2)}%)
      <br><b>Other Cannabinoid Weight:</b> ${otherCannabinoidWeight.toFixed(2)} grams (${otherCannabinoidPercent.toFixed(2)}%)
    `;

    return {
        timestamp: timestamp,
        initialTHCAWeight: initialTHCAWeight.toNumber(),
        expectedFinalTHCWeight: expectedFinalTHCWeight.toNumber(),
        currentContentWeight: currentContentWeight.toNumber(),
        weightLossSoFar: weightLossSoFar.toNumber(),
        expectedCO2LossWeight: expectedCO2LossWeight.toNumber(),
        decarbCompletion: decarbCompletion.toNumber(),
        remainingTHCAWeight: remainingTHCAWeight.toNumber(),
        convertedTHCWeight: convertedTHCWeight.toNumber(),
        slurryTHCAPercent: slurryTHCAPercent.toNumber(),
        slurryTHCPercent: slurryTHCPercent.toNumber(),
        otherCannabinoidPercent: otherCannabinoidPercent.toNumber(),
        elapsedTime: elapsedTime,
        decarbRate: rate + ' ' + unit,
    };
}





function calculateDecarbRate(convertedTHCWeight, elapsedTime) {
    // Determine weight unit and adjust values if necessary
    let weightUnit = 'g';
    if (convertedTHCWeight < 1) {
        convertedTHCWeight *= 1000;  // Convert grams to milligrams
        weightUnit = 'mg';
    }

    // Calculate rates per second
    const ratesPerSecond = convertedTHCWeight / elapsedTime;

    // Define time units and conversion factors
    const timeUnits = [
        { divisor: 1, unit: 's' },
        { divisor: 30, unit: '30s' },
        { divisor: 60, unit: 'min' },
        { divisor: 300, unit: '5min' },
        { divisor: 1800, unit: '30min' },
        { divisor: 3600, unit: 'hr' }
    ];

    // Initialize chosen rate and unit with values most likely to be changed
    let chosenRate = ratesPerSecond;
    let chosenUnit = weightUnit + '/s';
    let minDifference = Number.MAX_VALUE;

    // Calculate the most appropriate rate and unit
    for (let i = 0; i < timeUnits.length; i++) {
        const rate = ratesPerSecond * timeUnits[i].divisor;
        const rateRounded = Math.round(rate * 1000) / 1000;  // Round to 3 decimal places

        // Choose the unit that gives a number close to 1 or a whole number
        const difference = Math.abs(1 - rateRounded);
        if (difference < minDifference && rateRounded >= 0.001) {
            minDifference = difference;
            chosenRate = rateRounded;
            chosenUnit = weightUnit + '/' + timeUnits[i].unit;

            // Break early if it's a perfect fit
            if (difference === 0) break;
        }
    }

    // Log the chosen rate and unit
    console.log(`Decarboxylation rate (THC production): ${chosenRate} ${chosenUnit}`);
    return { rate: chosenRate, unit: chosenUnit };
}





function toggleLabTestMode() {
    console.log("Toggling Lab Test Mode")

    const labTestModeCheckbox = document.getElementById('labTestMode');
    const otherCannabinoidDiv = document.getElementById('otherCannabinoidWeightDiv');
    const otherCannabinoidInput = document.getElementById('otherCannabinoidWeight');
    const isolateModeSpan = document.getElementById('isolateModeSpan');

    if (labTestModeCheckbox.checked) {
        otherCannabinoidDiv.style.display = 'block';
        isolateModeSpan.innerText = 'Lab Test Mode: ON - Enter Other Cannabinoid Weights Above';
    } else {
        otherCannabinoidDiv.style.display = 'none';
        otherCannabinoidInput.value = 0;
        isolateModeSpan.innerText = 'Isolate Mode: ON - Assuming No Other Cannabinoids in Solution';
    }
}


//////////////////////
// SAVE FUNCTIONS   //
//////////////////////

function saveSessionData(timeStamp, dataPoint) {
    let sessionData = localStorage.getItem('sessionData');
    sessionData = sessionData ? pako.inflate(sessionData, { to: 'string' }) : null;
    sessionData = sessionData ? JSON.parse(sessionData) : null;

    if (!sessionData) {
        sessionData = {
            chartData: chart.data.datasets.map(dataset => dataset.data),
            tareWeight: document.getElementById("tareWeight").value,
            thcaStartWeight: document.getElementById("thcaStartWeight").value,
            otherCannabinoidWeight: document.getElementById("otherCannabinoidWeight").value,
            dataPoints: {}
        };
    }

    // Generate a composite key
    const compositeKey = timeStamp + "_" + dataPoint.currentContentWeight;

    // Update or add new data point
    sessionData.dataPoints[compositeKey] = {
        timeStamp: timeStamp,
        elapsedTime: dataPoint.elapsedTime,
        decarbRate: dataPoint.decarbRate,

        currentContentWeight: dataPoint.currentContentWeight,
        weightLossSoFar: dataPoint.weightLossSoFar,
        expectedCO2LossWeight: dataPoint.expectedCO2LossWeight,
        expectedFinalTHCWeight: dataPoint.expectedFinalTHCWeight,
        slurryTHCAPercent: dataPoint.slurryTHCAPercent,
        slurryTHCPercent: dataPoint.slurryTHCPercent,
        otherCannabinoidPercent: dataPoint.otherCannabinoidPercent
    };

    // Update chartData
    sessionData.chartData = chart.data.datasets.map(dataset => dataset.data);

    console.log(sessionData)

    const sessionDataString = JSON.stringify(sessionData);
    // Compress and save the sessionData
    const compressedData = pako.deflate(sessionDataString, { to: 'string' });
    localStorage.setItem('sessionData', compressedData);
}



// Function to clear the session data
function clearSessionData() {
    localStorage.removeItem('sessionData');
    chart.data.datasets[0].data = [];
    chart.data.datasets[1].data = [];
    chart.data.datasets[2].data = [];
    chart.update();
    document.getElementById("tareWeight").value = '';
    document.getElementById("thcaStartWeight").value = '';
    document.getElementById("otherCannabinoidWeight").value = '';
    document.getElementById("currentWeight").value = '';

    // Reset the progress bar
    updateDecarbProgressBar(0);

    // Stop tracking if it is currently active
    if (TRACKING) {
        stopTracking();
    }
}

//////////////////////
// LOAD FUNCTIONS //
//////////////////////


// Function to load the session data
function loadSessionData() {
    let compressedData = localStorage.getItem('sessionData');
    let sessionData = compressedData ? pako.inflate(compressedData, { to: 'string' }) : null;
    sessionData = sessionData ? JSON.parse(sessionData) : null;

    if (sessionData) {
        chart.data.datasets[0].data = sessionData.chartData[0] || [];
        chart.data.datasets[1].data = sessionData.chartData[1] || [];
        chart.data.datasets[2].data = sessionData.chartData[2] || [];
        chart.update();
        document.getElementById("tareWeight").value = sessionData.tareWeight || '';
        document.getElementById("thcaStartWeight").value = sessionData.thcaStartWeight || '';
        document.getElementById("otherCannabinoidWeight").value = sessionData.otherCannabinoidWeight || '';

        if (parseFloat(sessionData.otherCannabinoidWeight) >= 0.01) {
            toggleLabTestMode();
        }
    }
}


// Function to grab the most recent decarb progress datapoint from the sessionData
function getMostRecentDecarbProgressData() {
    let compressedData = localStorage.getItem('sessionData');
    let sessionData = compressedData ? pako.inflate(compressedData, { to: 'string' }) : null;
    sessionData = sessionData ? JSON.parse(sessionData) : null;

    if (sessionData && sessionData.chartData[2].length > 0) {
        const mostRecentProgress = sessionData.chartData[2][sessionData.chartData[2].length - 1];
        console.log("Most Recent Progress Point");
        console.log(mostRecentProgress);
        return mostRecentProgress.y; // Return only the y value
    }
    return null;
}


// Boolean function to detect if there is session data available in local storage
function checkForSessionData() {
    return localStorage.getItem('sessionData') !== null;
}



//////////////////////
// EXPORT FUNCTIONS //
//////////////////////

// Function to export session data based on selected file type
function exportSessionData(filetype) {
    let compressedData = localStorage.getItem('sessionData');
    let sessionData = compressedData ? pako.inflate(compressedData, { to: 'string' }) : null;
    sessionData = sessionData ? JSON.parse(sessionData) : null;

    if (sessionData) {
        let csvData = '';

        // Add heading section
        csvData += `startTimestamp,${new Date(sessionData.chartData[0][0].x).toLocaleString().replace(/,/g, ' |')}\n`;
        csvData += `thcaStartWeight,${sessionData.thcaStartWeight}\n`;
        csvData += `tareWeight,${sessionData.tareWeight}\n`;
        csvData += `otherCannabinoidWeight,${sessionData.otherCannabinoidWeight || 0}\n`;
        csvData += `totalStartWeight,${parseFloat(sessionData.thcaStartWeight) + parseFloat(sessionData.tareWeight || 0) + parseFloat(sessionData.otherCannabinoidWeight || 0)}\n\n`;
        csvData += `expectedCO2LossWeight,${sessionData.dataPoints[Object.keys(sessionData.dataPoints)[0]].expectedCO2LossWeight}\n`;
        csvData += `expectedFinalTHCWeight,${sessionData.dataPoints[Object.keys(sessionData.dataPoints)[0]].expectedFinalTHCWeight}\n`;

        if (parseFloat(sessionData.otherCannabinoidWeight) > 0) {
            csvData += `expectedFinalContentWeight,${parseFloat(sessionData.dataPoints[Object.keys(sessionData.dataPoints)[0]].expectedFinalTHCWeight) + parseFloat(sessionData.otherCannabinoidWeight || 0)}\n`;
        }
        if (parseFloat(sessionData.tareWeight) > 0) {
            csvData += `expectedFinalVesselWeight,${parseFloat(sessionData.dataPoints[Object.keys(sessionData.dataPoints)[0]].expectedFinalTHCWeight) + parseFloat(sessionData.tareWeight || 0) + parseFloat(sessionData.otherCannabinoidWeight || 0)}\n`;
        }
        csvData += '\n';

        // Add column headers
        csvData += 'Timestamp,elapsedTime,decarbRate,currentContentWeight,remainingTHCAWeight,convertedTHCWeight,decarbCompletion,weightLossSoFar,slurryTHCAPercent,slurryTHCPercent,otherCannabinoidPercent\n';

        sessionData.chartData[0].forEach((point, index) => {
            const key = Object.keys(sessionData.dataPoints)[index];
            const dataPoint = sessionData.dataPoints[key];

            if (dataPoint) {
                let chartTimestampMillis = new Date(dataPoint.timeStamp)
                let timeString = chartTimestampMillis.toLocaleString();
                let milliseconds = chartTimestampMillis.getMilliseconds();
                // Pad milliseconds with leading zeros if necessary
                milliseconds = ("00" + milliseconds).slice(-3);
                // Use a regular expression to insert milliseconds after seconds and before AM/PM
                let modifiedTimestampString = timeString.replace(/(\d+:\d+:\d+)(\s)(AM|PM)/, `$1.${milliseconds} $3`).replace(/,/g, ' |');
                csvData += `${modifiedTimestampString},${formatTime(dataPoint.elapsedTime)},${dataPoint.decarbRate},${dataPoint.currentContentWeight},${point.y},${sessionData.chartData[1][index].y},${sessionData.chartData[2][index].y},${dataPoint.weightLossSoFar},${dataPoint.slurryTHCAPercent},${dataPoint.slurryTHCPercent},${dataPoint.otherCannabinoidPercent}\n`;
            }
        });

        // Generate a filename based on the start timestamp
        const filename = `decarb_progress_data_${new Date(sessionData.chartData[0][0].x).toISOString().replace(/:/g, '-')}`;

        // Check file type and handle accordingly
        switch (filetype) {
            case 'CSV':
                appendLicenseToCsv(csvData, filename);
                break;
            case 'PNG':
                exportChartAsImage('image/png', `${filename}_chart.png`);
                break;
            case 'JPEG':
                exportChartAsImage('image/jpeg', `${filename}_chart.jpeg`);
                break;
            case 'ZIP':
                exportAllDataAsZip(csvData);
                break;
        }
    }
}

// @todo: write function to load session data from a CSV file


// Helper function to trigger CSV download
function downloadCsv(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// Helper function to trigger file download
function handleExport(data, filename, type) {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Function to append the license URL to the CSV
function appendLicenseToCsv(csvData, filename) {
    const licenseUrl = 'https://tinyurl.com/DecarboxulatorLICENSE';
    csvData += '\n[READ ME] License & Terms of Use:\n' + licenseUrl;
    downloadCsv(csvData, `${filename}.csv`);
}


// Function to export the chart as an image (PNG or JPEG)
function exportChartAsImage(imageType, filename) {
    const canvas = document.getElementById('chartContainer');
    if (canvas) {
        canvas.toBlob(blob => {
            handleExport(blob, filename, imageType);
        }, imageType);
    }
}

// Function to export all data as a ZIP file containing both CSV and chart image
function exportAllDataAsZip(csvData) {
    const zip = new JSZip();
    zip.file('decarb_progress_data.csv', csvData);

    const canvas = document.getElementById('chartContainer');
    canvas.toBlob(blob => {
        zip.file('decarb_progress_chart.png', blob);
        zip.generateAsync({ type: 'blob' }).then(content => {
            handleExport(content, 'decarb_progress_data.zip', 'application/zip');
        });
    }, 'image/png');
}


// Function to format time from millis in a human-readable format
function formatTime(time) {
    const years = Math.floor(time / 31536000000); // 1 year = 31536000000 milliseconds
    const days = Math.floor((time % 31536000000) / 86400000); // 1 day = 86400000 milliseconds
    const hours = Math.floor((time % 86400000) / 3600000); // 1 hour = 3600000 milliseconds
    const minutes = Math.floor((time % 3600000) / 60000); // 1 minute = 60000 milliseconds
    const seconds = Math.floor((time % 60000) / 1000); // 1 second = 1000 milliseconds

    let formattedTime = '';

    if (years > 0) {
        formattedTime += `${years}y `;
    }

    if (days > 0) {
        formattedTime += `${days}d `;
    }

    if (hours > 0) {
        formattedTime += `${hours}h `;
    }

    if (minutes > 0) {
        formattedTime += `${minutes}m `;
    }

    if (seconds > 0 || formattedTime === '') {
        formattedTime += `${seconds}s`;
    }

    return formattedTime.trim();
}











// Function to handle sweet alert popups for are you sure you want to clear session data
function clearSessionPopup() {
    Swal.fire({
        title: 'Are you sure?',
        text: "This will clear all session data and reset the chart!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, clear it!'
    }).then((result) => {
        if (result.isConfirmed) {
            clearSessionData();
        }
    });
}

// function to return a Promise that resolves to a boolean, handles sweet alert popups for "are you sure you want to stop tracking"
function stopTrackingPopup() {
    return Swal.fire({
        title: 'Are you sure?',
        text: "This will stop tracking and reset the chart!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, stop tracking!'
    }).then((result) => {
        return result.isConfirmed;
    });
}