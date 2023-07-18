function calculateCartridgeIsolate() {
    const cartCount = parseFloat(document.getElementById("cartCount").value);
    const cartCapacity = parseFloat(document.getElementById("cartCapacity").value);
    const cbdPercentage = parseFloat(document.getElementById("cbdPercentage").value);
    const thcPercentage = parseFloat(document.getElementById("thcaPercentage").value);

    // Validate cart count and capacity
    if (isNaN(cartCount) || isNaN(cartCapacity) || cartCount <= 0 || cartCapacity <= 0) {
        const result = document.getElementById("calcResult");
        result.innerHTML = "<br><br><span style='color: red'><b>Error: Invalid cart count or capacity</b></span><br>";
        return;
    }

    // Validate CBD and THC percentages
    const totalPercentage = cbdPercentage + thcPercentage;
    if (isNaN(totalPercentage) || totalPercentage !== 100) {
        const result = document.getElementById("calcResult");
        result.innerHTML = "<br><br><span style='color: red'><b>Error: CBD and THC percentages must add up to 100%</b></span><br>";
        return;
    }

    // Calculate total weight
    const totalWeight = cartCount * cartCapacity;

    // Calculate THC and THCa amounts based on percentages
    const thcWeight = totalWeight * (thcPercentage / 100);
    const thcaWeight = thcWeight / 0.877;
    const co2Loss = thcaWeight - thcWeight;
    const cbdWeight = totalWeight * (cbdPercentage / 100);

    // Display the results
    const result = document.getElementById("calcResult");
    result.innerHTML =
        "<br><b>THCa Required:</b> " +
        thcaWeight.toFixed(2) +
        " grams<br><b>THC after Decarb:</b> " +
        thcWeight.toFixed(2) +
        " grams<br><b>Decarboxylation Loss (CO2):</b> " +
        co2Loss.toFixed(2) +
        " grams<br><b>CBD Required:</b> " +
        cbdWeight.toFixed(2) +
        " grams";
}

function autoBalancePercentages() {
    const cbdInput = document.getElementById("cbdPercentage");
    const thcInput = document.getElementById("thcaPercentage");

    let cbdPercentage = parseFloat(cbdInput.value);
    let thcPercentage = parseFloat(thcInput.value);

    if (isNaN(cbdPercentage) || isNaN(thcPercentage)) {
        cbdPercentage = isNaN(cbdPercentage) ? 0 : cbdPercentage;
        thcPercentage = isNaN(thcPercentage) ? 0 : thcPercentage;
    }

    // Normalize THC and CBD percentages if they are above 100%
    if (thcPercentage > 100) {
        thcPercentage = Math.floor(thcPercentage * 10) / 10; // Normalize to the nearest tenths place
    }

    if (cbdPercentage > 100) {
        cbdPercentage = Math.floor(cbdPercentage * 10) / 10; // Normalize to the nearest tenths place
    }


    const totalPercentage = cbdPercentage + thcPercentage;

    if (totalPercentage !== 100) {
        const choice = prompt("The CBD and THC percentages do not add up to 100%. Please choose an adjustment method:\n\n'1' Original adjustment\n'2' Proportional adjustment");

        if (choice === "1") {
            // Original adjustment
            if (cbdPercentage < thcPercentage) {
                cbdPercentage += 100 - totalPercentage;
            } else {
                thcPercentage += 100 - totalPercentage;
            }
        } else if (choice === "2") {
            // Proportional adjustment
            const adjustmentFactor = (100 - totalPercentage) / totalPercentage;
            cbdPercentage *= 1 + adjustmentFactor;
            thcPercentage *= 1 + adjustmentFactor;
        } else {
            // Cancel operation
            return;
        }

        cbdInput.value = cbdPercentage.toFixed(3);
        thcInput.value = thcPercentage.toFixed(3);
        calculateCartridgeIsolate();
    }
}




