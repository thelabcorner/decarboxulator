// Global variables
let chartData = [];
let chart;



// Function to start tracking
function startTracking() {
    const tareWeight = parseFloat(document.getElementById("tareWeight").value);
    const thcaStartWeight = parseFloat(document.getElementById("thcaStartWeight").value);
    const otherCannabinoidWeight = parseFloat(document.getElementById("otherCannabinoidWeight").value) || 0;

    if (isNaN(tareWeight) || isNaN(thcaStartWeight) || tareWeight < 0 || thcaStartWeight < 0) {
        alert("Please enter valid tare weight and THCa start weight.");
        return;
    }

    const totalStartWeight = tareWeight + thcaStartWeight + otherCannabinoidWeight;
    chartData.push({ x: new Date(), y: thcaStartWeight });
    chart.data.labels.push(""); // Add an empty label for the initial data point
    chart.update();

    document.getElementById("currentWeight").style.display = "block";
    document.getElementById("currentWeight").addEventListener("input", function () {
        const currentWeight = parseFloat(this.value);
        if (!isNaN(currentWeight) && currentWeight >= totalStartWeight) {
            const thcaRemainingWeight = currentWeight - tareWeight - otherCannabinoidWeight;
            const thcDecarboxylatedWeight = thcaStartWeight - thcaRemainingWeight;
            const thcDecarboxylatedPercent = (thcDecarboxylatedWeight / thcaStartWeight) * 100;

            const formattedThcDecarboxylatedWeight = thcDecarboxylatedWeight.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });

            const formattedThcaRemainingWeight = thcaRemainingWeight.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });

            document.getElementById("decarbProgressResult").innerHTML = `
                <br><b>Decarboxylated THC Weight:</b> ${formattedThcDecarboxylatedWeight} grams
                <br><b>Decarboxylation Progress:</b> ${thcDecarboxylatedPercent.toFixed(2)}%
                <br><b>THCa Remaining:</b> ${formattedThcaRemainingWeight} grams
            `;

            chartData.push({ x: new Date(), y: thcaRemainingWeight });
            chart.data.labels.push(""); // Add an empty label for the new data point
            chart.update();
        }
    });
}

// Function to save the session
function saveSession() {
    // Implement the logic to save the session data
    console.log("Save session functionality is not implemented yet.");
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
