export type Faq = { question: string; answer: string };
export type ToolId = 'conversion' | 'reverse-conversion' | 'batch' | 'analysis' | 'edibles' | 'pressure' | 'tracker' | 'pressure-tracker' | 'cartridge';

/** Indexable questions remain in SSR markup; native disclosures minimize workspace clutter. */
export const TOOL_QUESTIONS: Record<ToolId, readonly Faq[]> = {
  conversion: [
    { question: 'How much THC can 1 gram of THCa theoretically produce?',
      answer: 'At complete conversion, 1 gram of pure THCa corresponds to about 0.877 grams of THC. The remaining mass is released as carbon dioxide. This is a stoichiometric ceiling, not a guaranteed measured yield.' },
    { question: 'Why is the conversion factor 0.87723?',
       answer: 'The bulk molar-mass ratio of THC (314.46 g/mol) to THCa (358.47 g/mol), consistent with PubChem and NRC reference materials, determines the theoretical retained mass after CO2 release.' },
    { question: 'Does the reverse setting convert THC back into THCa?',
      answer: 'No. Reverse mode calculates the THCa starting mass equivalent to a desired THC output. It does not model an actual reverse reaction.' },
  ],
  'reverse-conversion': [
    { question: 'How much pure THCa is needed for 1 gram of theoretical THC?',
      answer: 'About 1.140 grams of THCa. Divide the intended THC mass by the THCa-to-THC molar-mass ratio, 314.46 ÷ 358.47 (approximately 0.87723). For 10 grams of theoretical THC, the equivalent starting THCa mass is approximately 11.4 grams.' },
    { question: 'Does this calculator chemically convert THC into THCa?',
      answer: 'No. It solves the forward decarboxylation equation in reverse to estimate required starting acid mass. It does not describe a reaction that adds CO2 back to THC.' },
    { question: 'Does the required THCa mass include material losses or incomplete conversion?',
      answer: 'No. This is a theoretical mass equivalence for pure THCa with full conversion and full recovery. Assay purity, incomplete reaction, transfer losses and degradation can increase the starting amount needed to reach a measured THC target.' },
  ],
  batch: [
    { question: 'Is the final batch weight the same as the THC yield?',
      answer: 'No. Final batch weight includes other material assumed to remain in the sample. THC yield is only the mass of THC formed from the initial THCa fraction.' },
    { question: 'Does the yield calculation account for processing losses?',
      answer: 'No. The model assumes complete conversion and treats all non-THCa material as unchanged. Evaporation, transfer loss, degradation, and residual solvents require separate accounting.' },
  ],
  analysis: [
    { question: 'Can weight loss alone determine the actual THCa percentage?',
      answer: 'No. Weight loss is not chemically specific. Moisture, terpenes, solvents, and other acidic cannabinoids may also contribute. The output is a model-dependent estimate, not a potency assay.' },
    { question: 'Why can the calculator reject a mass-loss measurement?',
      answer: 'Some measurements imply more THCa than the original sample could physically contain, or a final mass greater than the initial mass. Those values violate the simplified stoichiometric assumptions.' },
  ],
  edibles: [
    { question: 'Does this calculator measure milligrams of THC?',
      answer: 'No. It estimates total and per-serving potential THC from the entered analytical percentages, ingredient mass, and assumed recovery. It does not measure a physical product.' },
    { question: 'How is THC from pre-existing neutral THC handled?',
       answer: 'Pre-existing THC contributes directly without THCa decarboxylation. THCa conversion completion applies only to acidic material, while the separate downstream recovery percentage applies to both pre-existing and THCa-derived THC.' },
    { question: 'Are individual servings guaranteed to contain the calculated amount?',
      answer: 'No. The per-serving value assumes even distribution across the stated number of servings. Actual composition and measurement uncertainty may differ.' },
    { question: 'How do the three ingredient input modes differ?',
      answer: 'Measured mass accepts isolate or distillate component weights. Label potency multiplies each ingredient mass by its cannabinoid percentage. Target dose back-calculates the starting ingredient requirement for a stated per-serving cannabinoid target.' },
    { question: 'Why is THCa input higher than the target active THC?',
      answer: 'Decarboxylation releases CO2, reducing theoretical THC-equivalent mass. In target mode, THCa mass is solved through the molecular-weight ratio, the selected conversion fraction, and the downstream THC recovery factor.' },
    { question: 'Why are CBN and CBD listed separately?',
      answer: 'CBN and CBD are different cannabinoids. Their input totals remain separate; neither contributes to THC-equivalent dose in this model and CBN is not included in CBD totals.' },
  ],
  pressure: [
    { question: 'Does the pressure result include solvent or terpene vapor?',
      answer: 'No. The model adds the pressure from heated trapped air and CO2 released by THCa. It omits vapor pressure, material displacement and changing gas volume, so the number is not a guaranteed maximum.' },
    { question: 'Why are gauge and absolute pressure different?',
      answer: 'Absolute pressure is referenced to vacuum. Gauge pressure subtracts the assumed surrounding atmospheric pressure. The same gas state can therefore have two different numerical pressure readings.' },
    { question: 'Can a jar be considered safe because the predicted pressure is low?',
      answer: 'No. The equation does not evaluate glass strength, closures, temperature gradients or failure modes. Ordinary jars are not pressure-rated processing equipment.' },
  ],
  tracker: [
    { question: 'What does the apparent completion percentage measure?',
      answer: 'The percentage compares measured mass loss against the theoretical CO2 mass that could be released from the entered THCa. Water, solvents and other volatile losses can make the displayed percentage too high.' },
    { question: 'Does a stable weight prove decarboxylation has finished?',
      answer: 'No. A mass-loss plateau can occur for reasons unrelated to cannabinoid conversion. Chemical analysis is needed to establish the remaining THCa and formed THC.' },
    { question: 'Where are tracker sessions saved?',
      answer: 'Sessions are stored in this browser’s IndexedDB on this device. They are not linked to an account. Clearing site data can erase them, so export a backup before changing browsers or clearing storage.' },
  ],
  'pressure-tracker': [
    { question: 'Can a pressure reading determine decarboxylation completion?',
      answer: 'It estimates apparent CO2-equivalent gas generation, not chemically verified conversion. The calculation removes the initial trapped-gas temperature contribution and, in vent mode, adds measured discharged gas. Unmeasured vapors, leaks, headspace changes and gas absorption break the idealized correspondence.' },
    { question: 'How can the tracker start below atmospheric pressure?',
      answer: 'Select absolute PSIA and enter a value below local ambient, or select gauge PSIG and enter a negative reading. An initial vacuum is not zero pressure; all gas-law calculations use absolute pressure and Kelvin.' },
    { question: 'Can I count vent releases instead of logging each one?',
      answer: 'Counted mode multiplies a representative pressure-and-temperature-corrected event by the number of assumed identical cycles. This is less defensible than individually measured events and is only valid with demonstrably repeatable endpoints, no inflow, and negligible gas generation during each vent.' },
  ],
  cartridge: [
    { question: 'Is target fill the starting mixture or the finished cartridge mass?',
      answer: 'Target fill means the total finished cartridge mass: cartridge count multiplied by mass per cartridge. When THCa conversion is selected, the required starting mass is calculated to account for the modeled loss of CO2.' },
    { question: 'What do ingredient parts represent?',
      answer: 'Parts set relative starting ingredient masses. Two parts THC and one part terpene describe a 2:1 starting-mass ratio, before any modeled THCa conversion loss.' },
    { question: 'Do the composition flags predict crystallization?',
      answer: 'No. The flags are qualitative checks of entered composition. They do not measure solubility, predict nucleation or establish stability through temperature changes.' },
  ],
};

