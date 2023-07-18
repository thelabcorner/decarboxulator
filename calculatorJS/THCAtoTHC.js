function calculateThcaToThc() {
    const thcaWeight = document.getElementById("thcaWeight").valueAsNumber;
    const thcWeight = thcaWeight * (314.224580195 / 358.21440943);
    const lossCalc = (thcaWeight - thcWeight);

    const formatTHCOut = thcWeight.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const formatLossOut = lossCalc.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    if (isNaN(thcaWeight) || thcaWeight < 0.0000000000000000000000001 || thcaWeight > 9999999999.9999999999) {
        document.getElementById("thcaToThcResult").innerHTML = "<br><br><span style='color: red'><b>Error: Invalid input value(s)<br>Note: Please enter a positive value between 0.1 and 10 billion.</b></span><br>";
    } else {
        if (thcaWeight === 69420 || thcaWeight === 42069 || thcaWeight === 420 || thcaWeight === 710) {
            easterEgg()
            document.getElementById("thcaToThcResult").innerHTML = "<br><b>Estimated CO2 Loss: </b><br>" + formatLossOut + " grams" + "<br><br><b>Estimated THC produced: </b><br>" + formatTHCOut + " grams";
        } else {
            document.getElementById("thcaToThcResult").innerHTML = "<br><b>Estimated CO2 Loss: </b><br>" + formatLossOut + " grams" + "<br><br><b>Estimated THC produced: </b><br>" + formatTHCOut + " grams";
        }
    }
}