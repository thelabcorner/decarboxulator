function calculateCartridgeIsolate() {
    const cartCount = parseFloat(document.getElementById("cartCount").value);
    const cartCapacity = parseFloat(document.getElementById("cartCapacity").value);
    let cbnPercentage = parseFloat(document.getElementById("cbdPercentage").value);
    let thcPercentage = parseFloat(document.getElementById("thcaPercentage").value);

    // Check if the sum of percentages is exactly 100
    if (cbnPercentage + thcPercentage !== 100) {
        displayError('The sum of CBN and THC percentages must be exactly 100.');
        return;
    }

    // Check for NaN or non-positive values in essential fields
    if (isNaN(cartCount) || isNaN(cartCapacity) || isNaN(cbnPercentage) || isNaN(thcPercentage) ||
        cartCount <= 0 || cartCapacity <= 0 || cbnPercentage < 0 || thcPercentage < 0) {
        displayError('Please provide valid inputs for all fields.');
        return;
    }

    // Calculate total weight of cartridges
    const totalWeight = cartCount * cartCapacity;

    // Calculate cannabinoid weights
    const thcWeight = totalWeight * (thcPercentage / 100);
    const cbdWeight = totalWeight * (cbnPercentage / 100);
    const thcaWeight = thcWeight * (358.21440943 / 314.224580195);
    const co2Loss = thcaWeight - thcWeight;

    // Display the results
    displayResults(thcaWeight, thcWeight, co2Loss, cbdWeight);
}



// Global variable to keep track of the last edited field
let lastEditedField = null;

// Add event listeners to the input fields
document.getElementById("cbnPercentage").addEventListener('input', function() {
    lastEditedField = "cbnPercentage";
});
document.getElementById("thcaPercentage").addEventListener('input', function() {
    lastEditedField = "thcaPercentage";
});

function balanceCannabinoids() {
    let cbdPercentage = parseFloat(document.getElementById("cbnPercentage").value);
    let thcPercentage = parseFloat(document.getElementById("thcaPercentage").value);

    const balancingMethod = document.getElementById("balancingMethod").value;
    const totalPercentage = cbdPercentage + thcPercentage;

    if (totalPercentage === 0) {
        displayError('Total percentage cannot be zero.');
        return;
    }

    if (balancingMethod === "remainder") {
        // Automatically balance the percentages to be equal based on which field was last edited
        if (lastEditedField === "cbdPercentage") {
            thcPercentage = 100 - cbdPercentage; // Subtract the CBD percentage from 100 for THC
        } else if (lastEditedField === "thcaPercentage") {
            cbdPercentage = 100 - thcPercentage; // Subtract the THC percentage from 100 for CBD
        }
    } else if (balancingMethod === "proportional") {
        // Distribute the remaining percentage proportionally
        let adjustmentRatio = 100 / totalPercentage;
        cbdPercentage *= adjustmentRatio;
        thcPercentage *= adjustmentRatio;
    }

    // Ensure that neither percentage exceeds 100 or drops below 0 due to floating point math
    cbdPercentage = Math.min(100, Math.max(0, cbdPercentage));
    thcPercentage = Math.min(100, Math.max(0, thcPercentage));

    // Update input fields with new balanced percentages
    document.getElementById("cbdPercentage").value = cbdPercentage.toFixed(2);
    document.getElementById("thcaPercentage").value = thcPercentage.toFixed(2);

    calculateCartridgeIsolate(); // Recalculate after balancing
}



function displayResults(thcaWeight, thcWeight, co2Loss, cbdWeight) {
    // Calculate total weights before and after decarboxylation
    const totalWeightBeforeDecarb = thcaWeight + cbdWeight;
    const totalWeightAfterDecarb = thcWeight + cbdWeight;

    document.getElementById("cartridgeIsolateCalculatorResult").innerHTML = `
        <b>THCa Required:</b> ${thcaWeight.toFixed(2)} grams<br>
        <b>THC after Decarb:</b> ${thcWeight.toFixed(2)} grams<br>
        <b>Decarboxylation Loss (CO2):</b> ${co2Loss.toFixed(2)} grams<br>
        <b>CBD Required:</b> ${cbdWeight.toFixed(2)} grams<br>
        <b>Total Weight Before Decarb:</b> ${totalWeightBeforeDecarb.toFixed(2)} grams<br>
        <b>Total Weight After Decarb:</b> ${totalWeightAfterDecarb.toFixed(2)} grams
    `;
}

function displayError(message) {
    document.getElementById("cartridgeIsolateCalculatorResult").innerHTML = `<span style='color: red'><b>Error:</b> ${message}</span>`;
}


function toggleBalancing() {
    const balancingOptions = document.getElementById("balancingOptions");
    balancingOptions.style.display = document.getElementById("balanceCheckbox").checked ? "block" : "none";
}