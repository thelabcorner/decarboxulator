// Hardcoded jar sizes in fluid ounces
const jarSizesFLOz = [0.5, 1, 2, 4, 6, 8, 12, 16, 24, 32, 64, 128];

// Convert jar sizes to mL
const jarSizesML = jarSizesFLOz.map(size => size * 29.5735); // Correct conversion factor

// Density of rosin (assumed to be similar to hash oil)
const rosinDensity = 0.9; // g/mL

// Function to calculate the pressure for a given temperature, rosin weight, and jar size
function calculatePressure(temperature, rosinWeight, jarSizeML, thcaConcentration) {
    const thcaWeight = rosinWeight * thcaConcentration / 100; // Calculate the weight of THCa in the rosin
    const rosinVolume = rosinWeight / rosinDensity; // Calculate the volume occupied by the rosin
    const availableVolumeLiters = (jarSizeML - rosinVolume) / 1000; // Convert mL to liters and account for rosin volume

    // Check if the rosin volume exceeds the jar size
    if (rosinVolume > jarSizeML) {
        return [{ percent: 0, pressurePsi: 0 }];
    }

    const R = 0.0821; // Ideal gas constant in L·atm/(K·mol)
    const T = (temperature - 32) * (5 / 9) + 273.15; // Convert Fahrenheit to Kelvin

    const results = [];
    // Include 5% and then increment by 10%
    const percents = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    percents.forEach(percent => {
        const molesCO2 = (percent / 100) * (thcaWeight / 358.48);
        const pressureAtm = (molesCO2 * R * T) / availableVolumeLiters;
        const pressurePsi = pressureAtm * 14.696; // Convert atm to PSI
        results.push({ percent, pressurePsi });
    });

    return results;
}

// Function to display the heatmap matrix
function displayHeatmapMatrix(rosinWeight, temperature, thcaConcentration) {
    const heatmap = document.getElementById('heatmap');
    heatmap.innerHTML = ''; // Clear existing heatmap

    // Create header row for jar sizes
    const headerRow = document.createElement('div');
    headerRow.className = 'heatmap-row';
    const emptyCell = document.createElement('div');
    emptyCell.className = 'heatmap-cell';
    emptyCell.textContent = 'Decarb % / Jar Size (fl oz)';
    headerRow.appendChild(emptyCell);
    jarSizesML.forEach(jarSizeML => {
        const jarSizeFLOz = jarSizeML / 29.5735; // Convert mL back to fluid ounces

        const headerCell = document.createElement('div');
        headerCell.className = 'heatmap-cell';
        headerCell.textContent = jarSizeFLOz.toFixed(2);
        headerRow.appendChild(headerCell);
    });
    heatmap.appendChild(headerRow);

    // Generate heatmap matrix
    const percents = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    percents.forEach(percent => {
        const row = document.createElement('div');
        row.className = 'heatmap-row';
        const rowHeaderCell = document.createElement('div');
        rowHeaderCell.className = 'heatmap-cell';
        rowHeaderCell.textContent = `${percent}%`;
        row.appendChild(rowHeaderCell);

        jarSizesML.forEach(jarSizeML => {
            const results = calculatePressure(temperature, rosinWeight, jarSizeML, thcaConcentration);
            
            const result = results.find(r => r.percent === percent);

            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';

            if (result) {
                // Set background color based on PSI value
                if (result.pressurePsi < 14) {
                    cell.style.backgroundColor = 'green';
                } else if (result.pressurePsi >= 14 && result.pressurePsi < 15) {
                    cell.style.backgroundColor = '#ffb800';
                } else {
                    cell.style.backgroundColor = 'red';
                }

                cell.textContent = result.pressurePsi.toFixed(2);
            } else {
                cell.textContent = 'N/A';
                cell.style.backgroundColor = 'gray';
            }

            row.appendChild(cell);
        });

        heatmap.appendChild(row);
    });
}





// Function to handle form submission and generate the heatmap matrix
function generateHeatmap() {
    const thcaConcentration = parseFloat(document.getElementById('thcaConc').value);
    const rosinWeight = parseFloat(document.getElementById('inputWeight').value);
    const temperature = parseFloat(document.getElementById('inputTemperature').value);

    displayHeatmapMatrix(rosinWeight, temperature, thcaConcentration);
}
