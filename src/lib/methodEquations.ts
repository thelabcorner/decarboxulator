/** Auditable method equations. Static KaTeX reference text is not the numerical engine. */
export type MethodEquation = {label:string;tex:string;caption:string};
export const METHOD_EQUATIONS: Record<string, readonly MethodEquation[]> = {
  "/tools/thca-to-thc": [
    {
      "label": "01 / STOICHIOMETRIC YIELD",
      "tex": "\\mathsf{m}_{\\mathsf{THC}}=\\mathsf{m}_{\\mathsf{THCa}}\\frac{M_{\\mathsf{THC}}}{M_{\\mathsf{THCa}}}",
      "caption": "Default THCa/THC example. Selected acid uses its own molar masses."
    }
  ],
  "/tools/thc-to-thca": [
    {
      "label": "01 / INVERSE MASS EQUIVALENCE",
      "tex": "\\mathsf{m}_{\\mathsf{THCa},required}=\\mathsf{m}_{\\mathsf{THC},target}\\frac{M_{\\mathsf{THCa}}}{M_{\\mathsf{THC}}}",
      "caption": "Back-solves the forward pathway, not chemical conversion of THC into THCa."
    }
  ],
  "/tools/batch-yield": [
    {
      "label": "01 / THEORETICAL BATCH",
      "tex": "\\begin{aligned}\\mathsf{m}_{\\mathsf{THC}}&=\\mathsf{m}_{\\mathsf{batch}}\\,f_{\\mathsf{THCa}}\\frac{M_{\\mathsf{THC}}}{M_{\\mathsf{THCa}}}\\\\\\mathsf{m}_{\\mathsf{final}}&=\\mathsf{m}_{\\mathsf{batch}}-\\mathsf{m}_{\\mathsf{CO_2}}\\end{aligned}",
      "caption": "The feed fraction f is 0 to 1. Nonreactive components remain unchanged."
    }
  ],
  "/tools/thca-percentage": [
    {
      "label": "01 / LOSS-BASED FRACTION",
      "tex": "f_{\\mathsf{THCa},eq}=\\frac{\\mathsf{m}_{0}-\\mathsf{m}_{t}}{\\mathsf{m}_{0}\\left(1-\\frac{M_{\\mathsf{THC}}}{M_{\\mathsf{THCa}}}\\right)}",
      "caption": "All observed loss assumed to be CO2 from the selected reaction."
    }
  ],
  "/tools/edible-dosage": [
    {
      "label": "01 / PER-SERVING EQUIVALENCE",
      "tex": "\\mathsf{m}_{\\mathsf{THC},serving}=\\frac{\\left(\\mathsf{m}_{\\mathsf{THCa}}\\frac{M_{\\mathsf{THC}}}{M_{\\mathsf{THCa}}}\\eta_{\\mathsf{conv}}+\\mathsf{m}_{\\mathsf{THC},initial}\\right)\\eta_{\\mathsf{recovery}}}{N_{\\mathsf{servings}}}",
      "caption": "THC-specific formulation case; other cannabinoid contributions calculated independently."
    }
  ],
  "/tools/max-pressure": [
    {
      "label": "01 / IDEAL GAS INVENTORY",
      "tex": "P_{\\mathsf{abs}}=P_0\\frac{T}{T_0}+\\frac{n_{\\mathsf{CO_2}}RT}{V_g}",
      "caption": "Gas-phase model, before optional dissolved CO2 correction."
    },
    {
      "label": "02 / HENRY PARTITION",
      "tex": "n_{\\mathsf{CO_2}}=\\frac{P_{\\mathsf{CO_2}}V_g}{RT}+k_H V_{\\ell}\\frac{P_{\\mathsf{CO_2}}}{P_{\\mathsf{atm}}}",
      "caption": "Henry solubility coefficient is mol/(L atm); liquid volume is in L."
    }
  ],
  "/tools/decarb-tracker": [
    {
      "label": "01 / MASS-LOSS PROGRESS",
      "tex": "X_{\\mathsf{app}}=100\\frac{\\mathsf{m}_{0}-\\mathsf{m}_{t}}{\\mathsf{m}_{\\mathsf{CO_2},max}}",
      "caption": "Apparent chemical progress requires CO2-specific mass-loss assumptions."
    }
  ],
  "/tools/pressure-tracker": [
    {
      "label": "01 / PRESSURE BALANCE",
      "tex": "n_{\\mathsf{gen,eq}}=\\frac{V_g}{R}\\left(\\frac{P_t}{T_t}-\\frac{P_0}{T_0}\\right)+\\sum_j\\frac{V_g}{R}\\left(\\frac{P_{j,b}}{T_{j,b}}-\\frac{P_{j,a}}{T_{j,a}}\\right)",
      "caption": "Measured vent events and fixed headspace; absolute pressure and Kelvin."
    },
    {
      "label": "02 / INERT GAS THROUGH VENTS",
      "tex": "n_{\\mathsf{air},t}=n_{\\mathsf{air},0}\\prod_j\\left(\\frac{P_{j,a}/T_{j,a}}{P_{j,b}/T_{j,b}}\\right)^{c_j}",
      "caption": "Short well-mixed releases with no significant production or equilibration during venting."
    },
    {
      "label": "03 / HENRY PARTITION",
      "tex": "\\begin{aligned}P_{\\mathsf{CO_2}}&=P_{\\mathsf{total}}-P_{\\mathsf{air}}\\\\n_{\\mathsf{diss}}&=k_HV_{\\ell}\\frac{P_{\\mathsf{CO_2}}}{P_{\\mathsf{atm}}}\\end{aligned}",
      "caption": "Optional field estimate using inferred CO2 partial pressure. Other gases remain unmeasured."
    }
  ],
  "/tools/scale-resolution": [
    {
      "label": "01 / QUANTIZATION BOUND",
      "tex": "\\delta X_{\\max}=\\frac{100\\,r_{\\mathsf{balance}}}{\\mathsf{m}_{\\mathsf{CO_2},max}}",
      "caption": "Worst-case two-reading display rounding, not balance accuracy."
    }
  ],
  "/tools/gauge-resolution": [
    {
      "label": "01 / GAUGE QUANTIZATION",
      "tex": "\\delta X_{\\max}=\\frac{100V_g\\,\\delta P_{\\mathsf{Pa}}}{2Rn_{\\mathsf{CO_2},max}}\\left(\\frac1{T_0}+\\frac1{T_t}+\\sum_j c_j\\left[\\frac1{T_{j,b}}+\\frac1{T_{j,a}}\\right]\\right)",
      "caption": "Pressure display step converted from PSI to Pa; worst-case endpoint rounding."
    }
  ],
  "/tools/cartridge-formulation": [
    {
      "label": "01 / FORMULATION MASS BALANCE",
      "tex": "\\mathsf{m}_{\\mathsf{finished}}=\\sum_i\\mathsf{m}_{i,\\mathsf{initial}}-\\sum_{i\\in\\mathsf{acids}}\\mathsf{m}_{i,\\mathsf{CO_2}}",
      "caption": "Every selected acid loses theoretical CO2; other mass is held constant."
    }
  ]
};
