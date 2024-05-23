/**
 * Open-Natural License
 *
 * Copyright (C) 2020-2024 Jackson Cummings - TheDabCorner™ LLC.
 *
 * Preamble
 * This license recognizes that mathematics and logic, as fundamental
 * components of nature, are beyond exclusive ownership. The software
 * covered by this license is a creative and intuitive expression by
 * the author, Jackson Cummings, implementing principles of
 * stoichiometry, mathematics, and logical reasoning. This document
 * establishes the terms under which this software may be used, copied,
 * and distributed.
 *
 * Grant of License
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal with the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * all subject to the following conditions:
 *
 * I. Non-Commercial Use:
 *    A. The above copyright notice and this permission notice must be
 *    included in all copies or substantial portions of the Software.
 *    B. If the Software is redistributed in a non-commercial context,
 *    the phrase "Powered by Decarboxulator™" must be prominently
 *    displayed in the product or service.
 *
 * II. Commercial Use:
 *    A. Open Source Option:
 *       1. If the Software is used in a commercial product or service,
 *       the complete source code of that product or service must be made
 *       available to the public under this license or another permissive
 *       open source license approved by the Open Source Initiative (OSI).
 *       2. A notation "Powered by Decarboxulator™" must be prominently
 *       displayed in the product or service.
 *
 *    B. Commercial License Option:
 *       1. Use of the Software in commercial products or services without
 *       disclosure of source code requires a commercial license obtained
 *       from the Licensor.
 *       2. Contact the Licensor at admin@thedabcorner.site for licensing
 *       options and fees.
 *       3. Redistribution of the Software, or any derivative works, in
 *       source or binary form, requires prior written consent from the
 *       Licensor.
 *       4. A notation "Powered by Decarboxulator™" must be prominently
 *       displayed in the product or service.
 *
 * Warranty Disclaimer
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
 * BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN
 * ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Trademark Notice
 * This license does not grant any rights in the trademarks, service
 * marks, brand names, or logos of TheDabCorner™ LLC or Decarboxulator™.
 *
 * Termination
 * This license is subject to termination if its terms are violated.
 * Upon termination, all rights granted under this license will cease
 * immediately without notice from the Licensor. Following termination,
 * re-acquisition of licensing rights requires express written consent
 * from the Licensor. The Licensor reserves the right to modify or
 * revoke the licenses of any third parties who have received copies or
 * derivative works of the Software from you, to protect the Licensor's
 * interests.
 */


function calculateCartridgeIsolate() {
    const cartCount = parseFloat(document.getElementById("cartCount").value);
    const cartCapacity = parseFloat(document.getElementById("cartCapacity").value);
    let cbnPercentage = parseFloat(document.getElementById("cbnPercentage").value);
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
    const cbnWeight = totalWeight * (cbnPercentage / 100);
    const thcaWeight = thcWeight * (358.21440943 / 314.224580195);
    const co2Loss = thcaWeight - thcWeight;

    // Display the results
    displayResults(thcaWeight, thcWeight, co2Loss, cbnWeight);
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
    let cbnPercentage = parseFloat(document.getElementById("cbnPercentage").value);
    let thcPercentage = parseFloat(document.getElementById("thcaPercentage").value);

    const balancingMethod = document.getElementById("balancingMethod").value;
    const totalPercentage = cbnPercentage + thcPercentage;

    if (totalPercentage === 0) {
        displayError('Total percentage cannot be zero.');
        return;
    }

    if (balancingMethod === "remainder") {
        // Automatically balance the percentages to be equal based on which field was last edited
        if (lastEditedField === "cbnPercentage") {
            thcPercentage = 100 - cbnPercentage; // Subtract the cbn percentage from 100 for THC
        } else if (lastEditedField === "thcaPercentage") {
            cbnPercentage = 100 - thcPercentage; // Subtract the THC percentage from 100 for cbn
        }
    } else if (balancingMethod === "proportional") {
        // Distribute the remaining percentage proportionally
        let adjustmentRatio = 100 / totalPercentage;
        cbnPercentage *= adjustmentRatio;
        thcPercentage *= adjustmentRatio;
    }

    // Ensure that neither percentage exceeds 100 or drops below 0 due to floating point math
    cbnPercentage = Math.min(100, Math.max(0, cbnPercentage));
    thcPercentage = Math.min(100, Math.max(0, thcPercentage));

    // Update input fields with new balanced percentages
    document.getElementById("cbnPercentage").value = cbnPercentage.toFixed(2);
    document.getElementById("thcaPercentage").value = thcPercentage.toFixed(2);

    calculateCartridgeIsolate(); // Recalculate after balancing
}



function displayResults(thcaWeight, thcWeight, co2Loss, cbnWeight) {
    // Calculate total weights before and after decarboxylation
    const totalWeightBeforeDecarb = thcaWeight + cbnWeight;
    const totalWeightAfterDecarb = thcWeight + cbnWeight;

    document.getElementById("cartridgeIsolateCalculatorResult").innerHTML = `
        <b>THCa Required:</b> ${thcaWeight.toFixed(2)} grams<br>
        <b>THC after Decarb:</b> ${thcWeight.toFixed(2)} grams<br>
        <b>Decarboxylation Loss (CO2):</b> ${co2Loss.toFixed(2)} grams<br>
        <b>CBN Required:</b> ${cbnWeight.toFixed(2)} grams<br>
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