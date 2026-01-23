import { invokeLLM } from "./_core/llm";

/**
 * Analyzes a DEXA scan PDF and extracts structured data
 * Uses LLM to read PDF content and extract tables, metrics, and metadata
 */
export async function analyzeDexaPdf(pdfUrl: string) {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a medical data extraction specialist. Analyze DEXA scan reports and extract structured data.

Extract the following information from the PDF:

1. SCAN METADATA:
   - Scan Date (format: YYYY-MM-DD)
   - Scan ID (e.g., A0818220D)
   - Scan Type (e.g., "a Whole Body")
   - Analysis Version (e.g., "13.6.0.5")
   - Operator name
   - Model (e.g., "Horizon A (S/N 301169M)")
   - Patient Height (cm)
   - Patient Weight (kg)
   - Patient Age (years)

2. BONE MINERAL DENSITY DATA (DXA Results Summary table):
   Extract for each region: L Arm, R Arm, L Ribs, R Ribs, T Spine, L Spine, Pelvis, L Leg, R Leg, Subtotal, Head, Total
   - Area (cm²)
   - BMC (g) - Bone Mineral Content
   - BMD (g/cm²) - Bone Mineral Density
   - T-score
   - Z-score

3. BODY COMPOSITION DATA:
   From Body Composition Results table:
   - Total Fat Mass (g)
   - Total Lean Mass (g) or Lean + BMC (g)
   - Total Mass (g)
   - Total Body % Fat
   - Total Body % Fat T-score
   - Total Body % Fat Z-score
   - Trunk Fat Mass (g)
   - Trunk % Fat
   - Android Fat Mass (g)
   - Android % Fat
   - Gynoid Fat Mass (g)
   - Gynoid % Fat

4. ADIPOSE INDICES (from Adipose Indices table):
   - Fat Mass/Height² (kg/m²)
   - Android/Gynoid Ratio
   - % Fat Trunk/% Fat Legs
   - Trunk/Limb Fat Mass Ratio
   - Est. VAT Mass (g) - CRITICAL
   - Est. VAT Volume (cm³) - CRITICAL
   - Est. VAT Area (cm²) - CRITICAL

5. LEAN INDICES (if available):
   - Lean/Height² (kg/m²)
   - Appendicular Lean/Height² (kg/m²)

Return ONLY valid JSON. Do NOT include markdown code blocks or explanations.`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all data from this DEXA scan report PDF:",
          },
          {
            type: "file_url",
            file_url: {
              url: pdfUrl,
              mime_type: "application/pdf",
            },
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "dexa_scan_data",
        strict: true,
        schema: {
          type: "object",
          properties: {
            scanMetadata: {
              type: "object",
              properties: {
                scanDate: { type: "string", description: "YYYY-MM-DD format" },
                scanId: { type: "string" },
                scanType: { type: "string" },
                analysisVersion: { type: "string" },
                operator: { type: "string" },
                model: { type: "string" },
                patientHeight: { type: "number", description: "cm" },
                patientWeight: { type: "number", description: "kg" },
                patientAge: { type: "number", description: "years" },
              },
              required: ["scanDate"],
              additionalProperties: false,
            },
            bmdData: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  region: { type: "string" },
                  area: { type: "number" },
                  bmc: { type: "number" },
                  bmd: { type: "number" },
                  tScore: { type: "number" },
                  zScore: { type: "number" },
                },
                required: ["region"],
                additionalProperties: false,
              },
            },
            bodyComposition: {
              type: "object",
              properties: {
                totalFatMass: { type: "number", description: "grams" },
                totalLeanMass: { type: "number", description: "grams" },
                totalMass: { type: "number", description: "grams" },
                totalBodyFatPct: { type: "number", description: "percentage" },
                totalBodyFatPctTScore: { type: "number" },
                totalBodyFatPctZScore: { type: "number" },
                trunkFatMass: { type: "number", description: "grams" },
                trunkFatPct: { type: "number", description: "percentage" },
                androidFatMass: { type: "number", description: "grams" },
                androidFatPct: { type: "number", description: "percentage" },
                gynoidFatMass: { type: "number", description: "grams" },
                gynoidFatPct: { type: "number", description: "percentage" },
              },
              required: [],
              additionalProperties: false,
            },
            adiposeIndices: {
              type: "object",
              properties: {
                fatMassHeightRatio: { type: "number", description: "kg/m²" },
                androidGynoidRatio: { type: "number" },
                trunkLegsFatRatio: { type: "number" },
                trunkLimbFatMassRatio: { type: "number" },
                vatMass: { type: "number", description: "grams" },
                vatVolume: { type: "number", description: "cm³" },
                vatArea: { type: "number", description: "cm²" },
              },
              required: [],
              additionalProperties: false,
            },
            leanIndices: {
              type: "object",
              properties: {
                leanMassHeightRatio: { type: "number", description: "kg/m²" },
                appendicularLeanMassHeightRatio: { type: "number", description: "kg/m²" },
              },
              required: [],
              additionalProperties: false,
            },
          },
          required: ["scanMetadata", "bmdData", "bodyComposition", "adiposeIndices"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("No content returned from LLM");
  }

  // Content should be a string when using JSON response format
  const contentStr = typeof content === "string" ? content : JSON.stringify(content);
  return JSON.parse(contentStr);
}

/**
 * Extract images from DEXA PDF for display
 * Converts PDF pages to PNG images and uploads to S3
 */
export async function extractDexaImages(pdfUrl: string, scanId: number) {
  // TODO: Implement PDF to image conversion
  // For now, return empty array - will implement in next iteration
  return [];
}
