function calculateDecarbTime() {
    const sampleSizeInput = document.getElementById("sampleSize");
    const percentDecarboxylationInput = document.getElementById("percentDecarboxylation");
    const temperatureInput = document.getElementById("temperature");
    const thcaConcentrationInput = document.getElementById("thcaConcentration");
    const tempUnitInput = document.getElementById("tempUnit");
    const resultOutput = document.getElementById("decarbTimeResult");

    const sampleSize = sampleSizeInput.value;


    let thcaConcentration = thcaConcentrationInput.value;
    if (thcaConcentration > 1) {
        thcaConcentration = thcaConcentration / 100; // if value greater than 1, convert percent to decimal
    }


    let percentDecarboxylation = percentDecarboxylationInput.value;


    if (percentDecarboxylation > 1) {
        percentDecarboxylation = percentDecarboxylation / 100; // if value greater than 1, convert percent to decimal
        if (percentDecarboxylation >= 0.99) {
            percentDecarboxylation = 0.98;
        }
    }


    const temperature = temperatureInput.value;
    const tempUnit = tempUnitInput.value;

    if (!sampleSize || sampleSize < 0 || !percentDecarboxylation || !temperature) {
        resultOutput.innerHTML = "<p>Please enter valid input values.</p>";
    } else if (temperature < 80 && tempUnit === "C" || temperature < 176 && tempUnit === "F" || temperature < 353.15 && tempUnit === "K") {
        resultOutput.innerHTML = "<p>Please enter input value higher than 80&#176;C, 176&#176;F, or 353.15K.<br>Note: THCa does not decarboxylate at an accurately or easily quantified rate below these temperatures.</p>";
    } else {
        const decarbTime = predictTime(sampleSize, thcaConcentration, percentDecarboxylation, temperature, tempUnit);
        resultOutput.innerHTML = "<p>Estimated decarboxylation time: " + decarbTime + "</p>";
    }
}

function predictTime(sampleSize, thcaConcentration, percentDecarboxylation, temperature, tempUnit) {

    // Calculate Rate Constant
    const rateConstant = calculateRateConstant(temperature, tempUnit);

    // Calculate initial mass of THCA in grams
    const initialMass = sampleSize * thcaConcentration / 1000;

    // Calculate target fraction of THCA
    const targetFraction = 1 - percentDecarboxylation;

    // Calculate decarboxylation time in seconds using Equation 3
    const timeSec = -Math.log(targetFraction) / rateConstant;

    console.log(`It will take ${timeSec} seconds for ${percentDecarboxylation * 100}% decarboxylation of THCa.`);

    return formatDuration(timeSec * 1000);
}


function calculateRateConstant(temperature, tempUnit) {
    console.log(`temperature: ${temperature} \n tempUnit: ${tempUnit}`);

    temperature = parseFloat(temperature);

    // Convert temperature to Kelvin if it's not already in Kelvin
    if (tempUnit === "C") {
        temperature = temperature + 273.15; // Celsius to Kelvin conversion
    } else if (tempUnit === "F") {
        temperature = (temperature + 459.67) * (5 / 9); // Fahrenheit to Kelvin conversion
    }

    console.log(`temperature after conversion (in Kelvin): ${temperature}`);

    // Constants for THCA decarboxylation
    const A = 0.41 * Math.pow(10, 5); // Pre-exponential factor in s^-1
    const Ea = 58.7 * 1000; // Activation energy in J/mol
    const R = 8.3145; // Universal gas constant in J/mol*K

    // Calculate the rate constant k using the Arrhenius equation
    const k = A * Math.exp(-Ea / (R * temperature));

    console.log(`k: ${k}`);

    return k;
}


function formatDuration(duration) {
    var milliseconds = Math.floor(duration % 1000);
    var seconds = Math.floor((duration / 1000) % 60);
    var minutes = Math.floor((duration / (1000 * 60)) % 60);
    var hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
    var days = Math.floor(duration / (1000 * 60 * 60 * 24));
    var weeks = Math.floor(duration / (1000 * 60 * 60 * 24 * 7));
    var months = Math.floor(duration / (1000 * 60 * 60 * 24 * 30));
    var years = Math.floor(duration / (1000 * 60 * 60 * 24 * 365));

    var parts = [];
    if (years) {
        parts.push(years + ' year' + (years > 1 ? 's' : ''));
    }
    if (months) {
        parts.push(months + ' month' + (months > 1 ? 's' : ''));
    }
    if (weeks) {
        parts.push(weeks + ' week' + (weeks > 1 ? 's' : ''));
    }
    if (days) {
        parts.push(days + ' day' + (days > 1 ? 's' : ''));
    }
    if (hours) {
        parts.push(hours + ' hour' + (hours > 1 ? 's' : ''));
    }
    if (minutes) {
        parts.push(minutes + ' minute' + (minutes > 1 ? 's' : ''));
    }
    if (seconds) {
        parts.push(seconds + ' second' + (seconds > 1 ? 's' : ''));

    }
    if (milliseconds) {
        parts.push(milliseconds + ' millisecond' + (milliseconds > 1 ? 's' : ''));
    }
    if (!parts.length) {
        parts.push('0 milliseconds');
    }
    return parts.join(' ');
}