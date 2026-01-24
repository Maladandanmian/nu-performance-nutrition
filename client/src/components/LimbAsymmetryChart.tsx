import { useMemo } from "react";

interface LimbAsymmetryChartProps {
  data: any[];
}

export function LimbAsymmetryChart({ data }: LimbAsymmetryChartProps) {
  if (!data || data.length === 0) {
    return <div className="text-center text-gray-500">No data available</div>;
  }

  const latestScan = data[0];

  // Extract limb lean mass values (in grams, convert to kg for display)
  const lArmMass = latestScan.lArmLeanMass ? latestScan.lArmLeanMass / 1000 : 0;
  const rArmMass = latestScan.rArmLeanMass ? latestScan.rArmLeanMass / 1000 : 0;
  const lLegMass = latestScan.lLegLeanMass ? latestScan.lLegLeanMass / 1000 : 0;
  const rLegMass = latestScan.rLegLeanMass ? latestScan.rLegLeanMass / 1000 : 0;

  // Calculate asymmetry percentages
  const upperLimbAsymmetry = lArmMass + rArmMass > 0 
    ? Math.abs(lArmMass - rArmMass) / ((lArmMass + rArmMass) / 2) * 100 
    : 0;
  
  const lowerLimbAsymmetry = lLegMass + rLegMass > 0 
    ? Math.abs(lLegMass - rLegMass) / ((lLegMass + rLegMass) / 2) * 100 
    : 0;

  // Determine which side is stronger
  const upperDominant = lArmMass > rArmMass ? "Left" : "Right";
  const lowerDominant = lLegMass > rLegMass ? "Left" : "Right";

  // Color coding based on asymmetry level
  const getAsymmetryColor = (asymmetry: number) => {
    if (asymmetry < 5) return "text-green-600"; // Balanced
    if (asymmetry < 10) return "text-yellow-600"; // Mild asymmetry
    return "text-orange-600"; // Significant asymmetry
  };

  const getAsymmetryBg = (asymmetry: number) => {
    if (asymmetry < 5) return "bg-green-50";
    if (asymmetry < 10) return "bg-yellow-50";
    return "bg-orange-50";
  };

  const getAsymmetryLabel = (asymmetry: number) => {
    if (asymmetry < 5) return "Balanced";
    if (asymmetry < 10) return "Mild Asymmetry";
    return "Significant Asymmetry";
  };

  return (
    <div className="w-full space-y-6">
      <div className="text-sm text-gray-500 text-center">
        Latest Scan: {new Date(latestScan.scanDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>

      {/* Upper Limbs */}
      <div className={`${getAsymmetryBg(upperLimbAsymmetry)} p-6 rounded-lg`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-semibold text-lg mb-1">Upper Limbs</h3>
            <p className={`text-sm ${getAsymmetryColor(upperLimbAsymmetry)}`}>
              {getAsymmetryLabel(upperLimbAsymmetry)}
            </p>
          </div>
          <div className={`text-2xl font-bold ${getAsymmetryColor(upperLimbAsymmetry)}`}>
            {upperLimbAsymmetry.toFixed(1)}%
          </div>
        </div>

        {/* Comparison bars */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium">Left Arm</span>
              <span className="text-sm text-gray-600">{lArmMass.toFixed(2)} kg</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all"
                style={{ width: `${(lArmMass / Math.max(lArmMass, rArmMass)) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium">Right Arm</span>
              <span className="text-sm text-gray-600">{rArmMass.toFixed(2)} kg</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-purple-500 h-full rounded-full transition-all"
                style={{ width: `${(rArmMass / Math.max(lArmMass, rArmMass)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <p><strong>{upperDominant} arm</strong> is more developed</p>
        </div>
      </div>

      {/* Lower Limbs */}
      <div className={`${getAsymmetryBg(lowerLimbAsymmetry)} p-6 rounded-lg`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-semibold text-lg mb-1">Lower Limbs</h3>
            <p className={`text-sm ${getAsymmetryColor(lowerLimbAsymmetry)}`}>
              {getAsymmetryLabel(lowerLimbAsymmetry)}
            </p>
          </div>
          <div className={`text-2xl font-bold ${getAsymmetryColor(lowerLimbAsymmetry)}`}>
            {lowerLimbAsymmetry.toFixed(1)}%
          </div>
        </div>

        {/* Comparison bars */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium">Left Leg</span>
              <span className="text-sm text-gray-600">{lLegMass.toFixed(2)} kg</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-teal-500 h-full rounded-full transition-all"
                style={{ width: `${(lLegMass / Math.max(lLegMass, rLegMass)) * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium">Right Leg</span>
              <span className="text-sm text-gray-600">{rLegMass.toFixed(2)} kg</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-cyan-500 h-full rounded-full transition-all"
                style={{ width: `${(rLegMass / Math.max(lLegMass, rLegMass)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <p><strong>{lowerDominant} leg</strong> is more developed</p>
        </div>
      </div>

      {/* Reference Info */}
      <div className="mt-6 text-sm text-gray-500 text-center max-w-md mx-auto">
        <p className="font-medium mb-2">Limb Asymmetry Guide</p>
        <p className="text-xs">
          &lt;5% = Balanced • 5-10% = Mild asymmetry • &gt;10% = Significant asymmetry
        </p>
      </div>
    </div>
  );
}
