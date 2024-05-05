function calculateCartridgeIsolate() {
    const cartCount = parseFloat(document.getElementById("cartCount").value);
    const cartCapacity = parseFloat(document.getElementById("cartCapacity").value);
    let cbdPercentage = parseFloat(document.getElementById("cbdPercentage").value);
    let thcPercentage = parseFloat(document.getElementById("thcaPercentage").value);

    // Check for NaN or non-positive values in essential fields
    if (isNaN(cartCount) || isNaN(cartCapacity) || isNaN(cbdPercentage) || isNaN(thcPercentage) ||
        cartCount <= 0 || cartCapacity <= 0 || cbdPercentage < 0 || thcPercentage < 0) {
        displayError('Please provide valid inputs for all fields.');
        return;
    }

    // Calculate total weight of cartridges
    const totalWeight = cartCount * cartCapacity;

    // Calculate cannabinoid weights
    const thcWeight = totalWeight * (thcPercentage / 100);
    const cbdWeight = totalWeight * (cbdPercentage / 100);
    const thcaWeight = thcWeight * (358.21440943 / 314.224580195);
    const co2Loss = thcaWeight - thcWeight;

    // Display the results
    displayResults(thcaWeight, thcWeight, co2Loss, cbdWeight);
}



function balanceCannabinoids(currentField) {
    let cbdPercentage = parseFloat(document.getElementById("cbdPercentage").value);
    let thcPercentage = parseFloat(document.getElementById("thcaPercentage").value);

    // Validate the input values are numbers and within the acceptable range
    if (isNaN(cbdPercentage) || isNaN(thcPercentage) || cbdPercentage < 0 || thcPercentage < 0) {
        displayError('Please provide valid percentages for balancing.');
        return;
    }

    const balancingMethod = document.getElementById("balancingMethod").value;
    const totalPercentage = cbdPercentage + thcPercentage;

    if (totalPercentage === 0) {
        displayError('Total percentage cannot be zero.');
        return;
    }

    if (balancingMethod === "equal") {
        if (currentField === "cbdPercentage") {
            cbdPercentage = Math.min(100, 100 - cbdPercentage);
            thcPercentage = 100 - cbdPercentage;
        } else if (currentField === "thcPercentage") {
            thcPercentage = Math.min(100, 100 - thcPercentage);
            cbdPercentage = 100 - thcPercentage;
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
    const totalWeightAfterDecarb = thcWeight + cbdWeight - co2Loss;

    const resultHtml = `
        <b>THCa Required:</b> ${thcaWeight.toFixed(2)} grams<br>
        <b>THC after Decarb:</b> ${thcWeight.toFixed(2)} grams<br>
        <b>Decarboxylation Loss (CO2):</b> ${co2Loss.toFixed(2)} grams<br>
        <b>CBD Required:</b> ${cbdWeight.toFixed(2)} grams<br>
        <b>Total Weight Before Decarb:</b> ${totalWeightBeforeDecarb.toFixed(2)} grams<br>
        <b>Total Weight After Decarb:</b> ${totalWeightAfterDecarb.toFixed(2)} grams
    `;
    document.getElementById("cartridgeIsolateCalculatorResult").innerHTML = resultHtml;
}

function displayError(message) {
    document.getElementById("cartridgeIsolateCalculatorResult").innerHTML = `<span style='color: red'><b>Error:</b> ${message}</span>`;
}


function toggleBalancing() {
    const balancingOptions = document.getElementById("balancingOptions");
    balancingOptions.style.display = document.getElementById("balanceCheckbox").checked ? "block" : "none";
}