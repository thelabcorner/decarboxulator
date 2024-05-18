$(document).ready(function() {
    $(document).on('keydown', 'input', function(e) {
        if (e.key === "=") {
            e.preventDefault();
            const originalInput = $(this);
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

            // Handle the evaluation on pressing Enter
            formulaInput.on('keyup', function(e) {
                if (e.key === 'Enter') {
                    formulaInput.blur();
                    e.preventDefault();
                }
            });
        }
    });
});

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
                    console.error("Result is not a valid number");
                    originalInput.val(''); // Clear input if not valid
                }
            } else {
                originalInput.val(result);
            }
        } catch (error) {
            console.error("Failed to evaluate expression:", error);
            originalInput.val(''); // Clear input on error
            // Optionally, provide feedback to the user about invalid input
        }
    } else {
        originalInput.val(value);
    }
    // Replace back the formula input with the original input
    formulaInput.replaceWith(originalInput);
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