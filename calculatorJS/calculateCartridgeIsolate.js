

  function calculateCartridgeIsolate() {
    const cartCount = document.getElementById("cartCount").valueAsNumber;
    const cartCapacity = document.getElementById("cartCapacity").valueAsNumber;
    const cbdPercentage = document.getElementById("cbdPercentage").valueAsNumber;
    const thcPercentage = document.getElementById("thcaPercentage").valueAsNumber;

        // Validate cart count and capacity
        if (cartCount <= 0 || cartCapacity <= 0 || isNaN(cartCount) || isNaN(cartCapacity)) {
            const result = document.getElementById("calcResult");
            result.innerHTML = "<br><br><span style='color: red'><b>Error: Invalid cart count or capacity</b></span><br>";
            return;
        }

          // Validate CBD and THC percentages
          const totalPercentage = cbdPercentage + thcPercentage;
          if (totalPercentage !== 100 || isNaN(totalPercentage)) {
              const result = document.getElementById("calcResult");
              result.innerHTML = "<br><br><span style='color: red'><b>Error: CBD and THC percentages must add up to 100%</b></span><br>";
              return;
          }

    // Calculate total weight
    const totalWeight = cartCount * cartCapacity;

    // Calculate THC and THCa amounts based on percentages
    const thcWeight = totalWeight * (thcPercentage / 100);
    const thcaWeight = thcWeight / 0.877;
    const co2Loss = thcaWeight - thcWeight;
    const cbdWeight = totalWeight * (cbdPercentage / 100);

    // Display the results
    const result = document.getElementById("calcResult");
    result.innerHTML =
        "<br><b>THCa Required:</b> " +
        thcaWeight.toFixed(2) +
        " grams<br><b>THC after Decarb:</b> " +
        thcWeight.toFixed(2) +
        " grams<br><b>Decarboxylation Loss (CO2):</b> " +
        co2Loss.toFixed(2) +
        " grams<br><b>CBD Required:</b> " +
        cbdWeight.toFixed(2) +
        " grams";
 }
