let chartInstance = null; // Variable to hold the chart instance
let previousValues = {
    thcaConcentration: null,
    rosinWeight: null,
    temperature: null
};

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

// Function to handle form submission and generate the heatmap matrix
function generateHeatmap() {
    adjustCanvasHeight();

    const thcaConcentration = parseFloat(document.getElementById('thcaConc').value);
    const rosinWeight = parseFloat(document.getElementById('inputWeight').value);
    const temperature = parseFloat(document.getElementById('inputTemperature').value);

    // Check if values have actually changed
    if (thcaConcentration === previousValues.thcaConcentration &&
        rosinWeight === previousValues.rosinWeight &&
        temperature === previousValues.temperature) {
        return; // No changes, do nothing
    }

    // Update previous values
    previousValues = { thcaConcentration, rosinWeight, temperature };

    const data = [];

    [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].reverse().forEach((percent, yIndex) => {
        jarSizesML.forEach((jarSizeML, xIndex) => {
            const results = calculatePressure(temperature, rosinWeight, jarSizeML, thcaConcentration);
            const result = results.find(r => r.percent === percent);
            const pressurePsi = result ? result.pressurePsi : 0;

            data.push({
                x: xIndex + 1,
                y: yIndex + 1,
                v: pressurePsi.toFixed(2)
            });
        });
    });

    const ctx = document.getElementById('heatmapCanvas').getContext('2d');

    // If a chart instance already exists, destroy it
    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'matrix',
        data: {
            datasets: [{
                label: 'Pressure Heatmap',
                data: data,
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.5)',
                backgroundColor: function (context) {
                    const value = context.dataset.data[context.dataIndex].v;
                    if (value <= 0) {
                        return 'gray';
                    } else if (value < 14) {
                        return 'green';
                    } else if (value >= 14 && value < 15) {
                        return '#ffb800';
                    } else {
                        return 'red';
                    }
                },
                width: ({ chart }) => (chart.chartArea || {}).width / jarSizesFLOz.length - 1,
                height: ({ chart }) => (chart.chartArea || {}).height / 11 - 1,
            }],
        },
        options: {
            scales: {
                x: {
                    display: true,
                    ticks: {
                        autoSkip: false,
                        callback: function (value) {
                            return jarSizesFLOz[value - 1] + ' fl oz';
                        }
                    },
                    min: 0.5,
                    max: jarSizesFLOz.length + 0.5,
                    offset: false
                },
                y: {
                    display: true,
                    ticks: {
                        autoSkip: false,
                        callback: function (value) {
                            return [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5][11 - value] + '%';
                        }
                    },
                    min: 0.5,
                    max: 11.5
                }
            },
            plugins: {
                datalabels: {
                    display: true,
                    align: 'center',
                    anchor: 'center',
                    color: 'black',
                    formatter: function (value, context) {
                        return value.v <= 0 ? 'N/A' : value.v + ' PSI';
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const jarSize = jarSizesFLOz[context.dataIndex % jarSizesFLOz.length];
                            const percent = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5][Math.floor(context.dataIndex / jarSizesFLOz.length)];
                            const thcPercent = 100 - percent;
                            const pressure = context.raw.v <= 0 ? 'N/A' : context.raw.v + ' PSI';
                            return [`${jarSize} fl oz`, `${thcPercent}% THCa | ${percent}% THC`, `PSI Generated: ${pressure}`];
                        }
                    },
                },
            },
            responsive: true
        },
        plugins: [ChartDataLabels]
    });
}

function adjustCanvasHeight() {
    const canvas = document.getElementById('heatmapCanvas');
    const isMobile = window.innerWidth <= 768; // Adjust the breakpoint as needed

    if (isMobile) {
        canvas.height = 500; // Set the canvas height to 500 pixels for mobile
        Chart.defaults.font.size = 10; // Smaller font size for mobile
    } else {
        canvas.height = ''; // Reset the height to its default value for larger screens
        Chart.defaults.font.size = 12; // Default font size for larger screens
    }
}

window.addEventListener('resize', adjustCanvasHeight);
