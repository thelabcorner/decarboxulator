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


const jarSizesFLOz = [0.5, 1, 2, 4, 6, 8, 12, 16, 24, 32, 64, 128];
const jarSizesML = jarSizesFLOz.map(size => size * 29.5735);
const rosinDensity = 1.1; // g/mL

function calculatePressure(temperature, rosinWeight, jarSizeML, thcaConcentration) {
    const thcaWeight = rosinWeight * thcaConcentration / 100;
    const rosinVolume = rosinWeight / rosinDensity;
    const availableVolumeLiters = (jarSizeML - rosinVolume) / 1000;

    const results = [];

    const R = 0.0821;
    const T = (temperature - 32) * (5 / 9) + 273.15;

    let pressurePsi= 0;

    const percents = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    percents.forEach(percent => {
        if (rosinVolume > jarSizeML) {
            console.log(rosinVolume > jarSizeML)
            console.log ('Rosin volume is greater than jar size');
            console.log('Rosin Volume: ' + rosinVolume);
            console.log('Jar Size: ' + jarSizeML);
            let pressurePsi = 6942000
            results.push({ percent, pressurePsi });
            return results;
        }

        const molesCO2 = (percent / 100) * (thcaWeight / 358.48);
        const pressureAtm = (molesCO2 * R * T) / availableVolumeLiters;
        let pressurePsi = pressureAtm * 14.696;
        results.push({ percent, pressurePsi });
    });

    return results;
}

function generateHeatmap() {
    const thcaConcentration = parseFloat(document.getElementById('thcaConc').value);
    const extractInputWeight = parseFloat(document.getElementById('inputWeight').value);
    const temperature = parseFloat(document.getElementById('inputTemperature').value);
    const customVesselVolume = parseFloat(document.getElementById('customVesselVolume').value);

    // Calculate THCa weight
    const thcaWeight = extractInputWeight * (thcaConcentration / 100);

    if (isNaN(thcaConcentration) || thcaConcentration <= 0) {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: 'Invalid THCa Concentration',
            showConfirmButton: false,
            timer: 3000
        });
        return;
    }

    if (isNaN(extractInputWeight) || extractInputWeight <= 0) {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: 'Invalid Input Weight',
            showConfirmButton: false,
            timer: 3000
        });
        return;
    }

    if (isNaN(temperature) || temperature <= 0) {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: 'Invalid Temperature',
            showConfirmButton: false,
            timer: 3000
        });
        return;
    }

    const container = document.getElementById('heatmapContainer');
    container.innerHTML = ''; // Clear previous heatmap

    const jarSizes = [...jarSizesFLOz];
    const jarSizesMLAdjusted = [...jarSizesML];
    if (!isNaN(customVesselVolume) && customVesselVolume > 0) {
        jarSizes.unshift(customVesselVolume);
        jarSizesMLAdjusted.unshift(customVesselVolume * 29.5735);
    }

    // Create the grid template based on the number of jar sizes and percentages
    container.style.gridTemplateColumns = `repeat(${jarSizes.length + 1}, auto)`;
    container.style.gridTemplateRows = `repeat(12, auto)`;

    // Create header row
    container.appendChild(createCell(' ')); // Empty corner cell
    jarSizes.forEach((size, index) => {
        const adjustedVolume = (jarSizesMLAdjusted[index] - (extractInputWeight / rosinDensity)).toFixed(2);
        container.appendChild(createCell(`${size} fl oz Jar (${adjustedVolume} mL)`));
    });

    [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].reverse().forEach(percent => {
        const thcPercent = percent;
        const thcaPercent = 100 - thcPercent;
        const thcaWeightLabel = (thcaPercent / 100) * thcaWeight;
        const thcWeightLabel = (thcPercent / 100) * (thcaWeight * 0.877);
        container.appendChild(createCell(`${thcaPercent}% THCa (${thcaWeightLabel.toFixed(2)}g) <br/> ${thcPercent}% THC (${thcWeightLabel.toFixed(2)}g)`)); // Row label
        jarSizesMLAdjusted.forEach(jarSizeML => {
            const results = calculatePressure(temperature, extractInputWeight, jarSizeML, thcaConcentration);
            const result = results.find(r => r.percent === percent);
            const pressurePsi = result ? result.pressurePsi : 0;
            container.appendChild(createHeatmapCell(pressurePsi.toFixed(2)));
        });
    });
}


function createCell(content) {
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    cell.innerHTML = content;
    return cell;
}

function createHeatmapCell(pressure) {
    const cell = createCell(pressure == 6942000 ? 'N/A' : `${pressure}<br/>PSI`);

    if (pressure < 14) {
        cell.classList.add('green');
    } else if (pressure >= 14 && pressure < 15) {
        cell.classList.add('yellow');
    } else if (pressure >= 6942000) { // USE ONE = SIGN, NOT TWO, NOT THREE...
        cell.classList.add('gray');

    } else {
        cell.classList.add('red');
    }
    return cell;
}

document.getElementById('psiCalculatorForm').addEventListener('submit', (e) => {
    e.preventDefault();
    generateHeatmap();
});