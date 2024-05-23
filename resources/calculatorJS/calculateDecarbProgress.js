// Open-Natural License
//
// Copyright (C) 2020-2024 Jackson Cummings - TheDabCorner™ LLC.
//
// Preamble
// This license recognizes that mathematics and logic, as fundamental
// components of nature, are beyond exclusive ownership. The software
// covered by this license is a creative and intuitive expression by
// the author, Jackson Cummings, implementing principles of
// stoichiometry, mathematics, and logical reasoning. This document
// establishes the terms under which this software may be used, copied,
// and distributed.
//
// Grant of License
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal with the Software without restriction,
// including without limitation the rights to use, copy, modify, merge,
// publish, distribute, sublicense, and/or sell copies of the Software,
// all subject to the following conditions:
//
// I. Non-Commercial Use:
//    A. The above copyright notice and this permission notice must be
//    included in all copies or substantial portions of the Software.
//    B. If the Software is redistributed in a non-commercial context,
//    the phrase "Powered by Decarboxulator™" must be prominently
//    displayed in the product or service.
//
// II. Commercial Use:
//    A. Open Source Option:
//       1. If the Software is used in a commercial product or service,
//       the complete source code of that product or service must be made
//       available to the public under this license or another permissive
//       open source license approved by the Open Source Initiative (OSI).
//       2. A notation "Powered by Decarboxulator™" must be prominently
//       displayed in the product or service.
//
//    B. Commercial License Option:
//       1. Use of the Software in commercial products or services without
//       disclosure of source code requires a commercial license obtained
//       from the Licensor.
//       2. Contact the Licensor at admin@thedabcorner.site for licensing
//       options and fees.
//       3. Redistribution of the Software, or any derivative works, in
//       source or binary form, requires prior written consent from the
//       Licensor.
//       4. A notation "Powered by Decarboxulator™" must be prominently
//       displayed in the product or service.
//
// Warranty Disclaimer
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
// BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN
// CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// Trademark Notice
// This license does not grant any rights in the trademarks, service
// marks, brand names, or logos of TheDabCorner™ LLC or Decarboxulator™.
//
// Termination
// This license is subject to termination if its terms are violated.
// Upon termination, all rights granted under this license will cease
// immediately without notice from the Licensor. Following termination,
// re-acquisition of licensing rights requires express written consent
// from the Licensor. The Licensor reserves the right to modify or
// revoke the licenses of any third parties who have received copies or
// derivative works of the Software from you, to protect the Licensor's
// interests.



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
                        tooltipFormat: 'M/d/yyyy | hh:mm:ss a',
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
    const exportDataButton = document.getElementById("exportDataButton");
    const tareWeightInput = document.getElementById("tareWeight");
    const thcaStartWeightInput = document.getElementById("thcaStartWeight");

    if (!TRACKING) {
        // If not currently tracking, start tracking
        TRACKING = true;
        document.getElementById("currentWeightDiv").style.display = "block";

        startTrackingButton.innerText = "Add Point";
        startTrackingButton.style.display = "inline";
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
            startTrackingButton.style.marginRight = "5px";
            stopTrackingButton.className = "btn btn-danger ml-2";
            stopTrackingButton.id = "stopTrackingButton";
            startTrackingButton.parentNode.insertBefore(stopTrackingButton, startTrackingButton.nextSibling);

            clearSessionButton.style.display = "inline"; // Show the clear session button
            exportDataButton.style.display = "inline";


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

    const otherCannabinoidWeightInput = document.getElementById("otherCannabinoidWeight");
    let otherCannabinoidWeight = 0;

    if (otherCannabinoidWeightInput.value.trim() !== '') {
        otherCannabinoidWeight = parseFloat(otherCannabinoidWeightInput.value);
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

    const dataPoint = calculateDecarbProgress();

    if (dataPoint) {

        // Update the progress bar
        updateDecarbProgressBar(dataPoint.decarbCompletion)

        // Add the data point to the chart rounding to 2 decimal places
        const timeStamp = new Date();

        chart.data.datasets[0].data.push({ x: timeStamp, y: dataPoint.remainingTHCAWeight });
        chart.data.datasets[1].data.push({ x: timeStamp, y: dataPoint.convertedTHCWeight });
        chart.data.datasets[2].data.push({ x: timeStamp, y: dataPoint.decarbCompletion });
        chart.update();

        // Save the updated chart data to session storage
        saveSessionData(timeStamp, dataPoint);
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



function calculateDecarbProgress() {
    const THCA_MW = math.bignumber(358.21440943); // g/mol
    const THC_MW = math.bignumber(314.224580195); // g/mol
    const DECARB_CONSTANT = THC_MW.div(THCA_MW); // Ratio of THC MW to THCA MW

    const initialTHCAWeight = math.bignumber(document.getElementById("thcaStartWeight").value);
    const tareWeight = math.bignumber(document.getElementById("tareWeight").value);

    const otherCannabinoidWeightInput = document.getElementById("otherCannabinoidWeight");
    let otherCannabinoidWeight = math.bignumber(0);

    if (otherCannabinoidWeightInput.value.trim() !== '' && !isNaN(otherCannabinoidWeightInput.value)) {
        otherCannabinoidWeight = math.bignumber(otherCannabinoidWeightInput.value);
    }

    const currentTotalVesselWeight = math.bignumber(document.getElementById("currentWeight").value);

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

    const currentContentWeight = currentTotalVesselWeight.minus(tareWeight);
    const totalInitialWeight = initialTHCAWeight.plus(otherCannabinoidWeight);
    const expectedFinalTHCWeight = initialTHCAWeight.mul(DECARB_CONSTANT);
    const expectedCO2LossWeight = initialTHCAWeight.minus(expectedFinalTHCWeight);
    const expectedFinalContentWeight = totalInitialWeight.minus(expectedCO2LossWeight);
    const expectedFinalVesselWeight = expectedFinalContentWeight.plus(tareWeight);
    const weightLossSoFar = initialTHCAWeight.minus(currentContentWeight.minus(otherCannabinoidWeight));
    const decarbCompletion = weightLossSoFar.div(expectedCO2LossWeight).mul(100);
    const convertedTHCWeight = currentContentWeight.minus(otherCannabinoidWeight).mul(decarbCompletion.div(100));
    const remainingTHCAWeight = currentContentWeight.minus(otherCannabinoidWeight).minus(convertedTHCWeight);

    // Calculating percentages based on the current slurry weight
    const slurryTHCAPercent = remainingTHCAWeight.div(currentContentWeight).mul(100);
    const slurryTHCPercent = convertedTHCWeight.div(currentContentWeight).mul(100);
    const otherCannabinoidPercent = otherCannabinoidWeight.div(currentContentWeight).mul(100);

    document.getElementById("decarbProgressResult").innerHTML = `
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
        otherCannabinoidPercent: otherCannabinoidPercent.toNumber()
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

// Function to save the session data (my addition is to pass it dataPoint)
function saveSessionData(timeStamp, dataPoint) {
    let sessionData = null;
    const cookies = document.cookie.split(';');

    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.startsWith('sessionData=')) {
            sessionData = JSON.parse(decodeURIComponent(cookie.substring('sessionData='.length)));
            break;
        }
    }

    if (!sessionData) {
        sessionData = {
            chartData: chart.data.datasets.map(dataset => dataset.data),
            tareWeight: document.getElementById("tareWeight").value,
            thcaStartWeight: document.getElementById("thcaStartWeight").value,
            otherCannabinoidWeight: document.getElementById("otherCannabinoidWeight").value,
            dataPoints: []
        };
    }

    // Check for existing data point with the same timestamp
    const existingDataPointIndex = sessionData.dataPoints.findIndex(dp => new Date(dp.timeStamp).toISOString() === new Date(timeStamp).toISOString());

    if (existingDataPointIndex !== -1) {
        // Update existing data point
        sessionData.dataPoints[existingDataPointIndex] = {
            timeStamp: timeStamp,
            currentContentWeight: dataPoint.currentContentWeight,
            weightLossSoFar: dataPoint.weightLossSoFar,
            expectedCO2LossWeight: dataPoint.expectedCO2LossWeight,
            expectedFinalTHCWeight: dataPoint.expectedFinalTHCWeight,
            slurryTHCAPercent: dataPoint.slurryTHCAPercent,
            slurryTHCPercent: dataPoint.slurryTHCPercent,
            otherCannabinoidPercent: dataPoint.otherCannabinoidPercent
        };
    } else {
        // Add new data point
        sessionData.dataPoints.push({
            timeStamp: timeStamp,
            currentContentWeight: dataPoint.currentContentWeight,
            weightLossSoFar: dataPoint.weightLossSoFar,
            expectedCO2LossWeight: dataPoint.expectedCO2LossWeight,
            expectedFinalTHCWeight: dataPoint.expectedFinalTHCWeight,
            slurryTHCAPercent: dataPoint.slurryTHCAPercent,
            slurryTHCPercent: dataPoint.slurryTHCPercent,
            otherCannabinoidPercent: dataPoint.otherCannabinoidPercent
        });
    }

    // Update chartData in sessionData
    sessionData.chartData = chart.data.datasets.map(dataset => dataset.data);

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

    // Reset the progress bar
    updateDecarbProgressBar(0);
}


function exportSessionData(filetype) {
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
        const csvData = [];

// Add heading section
        csvData.push(`startTimestamp,${new Date(sessionData.chartData[0][0].x).toLocaleString().replace(/,/g, ' |')}`);
        csvData.push(`thcaStartWeight,${sessionData.thcaStartWeight}`);
        csvData.push(`tareWeight,${sessionData.tareWeight}`);
        csvData.push(`otherCannabinoidWeight,${sessionData.otherCannabinoidWeight || 0}`);

        csvData.push(`totalStartWeight,${math.add(sessionData.thcaStartWeight, sessionData.tareWeight || 0, sessionData.otherCannabinoidWeight || 0)}`);
        csvData.push(''); // Add an empty line for separation
        csvData.push(`expectedCO2LossWeight,${sessionData.dataPoints[0].expectedCO2LossWeight}`);
        csvData.push(`expectedFinalTHCWeight,${sessionData.dataPoints[0].expectedFinalTHCWeight}`);

        if (sessionData.otherCannabinoidWeight > 0) {
            csvData.push(`expectedFinalContentWeight,${math.add(sessionData.dataPoints[0].expectedFinalTHCWeight, sessionData.otherCannabinoidWeight || 0)}`);
        }
        if (sessionData.tareWeight > 0) {
            csvData.push(`expectedFinalVesselWeight,${math.add(sessionData.dataPoints[0].expectedFinalTHCWeight, sessionData.tareWeight || 0, sessionData.otherCannabinoidWeight || 0)}`);
        }
        csvData.push(''); // Add an empty line for separation


        // Add column headers
        csvData.push('Timestamp,currentContentWeight, remainingTHCAWeight,convertedTHCWeight,decarbCompletion,weightLossSoFar,slurryTHCAPercent,slurryTHCPercent,otherCannabinoidPercent');

        const uniqueDataPoints = new Set();

        for (let i = 0; i < sessionData.chartData[0].length; i++) {
            const chartTimestamp = new Date(sessionData.chartData[0][i].x);
            let chartTimestampLocale = chartTimestamp.toLocaleString().replace(/,/g, ' |');
            const remainingTHCAWeight = sessionData.chartData[0][i].y;
            const convertedTHCWeight = sessionData.chartData[1][i].y;
            const decarbCompletion = sessionData.chartData[2][i].y;

            // Find matching data point in sessionData.dataPoints
            const dataPoint = sessionData.dataPoints.find(dp => new Date(dp.timeStamp).toISOString() === chartTimestamp.toISOString());
            if (!dataPoint) {
                console.error(`No matching data point found for timestamp: ${chartTimestampLocale}`);
                continue;
            }

            // Construct a more detailed composite key
            const compositeKey = `${chartTimestampLocale}-${dataPoint.currentContentWeight}-${remainingTHCAWeight}-${convertedTHCWeight}-${decarbCompletion}-${dataPoint.weightLossSoFar}-${dataPoint.slurryTHCAPercent}-${dataPoint.slurryTHCPercent}-${dataPoint.otherCannabinoidPercent}`;

            // Check and skip duplicates
            if (uniqueDataPoints.has(compositeKey)) {
                continue;
            }

            uniqueDataPoints.add(compositeKey);
            csvData.push(compositeKey.split('-').join(','));
        }

        // Function to handle file exports
        const handleExport = (data, filename, type) => {
            const blob = new Blob([data], { type });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
        };

        switch (filetype) {
            case 'CSV':
                handleExport(csvData.join('\n'), 'decarb_progress_data.csv', 'text/csv');
                break;
            case 'PNG':
                exportChartAsImage('image/png', 'decarb_progress_chart.png');
                break;
            case 'JPEG':
                exportChartAsImage('image/jpeg', 'decarb_progress_chart.jpeg');
                break;
            case 'ZIP':
                exportAllDataAsZip();
                break;
        }

        // Function to export the chart as an image (PNG or JPEG)
        function exportChartAsImage(imageType, filename) {
            const canvas = document.getElementById('chartContainer'); // Ensure your HTML has a canvas element with this ID
            if (canvas) {
                canvas.toBlob(blob => {
                    handleExport(blob, filename, imageType);
                }, imageType);
            }
        }

        // Function to export all data as a ZIP file containing both CSV and chart image
        function exportAllDataAsZip() {
            const zip = new JSZip();
            // Add CSV data
            zip.file('decarb_progress_data.csv', csvData.join('\n'));

            // Add image from canvas
            const canvas = document.getElementById('chartContainer'); // Ensure your HTML has a canvas element with this ID
            canvas.toBlob(blob => {
                zip.file('decarb_progress_chart.png', blob);

                // Generate ZIP file
                zip.generateAsync({ type: 'blob' }).then(content => {
                    handleExport(content, 'decarb_progress_data.zip', 'application/zip');
                });
            }, 'image/png');
        }
    }
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
