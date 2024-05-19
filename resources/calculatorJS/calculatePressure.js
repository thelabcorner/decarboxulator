
const jarSizesFLOz = [0.5, 1, 2, 4, 6, 8, 12, 16, 24, 32, 64, 128];
const jarSizesML = jarSizesFLOz.map(size => size * 29.5735);
const rosinDensity = 0.9; // g/mL

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

        if (rosinVolume > jarSizeML || availableVolumeLiters <= 0) {
            console.log ('Rosin volume is greater than jar size');
            console.log('Rosin Volume: ' + rosinVolume);
            console.log('Jar Size: ' + jarSizeML);
            pressurePsi = 69420

            return results.push({ percent, pressurePsi });
        }

        const molesCO2 = (percent / 100) * (thcaWeight / 358.48);
        const pressureAtm = (molesCO2 * R * T) / availableVolumeLiters;
        pressurePsi = pressureAtm * 14.696;
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
    const cell = createCell(pressure = 69420 ? 'N/A' : `${pressure}<br/>PSI`);

    if (pressure < 14) {
        cell.classList.add('green');
    } else if (pressure >= 14 && pressure < 15) {
        cell.classList.add('yellow');
    } else if (pressure = 69420) { // USE ONE = SIGN, NOT TWO, NOT THREE...
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