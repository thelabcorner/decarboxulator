function calculateDecarbProgress() {
    const InputWeight = document.getElementById("thcaStartWeight").value;
    const CurrentWeight = document.getElementById("thcDecarbedWeight").value;
    const LossCalc = InputWeight * 0.877;
    const DecarbedWeight = InputWeight - CurrentWeight;
    const WeightLeft = (InputWeight - LossCalc) - DecarbedWeight;
    const PercentDecarbed = (DecarbedWeight / (InputWeight - LossCalc)) * 100;


    const formatWeightLeft = WeightLeft.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const formatLossCalc = LossCalc.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });


    if (PercentDecarbed < -50 || PercentDecarbed > 150 || InputWeight === "" || CurrentWeight === "" || (InputWeight === "0" && CurrentWeight === "0")) {
        document.getElementById("decarbProgressResult").innerHTML = "<br><br><span style='color: red'><b>Error: Invalid input values.</span><br>Note: Please enter realistic, positive values between 0.1 and 10 billion.</b><br>";
    } else {
        if (PercentDecarbed < -0.001 || PercentDecarbed > 100) {
            document.getElementById("decarbProgressResult").innerHTML = "<br><br><span style='color: orange'><b>Warning: Possible Invalid input values<br>Note: This calculator is designed to pinpoint progress from on a scale of 0-100% completion. The following results are likely inaccurate or impossible.</span></b><br><br><b>Predicted Decarboxylated Weight: </b><br>" + formatLossCalc + " grams" +

                "<br><br><b>Estimated Decarboxylation Progress: </b><br>" + PercentDecarbed.toFixed(2) + "%" +

                "<br><br><b>Estimated Decarboxylation Progress Remaining: </b><br>" + (100 - PercentDecarbed).toFixed(2) + "%" +

                "<br><br><b>Estimated THCa Remaining: </b><br>" + formatWeightLeft + " grams" + "<br>";

        } else {
            if ((100 - PercentDecarbed) === 0) {
                document.getElementById("decarbProgressResult").innerHTML = "<br><br><span style='color: limegreen'><b>Complete: Input values indicate decarboxylation has completed.</span></b><br><br><b>Predicted Decarboxylated Weight: </b><br>" + formatLossCalc + " grams" +

                    "<br><br><b>Estimated Decarboxylation Progress: </b><br>" + PercentDecarbed.toFixed(2) + "%" +

                    "<br><br><b>Estimated Decarboxylation Progress Remaining: </b><br>" + (100 - PercentDecarbed).toFixed(2) + "%" +

                    "<br><br><b>Estimated THCa Remaining: </b><br>" + formatWeightLeft + " grams" + "<br>";

            } else {
                document.getElementById("decarbProgressResult").innerHTML =
                    "<br><br><b>Predicted Decarboxylated Weight: </b><br>" + formatLossCalc + " grams" +

                    "<br><br><b>Estimated Decarboxylation Progress: </b><br>" + PercentDecarbed.toFixed(2) + "%" +

                    "<br><br><b>Estimated Decarboxylation Progress Remaining: </b><br>" + (100 - PercentDecarbed).toFixed(2) + "%" +

                    "<br><br><b>Estimated THCa Remaining: </b><br>" + formatWeightLeft + " grams" + "<br>";
            }
        }
    }
}