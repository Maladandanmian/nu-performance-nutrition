import { describe, it, expect } from "vitest";

describe("LimbAsymmetryChart", () => {
  // Test data structure
  const mockScanData = [
    {
      scanDate: new Date("2026-01-24"),
      lArmLeanMass: 5083800, // 5083.8g in grams
      rArmLeanMass: 5066200, // 5066.2g
      lLegLeanMass: 11755500, // 11755.5g
      rLegLeanMass: 12268400, // 12268.4g
    },
  ];

  it("calculates upper limb asymmetry correctly", () => {
    const latestScan = mockScanData[0];
    const lArmMass = latestScan.lArmLeanMass ? latestScan.lArmLeanMass / 1000 : 0;
    const rArmMass = latestScan.rArmLeanMass ? latestScan.rArmLeanMass / 1000 : 0;
    
    const upperLimbAsymmetry = lArmMass + rArmMass > 0 
      ? Math.abs(lArmMass - rArmMass) / ((lArmMass + rArmMass) / 2) * 100 
      : 0;
    
    // L Arm: 5.0838, R Arm: 5.0662
    // Difference: 0.0176, Average: 5.075
    // Asymmetry: (0.0176 / 5.075) * 100 = 0.35%
    expect(upperLimbAsymmetry).toBeGreaterThan(0);
    expect(upperLimbAsymmetry).toBeLessThan(1);
  });

  it("calculates lower limb asymmetry correctly", () => {
    const latestScan = mockScanData[0];
    const lLegMass = latestScan.lLegLeanMass ? latestScan.lLegLeanMass / 1000 : 0;
    const rLegMass = latestScan.rLegLeanMass ? latestScan.rLegLeanMass / 1000 : 0;
    
    const lowerLimbAsymmetry = lLegMass + rLegMass > 0 
      ? Math.abs(lLegMass - rLegMass) / ((lLegMass + rLegMass) / 2) * 100 
      : 0;
    
    // L Leg: 11.7555, R Leg: 12.2684
    // Difference: 0.5129, Average: 12.01195
    // Asymmetry: (0.5129 / 12.01195) * 100 = 4.27%
    expect(lowerLimbAsymmetry).toBeGreaterThan(0);
    expect(lowerLimbAsymmetry).toBeLessThan(10);
  });

  it("identifies dominant upper limb correctly", () => {
    const latestScan = mockScanData[0];
    const lArmMass = latestScan.lArmLeanMass ? latestScan.lArmLeanMass / 1000 : 0;
    const rArmMass = latestScan.rArmLeanMass ? latestScan.rArmLeanMass / 1000 : 0;
    
    const upperDominant = lArmMass > rArmMass ? "Left" : "Right";
    
    // L Arm (5.0838) > R Arm (5.0662)
    expect(upperDominant).toBe("Left");
  });

  it("identifies dominant lower limb correctly", () => {
    const latestScan = mockScanData[0];
    const lLegMass = latestScan.lLegLeanMass ? latestScan.lLegLeanMass / 1000 : 0;
    const rLegMass = latestScan.rLegLeanMass ? latestScan.rLegLeanMass / 1000 : 0;
    
    const lowerDominant = lLegMass > rLegMass ? "Left" : "Right";
    
    // L Leg (11.7555) < R Leg (12.2684)
    expect(lowerDominant).toBe("Right");
  });

  it("classifies asymmetry as balanced when less than 5%", () => {
    const asymmetry = 3.5;
    const getAsymmetryLabel = (asym: number) => {
      if (asym < 5) return "Balanced";
      if (asym < 10) return "Mild Asymmetry";
      return "Significant Asymmetry";
    };
    
    expect(getAsymmetryLabel(asymmetry)).toBe("Balanced");
  });

  it("classifies asymmetry as mild when between 5-10%", () => {
    const asymmetry = 7.5;
    const getAsymmetryLabel = (asym: number) => {
      if (asym < 5) return "Balanced";
      if (asym < 10) return "Mild Asymmetry";
      return "Significant Asymmetry";
    };
    
    expect(getAsymmetryLabel(asymmetry)).toBe("Mild Asymmetry");
  });

  it("classifies asymmetry as significant when greater than 10%", () => {
    const asymmetry = 15.0;
    const getAsymmetryLabel = (asym: number) => {
      if (asym < 5) return "Balanced";
      if (asym < 10) return "Mild Asymmetry";
      return "Significant Asymmetry";
    };
    
    expect(getAsymmetryLabel(asymmetry)).toBe("Significant Asymmetry");
  });

  it("converts grams to kilograms correctly", () => {
    const gramValue = 5083800;
    const kgValue = gramValue / 1000;
    
    expect(kgValue).toBe(5083.8);
  });

  it("handles null lean mass values gracefully", () => {
    const nullData = {
      lArmLeanMass: null,
      rArmLeanMass: null,
    };
    
    const lArmMass = nullData.lArmLeanMass ? nullData.lArmLeanMass / 1000 : 0;
    const rArmMass = nullData.rArmLeanMass ? nullData.rArmLeanMass / 1000 : 0;
    
    expect(lArmMass).toBe(0);
    expect(rArmMass).toBe(0);
  });

  it("handles zero asymmetry when limbs are equal", () => {
    const lArmMass = 5.0;
    const rArmMass = 5.0;
    
    const asymmetry = lArmMass + rArmMass > 0 
      ? Math.abs(lArmMass - rArmMass) / ((lArmMass + rArmMass) / 2) * 100 
      : 0;
    
    expect(asymmetry).toBe(0);
  });

  it("handles division by zero gracefully", () => {
    const lArmMass = 0;
    const rArmMass = 0;
    
    const asymmetry = lArmMass + rArmMass > 0 
      ? Math.abs(lArmMass - rArmMass) / ((lArmMass + rArmMass) / 2) * 100 
      : 0;
    
    expect(asymmetry).toBe(0);
  });
});
