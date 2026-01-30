/**
 * Grip Strength Scoring Utility
 * Calculates grip strength score (Weak/Normal/Strong) based on gender and age
 */

export type GripStrengthScore = "Weak" | "Normal" | "Strong";

interface GripStrengthRange {
  min: number;
  max: number;
}

const GRIP_STRENGTH_NORMS: Record<"male" | "female", Record<string, GripStrengthRange>> = {
  male: {
    "20-39": { min: 44, max: 55 },
    "40-59": { min: 36, max: 50 },
    "60+": { min: 30, max: 42 },
  },
  female: {
    "20-39": { min: 26, max: 35 },
    "40-59": { min: 22, max: 32 },
    "60+": { min: 18, max: 28 },
  },
};

/**
 * Calculate grip strength score based on value, gender, and age
 * @param value - Grip strength value in kg
 * @param gender - Client gender ("male" | "female" | "other")
 * @param age - Client age in years
 * @returns Score: "Weak", "Normal", or "Strong"
 */
export function calculateGripStrengthScore(
  value: number,
  gender: "male" | "female" | "other" | null,
  age: number | null
): GripStrengthScore {
  // Default to "male" norms if gender is "other" or null
  const effectiveGender = gender === "female" ? "female" : "male";
  
  // Determine age bracket
  let ageGroup: string;
  if (!age || age < 20) {
    ageGroup = "20-39"; // Default to youngest bracket if age unknown or under 20
  } else if (age >= 20 && age <= 39) {
    ageGroup = "20-39";
  } else if (age >= 40 && age <= 59) {
    ageGroup = "40-59";
  } else {
    ageGroup = "60+";
  }
  
  const range = GRIP_STRENGTH_NORMS[effectiveGender][ageGroup];
  
  if (value < range.min) {
    return "Weak";
  } else if (value >= range.min && value <= range.max) {
    return "Normal";
  } else {
    return "Strong";
  }
}
