
// @todo: make this based on Stoichiometry

function calculateThcToThca() {
    const thcWeight = document.getElementById("thcWeight").valueAsNumber;
    const thcaWeight = thcWeight / (314.224580195 / 358.21440943);
    const lossCalc = thcaWeight - thcWeight;

    const formattedThcaOutput = thcaWeight.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const formattedLossOutput = lossCalc.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    if (isNaN(thcWeight) || thcWeight < 0.0000000000000000000000001 || thcWeight > 9999999999.9999999999) {
        document.getElementById("thcToThcaResult").innerHTML = "<br><br><span style='color: red'><b>Error: Invalid input value(s)<br>Note: Please enter a positive value between 0.1 and 10 billion.</b></span><br>";
    } else {
        document.getElementById("thcToThcaResult").innerHTML = "<br><b>THCa required: </b><br>" + formattedThcaOutput + " grams" + "<br><br><b>Estimated CO2 Loss: </b><br>" + formattedLossOutput + " grams";
    }
}