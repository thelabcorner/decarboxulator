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