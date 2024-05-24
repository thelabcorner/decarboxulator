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
 * III. Research and Academic Use:
 *    A. The Software may be used for research and academic purposes
 *    without obtaining a commercial license, provided that:
 *       1. The above copyright notice and this permission notice are
 *       included in all copies or substantial portions of the Software.
 *       2. Proper attribution is given to the authors and the Software
 *       in any publications or presentations resulting from the use of
 *       the Software.
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