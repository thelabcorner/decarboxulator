function calculateCartridgeIsolate() {
    const cartCount = parseFloat(document.getElementById("cartCount").value);
    const cartCapacity = parseFloat(document.getElementById("cartCapacity").value);
    let cbdPercentage = parseFloat(document.getElementById("cbdPercentage").value);
    let thcPercentage = parseFloat(document.getElementById("thcaPercentage").value);

    // Validate cart count and capacity
    if (isNaN(cartCount) || isNaN(cartCapacity) || cartCount <= 0 || cartCapacity <= 0) {
        const result = document.getElementById("cartridgeIsolateCalculatorResult");
        result.innerHTML = "<br><br><span style='color: red'><b>Error: Invalid cart count or capacity</b></span><br>";
        return;
    }

    // Calculate total weight
    const totalWeight = cartCount * cartCapacity;
    const totalPercentage = cbdPercentage + thcPercentage;

    // Auto-balancing code
    if (document.getElementById("balanceCheckbox").checked) {
        const balancingMethod = document.getElementById("balancingMethod").value;
        if (balancingMethod === "original") {
            if (cbdPercentage < thcPercentage) {
                cbdPercentage += 100 - totalPercentage;
            } else {
                thcPercentage += 100 - totalPercentage;
            }
        } else if (balancingMethod === "proportional") {
            const adjustmentFactor = (100 - totalPercentage) / totalPercentage;
            cbdPercentage *= 1 + adjustmentFactor;
            thcPercentage *= 1 + adjustmentFactor;
        }
    }

    // Update CBD and THC input values
    const cbdInput = document.getElementById("cbdPercentage");
    const thcInput = document.getElementById("thcaPercentage");
    cbdInput.value = cbdPercentage.toFixed(1);
    thcInput.value = thcPercentage.toFixed(1);

    // Validate CBD and THC percentages
    if (isNaN(totalPercentage) || totalPercentage !== 100) {
        const result = document.getElementById("cartridgeIsolateCalculatorResult");
        result.innerHTML = "<br><br><span style='color: red'><b>Error: CBD and THC percentages must add up to 100%</b></span><br>";
        return;
    }

    // Calculate THC and THCa amounts based on percentages
    const thcWeight = totalWeight * (thcPercentage / 100);
    const thcaWeight = thcWeight / (314.224580195 / 358.21440943);
    const co2Loss = thcaWeight - thcWeight;
    const cbdWeight = totalWeight * (cbdPercentage / 100);

    // Display the results
    const result = document.getElementById("cartridgeIsolateCalculatorResult");
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

function toggleBalancing() {
    const balancingOptions = document.getElementById("balancingOptions");
    balancingOptions.style.display = document.getElementById("balanceCheckbox").checked ? "block" : "none";
}
