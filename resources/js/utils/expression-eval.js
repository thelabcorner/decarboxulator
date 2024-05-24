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
