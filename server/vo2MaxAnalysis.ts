import { invokeLLM } from "./_core/llm";

/**
 * Extract VO2 Max test data from PDF using AI
 * Returns structured data for all sections: ambient, anthropometric, fitness assessment, and lactate profile
 */
export async function analyzeVo2MaxPdf(pdfUrl: string) {
  const systemPrompt = `You are a medical data extraction specialist. Extract VO2 Max test data from the provided PDF report with high precision.

CRITICAL RULES:
1. Extract ALL numeric values exactly as shown in the PDF
2. Use null for any field that is not present in the document
3. For decimal values, preserve precision (e.g., 1.86 for height, 85.7 for weight)
4. For blood pressure, split into systolic and diastolic (e.g., "130/83" → systolic: 130, diastolic: 83)
5. Extract lactate profile data points from the graph or table showing workload vs lactate/HR
6. Stage numbers should be sequential (1, 2, 3, ...) based on increasing workload

SECTIONS TO EXTRACT:

1. TEST METADATA
   - testDate: Date of the test (YYYY-MM-DD format)
   - testAdministrator: Name of person who administered the test
   - testLocation: Where the test was conducted

2. AMBIENT DATA (environmental conditions)
   - temperature: °C (decimal, e.g., 21.0)
   - pressure: mmHg (integer, e.g., 763)
   - humidity: % (integer, e.g., 72)

3. ANTHROPOMETRIC & BASELINE
   - height: meters (decimal, e.g., 1.86)
   - weight: kg (decimal, e.g., 85.7)
   - restingHeartRate: bpm (integer)
   - restingBpSystolic: mmHg (integer, first number from BP reading)
   - restingBpDiastolic: mmHg (integer, second number from BP reading)
   - restingLactate: mmol/L (decimal, e.g., 1.1)

4. FITNESS ASSESSMENT (values at three key points)
   Aerobic Threshold:
   - aerobicThresholdLactate: mmol/L (decimal, typically 2.0)
   - aerobicThresholdSpeed: km/h (decimal)
   - aerobicThresholdHr: bpm (integer)
   - aerobicThresholdHrPct: % of max HR (integer)
   
   Lactate Threshold:
   - lactateThresholdLactate: mmol/L (decimal, typically 4.0)
   - lactateThresholdSpeed: km/h (decimal)
   - lactateThresholdHr: bpm (integer)
   - lactateThresholdHrPct: % of max HR (integer)
   
   Maximum:
   - maximumLactate: mmol/L (decimal)
   - maximumSpeed: km/h (decimal)
   - maximumHr: bpm (integer)
   - maximumHrPct: % of max HR (integer, typically 100)
   
   VO2 Max Detailed Metrics:
   - vo2MaxMlKgMin: ml/kg/min (decimal, relative VO2 max)
   - vo2MaxLMin: L/min (decimal, absolute VO2 max)
   - vco2LMin: L/min (decimal, carbon dioxide production)
   - rer: Respiratory Exchange Ratio (decimal, e.g., 1.0)
   - rrBrMin: br/min (decimal, respiratory rate)
   - veBtpsLMin: L/min (decimal, ventilation)
   - rpe: Rating of Perceived Exertion (integer, 1-20 scale)

5. LACTATE PROFILE (array of data points from graph/table)
   Extract all stages showing progression from low to high workload:
   - stageNumber: Sequential number (1, 2, 3, ...)
   - workloadSpeed: km/h (decimal)
   - lactate: mmol/L (decimal)
   - heartRate: bpm (integer)

Return the extracted data in the specified JSON schema format.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all VO2 Max test data from this PDF report. Be precise with numeric values and use null for missing fields.",
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
        name: "vo2_max_extraction",
        strict: true,
        schema: {
          type: "object",
          properties: {
            testMetadata: {
              type: "object",
              properties: {
                testDate: { type: ["string", "null"], description: "Test date in YYYY-MM-DD format" },
                testAdministrator: { type: ["string", "null"], description: "Name of test administrator" },
                testLocation: { type: ["string", "null"], description: "Location where test was conducted" },
              },
              required: ["testDate", "testAdministrator", "testLocation"],
              additionalProperties: false,
            },
            ambientData: {
              type: "object",
              properties: {
                temperature: { type: ["number", "null"], description: "Temperature in °C" },
                pressure: { type: ["number", "null"], description: "Pressure in mmHg" },
                humidity: { type: ["number", "null"], description: "Humidity in %" },
              },
              required: ["temperature", "pressure", "humidity"],
              additionalProperties: false,
            },
            anthropometric: {
              type: "object",
              properties: {
                height: { type: ["number", "null"], description: "Height in meters" },
                weight: { type: ["number", "null"], description: "Weight in kg" },
                restingHeartRate: { type: ["number", "null"], description: "Resting heart rate in bpm" },
                restingBpSystolic: { type: ["number", "null"], description: "Resting blood pressure systolic in mmHg" },
                restingBpDiastolic: { type: ["number", "null"], description: "Resting blood pressure diastolic in mmHg" },
                restingLactate: { type: ["number", "null"], description: "Resting lactate in mmol/L" },
              },
              required: ["height", "weight", "restingHeartRate", "restingBpSystolic", "restingBpDiastolic", "restingLactate"],
              additionalProperties: false,
            },
            fitnessAssessment: {
              type: "object",
              properties: {
                aerobicThresholdLactate: { type: ["number", "null"] },
                aerobicThresholdSpeed: { type: ["number", "null"] },
                aerobicThresholdHr: { type: ["number", "null"] },
                aerobicThresholdHrPct: { type: ["number", "null"] },
                lactateThresholdLactate: { type: ["number", "null"] },
                lactateThresholdSpeed: { type: ["number", "null"] },
                lactateThresholdHr: { type: ["number", "null"] },
                lactateThresholdHrPct: { type: ["number", "null"] },
                maximumLactate: { type: ["number", "null"] },
                maximumSpeed: { type: ["number", "null"] },
                maximumHr: { type: ["number", "null"] },
                maximumHrPct: { type: ["number", "null"] },
                vo2MaxMlKgMin: { type: ["number", "null"] },
                vo2MaxLMin: { type: ["number", "null"] },
                vco2LMin: { type: ["number", "null"] },
                rer: { type: ["number", "null"] },
                rrBrMin: { type: ["number", "null"] },
                veBtpsLMin: { type: ["number", "null"] },
                rpe: { type: ["number", "null"] },
              },
              required: [
                "aerobicThresholdLactate", "aerobicThresholdSpeed", "aerobicThresholdHr", "aerobicThresholdHrPct",
                "lactateThresholdLactate", "lactateThresholdSpeed", "lactateThresholdHr", "lactateThresholdHrPct",
                "maximumLactate", "maximumSpeed", "maximumHr", "maximumHrPct",
                "vo2MaxMlKgMin", "vo2MaxLMin", "vco2LMin", "rer", "rrBrMin", "veBtpsLMin", "rpe"
              ],
              additionalProperties: false,
            },
            lactateProfile: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  stageNumber: { type: "number", description: "Sequential stage number" },
                  workloadSpeed: { type: "number", description: "Workload speed in km/h" },
                  lactate: { type: "number", description: "Blood lactate in mmol/L" },
                  heartRate: { type: "number", description: "Heart rate in bpm" },
                },
                required: ["stageNumber", "workloadSpeed", "lactate", "heartRate"],
                additionalProperties: false,
              },
            },
          },
          required: ["testMetadata", "ambientData", "anthropometric", "fitnessAssessment", "lactateProfile"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("No content in AI response");
  }

  // Content should be a string when using json_schema response format
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  const extracted = JSON.parse(contentStr);
  return extracted;
}
