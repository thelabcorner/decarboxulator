const jarSizesFLOz = [0.5, 1, 2, 4, 6, 8, 12, 16, 24, 32, 64, 128];
const jarSizesML = jarSizesFLOz.map(size => size * 29.5735);
const rosinDensity = 0.9; // g/mL

function calculatePressure(temperature, rosinWeight, jarSizeML, thcaConcentration) {
    const thcaWeight = rosinWeight * thcaConcentration / 100;
    const rosinVolume = rosinWeight / rosinDensity;
    const availableVolumeLiters = (jarSizeML - rosinVolume) / 1000;

    if (rosinVolume > jarSizeML) {
        return [{ percent: 0, pressurePsi: 0 }];
    }

    const R = 0.0821;
    const T = (temperature - 32) * (5 / 9) + 273.15;

    const results = [];
    const percents = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    percents.forEach(percent => {
        const molesCO2 = (percent / 100) * (thcaWeight / 358.48);
        const pressureAtm = (molesCO2 * R * T) / availableVolumeLiters;
        const pressurePsi = pressureAtm * 14.696;
        results.push({ percent, pressurePsi });
    });

    return results;
}

function generateHeatmap() {
    const thcaConcentration = parseFloat(document.getElementById('thcaConc').value);
    const inputWeight = parseFloat(document.getElementById('inputWeight').value);
    const temperature = parseFloat(document.getElementById('inputTemperature').value);
    const customVesselVolume = parseFloat(document.getElementById('customVesselVolume').value);

    const extractWeight = inputWeight * (thcaConcentration / 100);

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
        const adjustedVolume = (jarSizesMLAdjusted[index] - (extractWeight / rosinDensity)).toFixed(2);
        container.appendChild(createCell(`${size} fl oz Jar (${adjustedVolume} ml)`));
    });

    [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].reverse().forEach(percent => {
        const thcPercent = 100 - percent;
        const thcWeight = (percent / 100) * extractWeight;
        const thcaWeight = (thcPercent / 100) * extractWeight;
        container.appendChild(createCell(`${percent}% THCa (${thcaWeight.toFixed(2)}g) <br/> ${thcPercent}% THC (${thcWeight.toFixed(2)}g)`)); // Row label
        jarSizesMLAdjusted.forEach(jarSizeML => {
            const results = calculatePressure(temperature, extractWeight, jarSizeML, thcaConcentration);
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
    const cell = createCell(pressure <= 0 ? 'N/A' : `${pressure}<br/>PSI`);
    if (pressure <= 0) {
        cell.classList.add('gray');
    } else if (pressure < 14) {
        cell.classList.add('green');
    } else if (pressure >= 14 && pressure < 15) {
        cell.classList.add('yellow');
    } else {
        cell.classList.add('red');
    }
    return cell;
}

document.getElementById('psiCalculatorForm').addEventListener('submit', (e) => {
    e.preventDefault();
    generateHeatmap();
});
