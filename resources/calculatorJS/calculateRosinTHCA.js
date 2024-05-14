function calculateTHCAndTHCa(W_initial, W_final) {
    // Molecular weights
    const MW_THCa = 358.48;  // g/mol
    const MW_THC = 314.47;   // g/mol
    const MW_CO2 = 44.01;    // g/mol

    // Calculate weight loss due to decarboxylation
    const W_loss = W_initial - W_final;

    // Calculate moles of CO2 released
    const moles_CO2 = W_loss / MW_CO2;

    // Calculate moles of THCa that decarboxylated
    const moles_THCa = moles_CO2;

    // Calculate the weight of THCa that decarboxylated
    const THCa_decarbed = moles_THCa * MW_THCa;

    // Calculate the weight of THC produced
    const THC = moles_THCa * MW_THC;

    // Calculate percentages based on initial weight
    const THCa_percentage = (THCa_decarbed / W_initial) * 100;
    const THC_percentage = (THC / W_initial) * 100;

    return {
        THCa_decarbed: THCa_decarbed.toFixed(2),
        THC: THC.toFixed(2),
        THCa_percentage: THCa_percentage.toFixed(2),
        THC_percentage: THC_percentage.toFixed(2)
    };
}

function calculateRosinTHCA() {
    const W_initial = parseFloat(document.getElementById('initialWeight').value);
    const W_final = parseFloat(document.getElementById('finalWeight').value);

    if (isNaN(W_initial) || isNaN(W_final)) {
        alert('Please enter valid numbers for the weights.');
        return;
    }

    const result = calculateTHCAndTHCa(W_initial, W_final);
    const resultDiv = document.getElementById('rosinThcaResult');

    resultDiv.innerHTML = `
        <p>THCa (initial): ${result.THCa_decarbed} grams (${result.THCa_percentage}%)</p>
        <p>THC (after decarboxylation): ${result.THC} grams (${result.THC_percentage}%)</p>
    `;
}
