$(document).ready(function() {
    $(document).on('keydown', 'input', function(e) {
        if (e.key === "=") {
            e.preventDefault();
            openEvalInput($(this));
        }
    });
});

function openEvalInput(originalInput) {
    const inputType = originalInput.attr('type');
    const formulaInput = $('<input type="text">');

    // Set initial value and styles to mimic the original input
    formulaInput.val('=');
    formulaInput.css({
        width: originalInput.css('width'),
        height: originalInput.css('height'),
        fontSize: originalInput.css('fontSize'),
    });

    formulaInput.addClass('input-success');

    // Replace original input with the new one temporarily
    originalInput.replaceWith(formulaInput);
    formulaInput.focus();

    // Handle the evaluation on blur
    formulaInput.on('blur', function() {
        evaluateExpression(formulaInput, originalInput, inputType);
    });

    // Handle clicking/tapping on the temporary input or pressing '=' again
    formulaInput.on('click keydown', function(e) {
        if (e.type === 'click' || e.key === "=" || e.key === 'Enter') {
            if (formulaInput.hasClass('error-active')) {
                triggerFadeOutAndOpenNewEvalInput(formulaInput, originalInput, inputType);
            }
        }
    });

    // Handle the evaluation on pressing Enter
    formulaInput.on('keyup', function(e) {
        if (e.key === 'Enter' && !formulaInput.hasClass('error-active')) {
            formulaInput.blur();
            e.preventDefault();
        }
    });
}

function evaluateExpression(formulaInput, originalInput, inputType) {
    const value = formulaInput.val().trim();
    if (value.startsWith('=')) {
        try {
            const result = math.evaluate(value.substring(1));
            // Check if the original input type was 'number', or handle accordingly
            if (inputType === 'number') {
                // Extract numeric value, discard units if any
                const numericValue = parseFloat(result);
                if (!isNaN(numericValue)) {
                    originalInput.val(numericValue);
                } else {
                    throw new Error("Result is not a valid number");
                }
            } else {
                originalInput.val(result);
            }
            // Replace back the formula input with the original input
            formulaInput.replaceWith(originalInput);
        } catch (error) {
            console.error("Failed to evaluate expression:", error);
            handleError(formulaInput, originalInput, inputType, error.message);
        }
    } else {
        originalInput.val(value);
        // Replace back the formula input with the original input
        formulaInput.replaceWith(originalInput);
    }
}

function handleError(formulaInput, originalInput, inputType, errorMessage) {
    formulaInput.css({
        backgroundColor: 'lightcoral'
    });
    formulaInput.val(`Error: ${errorMessage}`);

    const secondsCountdown = 5;
    let secondsLeft = secondsCountdown;
    formulaInput.addClass('error-active');
    const countdownInterval = setInterval(() => {
        formulaInput.val(`Error: ${errorMessage} (${secondsLeft}s)`);
        secondsLeft--;
        if (secondsLeft < 0) {
            clearInterval(countdownInterval);
            formulaInput.replaceWith(originalInput);
        }
    }, 1000);

    // Add a spinning wheel or similar indicator (optional)
    const spinWheel = $('<div class="spin-wheel"></div>');
    spinWheel.css({
        position: 'absolute',
        top: formulaInput.position().top + 'px',
        left: formulaInput.position().left + formulaInput.width() + 10 + 'px'
    });
    $('body').append(spinWheel);
    setTimeout(() => {
        spinWheel.remove();
        formulaInput.removeClass('error-active');
    }, secondsCountdown * 1000);

    formulaInput.data('countdownInterval', countdownInterval); // Store the interval reference
}

function triggerFadeOutAndOpenNewEvalInput(formulaInput, originalInput, inputType) {
    const countdownInterval = formulaInput.data('countdownInterval');
    if (countdownInterval) {
        clearInterval(countdownInterval); // Clear the interval if it's active
    }

    formulaInput.fadeOut(300, function() {
        formulaInput.replaceWith(originalInput);
        originalInput.focus();
        openEvalInput(originalInput);
    });
}

// Prevent form submission on Enter key
window.addEventListener('DOMContentLoaded', (event) => {
    const forms = document.getElementsByTagName('form');
    for(let i = 0; i < forms.length; i++){
        forms[i].addEventListener('keydown', (event) => {
            if(event.keyCode === 13 && event.target.nodeName === 'INPUT'){
                event.preventDefault();
                return false;
            }
        });
    }
});
