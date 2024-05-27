// Options for the indicators
const indicatorOptions = {
    radius: 4,
    borderWidth: 1,
    borderColor: 'red',
    backgroundColor: 'transparent'
};

// Override getLabelAndValue to return the interpolated value with limited decimal places
const getLabelAndValue = Chart.controllers.line.prototype.getLabelAndValue;
Chart.controllers.line.prototype.getLabelAndValue = function(index) {
    if (index === -1) {
        const meta = this.getMeta();
        const pt = meta._pt;
        const vScale = meta.vScale;
        const hScale = meta.iScale; // Assuming iScale as the horizontal scale

        // Ensure that pt.x is converted from pixel to the actual data (timestamp or date)
        const dateValue = hScale.getValueForPixel(pt.x); // This method will get the actual data from pixel value

        const xValue = new Date(dateValue);

        // Format the date to 'M/d/yyyy | hh:mm:ss.SSS a'
        const formattedDate = `${xValue.getMonth() + 1}/${xValue.getDate()}/${xValue.getFullYear()} | ` +
            `${xValue.getHours()}:${String(xValue.getMinutes()).padStart(2, '0')}:${String(xValue.getSeconds()).padStart(2, '0')}.${String(xValue.getMilliseconds()).padStart(3, '0')} ` +
            `${xValue.getHours() >= 12 ? 'PM' : 'AM'}`;

        return {
            label: formattedDate, // Displaying the formatted date
            value: parseFloat(vScale.getValueForPixel(pt.y)).toFixed(3) // Limiting the float to 3 decimals
        };
    }
    return getLabelAndValue.call(this, index);
}



// The interaction mode
Chart.Interaction.modes.interpolate = function(chart, e, option) {
    const x = e.x;
    const items = [];
    const metas = chart.getSortedVisibleDatasetMetas();
    for (let i = 0; i < metas.length; i++) {
        const meta = metas[i];
        const pt = meta.dataset.interpolate({
            x
        }, "x");
        if (pt) {
            const element = new Chart.elements.PointElement({ ...pt,
                options: { ...indicatorOptions
                }
            });
            meta._pt = element;
            items.push({
                element,
                index: -1,
                datasetIndex: meta.index
            });
        } else {
            meta._pt = null;
        }
    }
    return items;
};