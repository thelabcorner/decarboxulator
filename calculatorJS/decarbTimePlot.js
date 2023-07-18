// PLOT JS
const temperatures = Array.from(Array(84), (_, i) => 80 + i * 5);

const rateConstants = temperatures.map(temp => calculateRateConstant(temp, 'C'));

if (rateConstants.some(constant => constant === 0)) {
    console.log('Warning: Rate constant is 0 for some temperatures outside the known range');
}

const interpTemperatures = [];
const interpRateConstants = [];

for (let i = 0; i < temperatures.length - 1; i++) {
    const temp1 = temperatures[i];
    const temp2 = temperatures[i + 1];
    const rateConst1 = rateConstants[i];
    const rateConst2 = rateConstants[i + 1];
    const numInterpPoints = 41;

    for (let j = 0; j < numInterpPoints; j++) {
        const t = j / (numInterpPoints - 1);
        const temp = temp1 + t * (temp2 - temp1);
        const rateConst = rateConst1 + t * (rateConst2 - rateConst1);
        interpTemperatures.push(temp);
        interpRateConstants.push(rateConst);
    }
}

const experimentalDataTemperatures = [80, 100, 120, 140, 160];
const experimentalDataConstants = [0.057, 0.376, 0.795, 1.410, 2.819];


const plotData = [{
    x: interpTemperatures,
    y: interpRateConstants,
    mode: 'lines',
    line: {shape: 'spline', smoothing: 1.5},
    hovertemplate: '<b>Temperature:</b> %{x}&#176;C<br><b>Rate Constant:</b> %{y:.3f} min^-1',
    name: '<b>Interpolated Data</b>'
}, {
    x: temperatures,
    y: rateConstants,
    mode: 'markers',
    marker: {size: 6},
    hovertemplate: '<b>Temperature:</b> %{x}&#176;C<br><b>Rate Constant:</b> %{y:.3f} min^-1',
    name: '<b>Arrhenius Data</b>'
},
    {
        x: experimentalDataTemperatures,
        y: experimentalDataConstants,
        mode: 'markers',
        marker: {size: 10, color: 'red'},
        hovertemplate: '<b>Temperature:</b> %{x}&#176;C<br><b>Rate Constant:</b> %{y:.3f} min^-1',
        name: '<b>Experimental Data</b>'
    }];

const layout = {
    title: 'Decarboxylation Rate Constants vs Temperature',
    xaxis: {title: 'Temperature (&#176;C)', range: [80, 200]},
    yaxis: {title: 'Rate Constant (min^-1)', type: 'log'},
    hovermode: 'closest',

};

const config = {
    modeBarButtonsToAdd: [{
        name: 'fullscreen',
        icon: Plotly.Icons.fullscreen,
        click: function (gd) {
            Plotly.update(gd, {width: window.screen.width, height: window.screen.height});
        }
    }]
};

Plotly.newPlot('plot', plotData, layout, config);