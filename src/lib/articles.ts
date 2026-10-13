/**
 * Curated research entries. Each URL serves a different question and embeds
 * its actual calculator. No generated keyword permutations or title-only clones.
 */
export interface ArticleSection {
  id: string;
  heading: string;
  paragraphs: readonly string[];
}
export interface ArticleEntry {
  path: string;
  title: string;
  description: string;
  dek: string;
  topic: string;
  intro: readonly string[];
  sections: readonly ArticleSection[];
  toolLabel: string;
  toolPath: string;
  references: ReadonlyArray<{ label: string; url: string }>;
  questions: ReadonlyArray<{ question: string; answer: string }>;
}

const pubchemTHCA = { label: 'PubChem: Tetrahydrocannabinolic acid', url: 'https://pubchem.ncbi.nlm.nih.gov/compound/98523' };
const pubchemTHC = { label: 'PubChem: Delta-9-tetrahydrocannabinol', url: 'https://pubchem.ncbi.nlm.nih.gov/compound/16078' };
const pubchemCO2 = { label: 'PubChem: Carbon dioxide', url: 'https://pubchem.ncbi.nlm.nih.gov/compound/280' };

export const ARTICLES = [
  {
    path: '/learn/thca-mass-loss',
    title: 'THCa Mass Loss: What CO2 Can Tell You',
    description: 'Use before-and-after weights to estimate THCa from CO2 loss. See the inverse formula, a worked example, and why volatile material limits accuracy.',
    dek: 'Starting with a measured weight change, work backward to the amount of THCa that could have produced the CO2.',
    topic: 'Analytical method / Gravimetry',
    intro: [
      'I kept wanting a way to estimate how much THCa an extract contained without repeating the same mass-balance math every time I weighed a batch before and after decarboxylation. That is why I built the percent analyzer.',
      'Its input is a weight change. The output is an inferred starting THCa amount under a specific assumption: the measured loss came from CO2 released by completed THCa decarboxylation.',
    ],
    sections: [
      { id: 'inverse', heading: 'Working backward from a weight change', paragraphs: [
        'One mole of THCa (358.47 g) can release one mole of CO2 (44.01 g). The fraction of THCa mass leaving as CO2 is 44.01 / 358.47, approximately 0.12277. To invert the calculation, divide the CO2 mass loss by that fraction.',
        'Estimated starting THCa mass = CO2 mass loss / 0.12277. Estimated starting THCa percentage = 100 × estimated THCa mass / initial sample mass. The displayed calculator uses the full molar-mass ratio rather than a prematurely rounded factor.',
      ] },
      { id: 'example', heading: 'A 10 g sample that loses 1 g', paragraphs: [
        'Suppose a 10 g extract ends at 9 g. If the entire 1 g difference is CO2 from complete THCa conversion, the model estimates about 8.145 g of starting THCa, or 81.45% of the starting sample. The remaining starting mass is assigned to other material.',
        'That number is a conditional inference. The scale does not identify which chemical species left the sample. It records total mass change, regardless of whether that mass was CO2, water, solvent, terpenes, or something else.',
      ] },
      { id: 'limitations', heading: 'Where gravimetry stops being enough', paragraphs: [
        'If volatile material evaporates during heating, a CO2-only model attributes too much mass loss to THCa and can overestimate starting THCa content. If decarboxylation remains incomplete, the model may underestimate the original THCa because some of its potential CO2 has not left. Both effects can occur in the same run.',
        'A calculated THCa percentage above 100% tells you that the observed loss cannot be explained by the stipulated reaction alone. The analyzer rejects that result rather than silently clamping it. A plausible result below 100% still does not validate the assumption.',
        'This is useful for material accounting and checking expectations. It does not replace a cannabinoid-specific analytical measurement or establish final THC potency.',
      ] },
    ],
    toolLabel: 'Estimate THCa from measured mass loss',
    toolPath: '/tools/thca-percentage',
    references: [pubchemTHCA, pubchemTHC, pubchemCO2, { label: 'Wang et al.: cannabinoid decarboxylation kinetics', url: 'https://pubmed.ncbi.nlm.nih.gov/28861498/' }],
    questions: [
      { question: 'Does a mass-loss estimate measure THCa potency?', answer: 'No. It infers an initial THCa fraction only if the lost mass is CO2 from complete THCa conversion. Gravimetry cannot identify the lost molecules.' },
      { question: 'What if the sample contains terpenes or residual solvent?', answer: 'Loss of terpenes, solvent or water would be counted as CO2 by a CO2-only model and could make the THCa estimate too high.' },
    ],
  },
  {
    path: '/learn/total-thc-formula',
    title: 'Total THC Formula and Calculator',
    description: 'Calculate potential total THC from measured THC and THCa percentages using THC + 0.87723 × THCa. Includes dry-weight basis and recovery limits.',
    dek: 'A lab result reporting separate THC and THCa percentages needs a molecular-mass correction before the values can be combined.',
    topic: 'Calculation / Potency reporting',
    intro: [
      'A reported THCa percentage and a reported delta-9 THC percentage refer to different molecules. Adding the raw percentages overstates the THC-equivalent contribution from THCa because the carboxyl group leaves as CO2.',
      'For percentages reported on the same sample-mass basis, potential total THC is calculated as existing THC plus the THC-equivalent mass of THCa.',
    ],
    sections: [
      { id: 'formula', heading: 'The total THC calculation', paragraphs: [
        'Potential total THC (%) = measured delta-9 THC (%) + [measured THCa (%) × (314.46 / 358.47)]. The molar-mass ratio is approximately 0.87723. This formula converts the reported acid fraction into an equivalent neutral THC mass fraction.',
        'For a report listing 20% THCa and 1% delta-9 THC on the same basis, potential total THC is about 18.545%. It is not 21% and it is not an assurance that processing can recover 18.545% THC.',
      ] },
      { id: 'basis', heading: 'Make sure the percentages share a basis', paragraphs: [
        'Use THC and THCa values from the same sample and the same basis. A dry-weight THCa percentage combined with an as-received THC percentage does not produce a meaningful total. Check whether a laboratory report lists wet-weight, as-received or dry-weight values.',
        'The formula expresses a potential mass equivalent before process losses. If you need estimated milligrams in a specific batch, multiply the calculated percentage by the starting batch mass. If you need a formulation yield after heating, conversion completion and recovery are separate inputs.',
      ] },
      { id: 'use-cases', heading: 'Potential THC versus a finished batch', paragraphs: [
        'The total THC number is useful for comparing report values and describing the THC-equivalent content of starting material. It does not say how quickly THCa reacts, what fraction degrades, or how much THC survives handling and formulation.',
        'For a physical batch, the batch-yield model accounts for CO2 leaving the material. For edibles, the formulation tool also lets you choose completion and recovery assumptions instead of treating the report number as the delivered dose.',
      ] },
    ],
    toolLabel: 'Calculate potential total THC from lab percentages',
    toolPath: '/tools/edible-dosage',
    references: [pubchemTHCA, pubchemTHC, { label: 'USDA: Hemp regulatory context', url: 'https://www.ams.usda.gov/rules-regulations/hemp' }],
    questions: [
      { question: 'Can I add THCa percent directly to THC percent?', answer: 'No. THCa has a greater molecular mass. Potential total THC on a common percentage basis is THC + THCa × (314.46 / 358.47).' },
      { question: 'Does total THC predict how much THC I will recover?', answer: 'No. It is a theoretical mass-equivalence value. Reaction completion, degradation and processing losses require separate assumptions or measurements.' },
    ],
  },
  {
    path: '/learn/decarb-vessel-pressure',
    title: 'THCa Decarb Pressure in Sealed Jars',
    description: 'Explore how THCa-derived CO2 and heated trapped air affect modeled pressure in a fixed headspace. See assumptions and limits before using the calculator.',
    dek: 'The vessel model combines heated trapped air with CO2 produced by decarboxylation. It cannot establish whether a jar is safe.',
    topic: 'Physical model / Gas pressure',
    intro: [
      'I built the pressure model because heating a sealed glass jar bothered me. I wanted to know how much pressure could come from the air already trapped inside and how much additional gas THCa might produce.',
      'The calculator uses ideal-gas relationships so those contributions can be examined separately. A number from this model is not a pressure rating for a glass jar.',
    ],
    sections: [
      { id: 'terms', heading: 'Air heating and CO2 are separate contributions', paragraphs: [
        'Trapped air increases its absolute pressure as its temperature rises at constant volume. The ideal-gas relationship gives P_hot = P_sealed × T_hot / T_sealed, with temperatures in kelvin.',
        'Each mole of THCa converted produces one mole of CO2. The CO2 contribution is nRT/V, where n comes from converted THCa mass / 358.47 g/mol and V is the free gas headspace. The model adds the two partial pressures and subtracts ambient reference pressure to display gauge pressure.',
      ] },
      { id: 'headspace', heading: 'The free-gas volume is not the jar capacity', paragraphs: [
        'A nominally 500 mL jar containing 400 mL of material does not have 500 mL of headspace. The effective free-gas volume, not the printed container size, is the quantity the ideal-gas equation needs. Changes in fill level or material expansion change that volume.',
        'Because the CO2 term is inversely proportional to volume, uncertainty in the headspace can move the result substantially. Sealing temperature, ambient pressure and incomplete reaction add more uncertainty.',
      ] },
      { id: 'boundaries', heading: 'What the pressure estimate leaves out', paragraphs: [
        'The model assumes a rigid vessel with constant headspace and a dry, ideal gas mixture. It omits solvent and terpene vapor, gas dissolution, leaks, pressure-dependent vessel deformation, phase changes and gas/sample temperature differences.',
        'Those omissions do not consistently bias pressure upward or downward. The estimate is neither a conservative safety bound nor evidence that a sealed glass container can withstand heating. Vessel design, defects, thermal stress and pressure limits are outside the calculation.',
      ] },
    ],
    toolLabel: 'Explore the vessel pressure model',
    toolPath: '/tools/max-pressure',
    references: [pubchemTHCA, pubchemCO2, { label: 'NIST CODATA: Molar gas constant', url: 'https://physics.nist.gov/cgi-bin/cuu/Value?r' }],
    questions: [
      { question: 'Can this calculator tell me whether my glass jar will break?', answer: 'No. It predicts idealized gas pressure under entered assumptions. Glass strength, flaws, thermal shock, vapor phases and vessel ratings are not modeled.' },
      { question: 'Does the pressure estimate include terpene or solvent vapor?', answer: 'No. The modeled contributions are heated trapped air and CO2 released from converted THCa in a fixed headspace.' },
    ],
  },
] as const satisfies readonly ArticleEntry[];

export function articleByPath(path: string): ArticleEntry {
  const item = ARTICLES.find(article => article.path === path);
  if (!item) throw new Error('Unknown article: ' + path);
  return item;
}
