import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

interface DexaVisualizationPanelsProps {
  clientId: number;
}

export function DexaVisualizationPanels({ clientId }: DexaVisualizationPanelsProps) {
  const [currentPanel, setCurrentPanel] = useState(0);
  const [showDataDrawer, setShowDataDrawer] = useState(false);

  // Fetch approved DEXA scans for this client
  const { data: bodyCompHistory } = trpc.dexa.getBodyCompTrend.useQuery({ clientId });
  const { data: bmdHistory } = trpc.dexa.getBmdTrend.useQuery({ clientId });

  // Get the most recent scan for current values
  const latestScan = bodyCompHistory?.[0];

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setCurrentPanel((prev) => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight") {
        setCurrentPanel((prev) => Math.min(5, prev + 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle touch swipe
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 75) {
      // Swiped left
      setCurrentPanel((prev) => Math.min(5, prev + 1));
    }

    if (touchStart - touchEnd < -75) {
      // Swiped right
      setCurrentPanel((prev) => Math.max(0, prev - 1));
    }
  };

  if (!bodyCompHistory || bodyCompHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500">
        <Database className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">No DEXA Scans Available</p>
        <p className="text-sm mt-2">Your trainer will upload your first scan soon.</p>
      </div>
    );
  }

  const panels = [
    {
      id: 0,
      title: "Visceral Fat Status (Latest Scan)",
      component: <VisceralFatGauge data={bodyCompHistory} />,
    },
    {
      id: 1,
      title: "Body Recomposition (Trend)",
      component: <BodyRecompositionChart data={bodyCompHistory} />,
    },
    {
      id: 2,
      title: "VAT Reduction Progress (All Scans)",
      component: <VATProgressBar data={bodyCompHistory} />,
    },
    {
      id: 3,
      title: "Bone Density Map (Latest Scan)",
      component: <BoneDensityHeatmap data={bmdHistory || []} />,
    },
    {
      id: 4,
      title: "Metabolic Health (Latest Scan)",
      component: <MetabolicHealthScore data={latestScan} />,
    },
    {
      id: 5,
      title: "Monthly Progress (All Scans)",
      component: <MonthlyProgressSummary bodyComp={bodyCompHistory} bmd={bmdHistory || []} />,
    },
  ];

  return (
    <div className="relative">
      {/* Navigation Controls at Top */}
      <div className="mb-4">
        {/* Navigation Dots */}
        <div className="flex justify-center gap-2 mb-4">
          {panels.map((panel) => (
            <button
              key={panel.id}
              onClick={() => setCurrentPanel(panel.id)}
              className={`w-2 h-2 rounded-full transition-all ${
                currentPanel === panel.id ? "bg-blue-600 w-8" : "bg-gray-300"
              }`}
              aria-label={`Go to ${panel.title}`}
            />
          ))}
        </div>

        {/* Navigation Arrows */}
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPanel((prev) => Math.max(0, prev - 1))}
            disabled={currentPanel === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDataDrawer(true)}
          >
            <Database className="w-4 h-4 mr-1" />
            View Data
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPanel((prev) => Math.min(5, prev + 1))}
            disabled={currentPanel === 5}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Panel Container */}
      <div
        className="overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentPanel * 100}%)` }}
        >
          {panels.map((panel) => (
            <div key={panel.id} className="w-full flex-shrink-0 px-4">
              <div className="bg-white rounded-lg shadow-lg p-6 min-h-[500px]">
                <h2 className="text-2xl font-bold mb-6 text-center">{panel.title}</h2>
                {panel.component}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Raw Data Drawer */}
      {showDataDrawer && (
        <RawDataDrawer
          clientId={clientId}
          onClose={() => setShowDataDrawer(false)}
        />
      )}
    </div>
  );
}

// Panel 1: Visceral Fat Gauge with Trend
function VisceralFatGauge({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <div className="text-center text-gray-500">No data available</div>;
  }

  const latest = data[0];
  const vatArea = parseFloat(latest.vatArea || "0");
  
  // Get last 6 scans for sparkline
  const recentScans = data.slice(0, 6).reverse();
  const vatTrend = recentScans.map(scan => parseFloat(scan.vatArea || "0"));
  
  // Determine health zone
  let zone = "healthy";
  let zoneColor = "text-green-600";
  let zoneBg = "bg-green-100";
  let zoneLabel = "Healthy";
  
  if (vatArea > 150) {
    zone = "high";
    zoneColor = "text-red-600";
    zoneBg = "bg-red-100";
    zoneLabel = "High Risk";
  } else if (vatArea > 100) {
    zone = "elevated";
    zoneColor = "text-yellow-600";
    zoneBg = "bg-yellow-100";
    zoneLabel = "Elevated";
  }
  
  // Calculate gauge percentage (0-200 cm² scale)
  const gaugePercent = Math.min((vatArea / 200) * 100, 100);
  
  // Calculate trend
  const previousVat = data.length > 1 ? parseFloat(data[1].vatArea || "0") : vatArea;
  const change = vatArea - previousVat;
  const changePercent = previousVat > 0 ? ((change / previousVat) * 100).toFixed(1) : "0";
  
  return (
    <div className="flex flex-col items-center">
      {/* Scan Date */}
      <div className="text-sm text-gray-500 mb-4">
        Latest Scan: {new Date(latest.scanDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>
      
      {/* Circular Gauge */}
      <div className="relative w-64 h-64 mb-6">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={zone === "healthy" ? "#10b981" : zone === "elevated" ? "#f59e0b" : "#ef4444"}
            strokeWidth="8"
            strokeDasharray={`${gaugePercent * 2.51} 251`}
            strokeLinecap="round"
          />
        </svg>
        
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-5xl font-bold">{vatArea.toFixed(1)}</div>
          <div className="text-sm text-gray-500 mt-1">cm²</div>
        </div>
      </div>
      
      {/* Zone Badge */}
      <div className={`${zoneBg} ${zoneColor} px-4 py-2 rounded-full font-semibold mb-4`}>
        {zoneLabel}
      </div>
      
      {/* Change Indicator */}
      {data.length > 1 && (
        <div className="flex flex-col items-center gap-1 mb-6">
          <div className="flex items-center gap-2">
            <span className={change <= 0 ? "text-green-600" : "text-red-600"}>
              {change <= 0 ? "↓" : "↑"} {Math.abs(change).toFixed(1)} cm²
            </span>
            <span className="text-gray-500 text-sm">since last scan</span>
          </div>
          <div className="text-xs text-gray-400">
            Previous: {new Date(data[1].scanDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      )}
      
      {/* Sparkline Trend */}
      {vatTrend.length > 1 && (
        <div className="w-full max-w-md">
          <div className="text-sm text-gray-500 mb-2 text-center">6-Month Trend</div>
          <div className="h-16 flex items-end justify-between gap-1">
            {vatTrend.map((val, idx) => {
              const maxVal = Math.max(...vatTrend);
              const height = (val / maxVal) * 100;
              return (
                <div
                  key={idx}
                  className="flex-1 bg-blue-500 rounded-t transition-all"
                  style={{ height: `${height}%` }}
                  title={`${val.toFixed(1)} cm²`}
                />
              );
            })}
          </div>
        </div>
      )}
      
      {/* Reference Info */}
      <div className="mt-6 text-sm text-gray-500 text-center max-w-md">
        <p className="font-medium mb-1">Visceral Adipose Tissue (VAT)</p>
        <p>Healthy: &lt;100 cm² • Elevated: 100-150 cm² • High Risk: &gt;150 cm²</p>
      </div>
    </div>
  );
}

// Panel 2: Body Recomposition Stacked Area Chart
function BodyRecompositionChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <div className="text-center text-gray-500">No data available</div>;
  }

  // Reverse to show oldest to newest
  const scans = [...data].reverse();
  
  // Extract fat mass and lean mass
  const chartData = scans.map(scan => ({
    date: new Date(scan.scanDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    fatMass: parseFloat(scan.totalFatMass || "0"),
    leanMass: parseFloat(scan.totalLeanMass || "0"),
  }));
  
  // Find max total for scaling
  const maxTotal = Math.max(...chartData.map(d => d.fatMass + d.leanMass));
  
  // Calculate changes
  const firstScan = chartData[0];
  const latestScan = chartData[chartData.length - 1];
  const fatChange = latestScan.fatMass - firstScan.fatMass;
  const leanChange = latestScan.leanMass - firstScan.leanMass;
  
  return (
    <div className="flex flex-col">
      {/* Date Range */}
      <div className="text-sm text-gray-500 mb-4 text-center">
        Trend: {new Date(scans[0].scanDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - {new Date(scans[scans.length - 1].scanDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">Fat Mass</div>
          <div className="text-2xl font-bold text-red-600">{latestScan.fatMass.toFixed(1)} kg</div>
          <div className={`text-sm mt-1 ${fatChange <= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {fatChange <= 0 ? '↓' : '↑'} {Math.abs(fatChange).toFixed(1)} kg
          </div>
        </div>
        
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">Lean Mass</div>
          <div className="text-2xl font-bold text-blue-600">{latestScan.leanMass.toFixed(1)} kg</div>
          <div className={`text-sm mt-1 ${leanChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {leanChange >= 0 ? '↑' : '↓'} {Math.abs(leanChange).toFixed(1)} kg
          </div>
        </div>
      </div>
      
      {/* Stacked Area Chart */}
      <div className="relative h-64 mb-4">
        <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(percent => (
            <line
              key={percent}
              x1="0"
              y1={200 - (percent * 2)}
              x2="400"
              y2={200 - (percent * 2)}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          ))}
          
          {/* Fat Mass Area (bottom) */}
          <path
            d={`
              M 0 200
              ${chartData.map((d, i) => {
                const x = (i / (chartData.length - 1)) * 400;
                const y = 200 - ((d.fatMass / maxTotal) * 200);
                return `L ${x} ${y}`;
              }).join(' ')}
              L 400 200
              Z
            `}
            fill="#fca5a5"
            opacity="0.7"
          />
          
          {/* Lean Mass Area (top) */}
          <path
            d={`
              ${chartData.map((d, i) => {
                const x = (i / (chartData.length - 1)) * 400;
                const yFat = 200 - ((d.fatMass / maxTotal) * 200);
                const yTotal = 200 - (((d.fatMass + d.leanMass) / maxTotal) * 200);
                return i === 0 ? `M ${x} ${yFat}` : `L ${x} ${yFat}`;
              }).join(' ')}
              ${chartData.slice().reverse().map((d, i) => {
                const x = ((chartData.length - 1 - i) / (chartData.length - 1)) * 400;
                const yTotal = 200 - (((d.fatMass + d.leanMass) / maxTotal) * 200);
                return `L ${x} ${yTotal}`;
              }).join(' ')}
              Z
            `}
            fill="#60a5fa"
            opacity="0.7"
          />
        </svg>
        
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 -ml-8">
          <span>{maxTotal.toFixed(0)} kg</span>
          <span>{(maxTotal * 0.5).toFixed(0)} kg</span>
          <span>0 kg</span>
        </div>
      </div>
      
      {/* X-axis labels */}
      <div className="flex justify-between text-xs text-gray-500 mb-4">
        {chartData.map((d, i) => (
          <span key={i} className={i % 2 === 0 ? '' : 'hidden sm:inline'}>{d.date}</span>
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-300 rounded"></div>
          <span>Fat Mass</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-300 rounded"></div>
          <span>Lean Mass</span>
        </div>
      </div>
      
      {/* Insight */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-center">
        <p className="font-medium text-blue-900">Body Recomposition Progress</p>
        <p className="text-blue-700 mt-1">
          {fatChange < 0 && leanChange > 0 
            ? `Excellent! You're losing fat while gaining muscle.`
            : fatChange < 0
            ? `Good progress on fat loss. Focus on protein to preserve muscle.`
            : leanChange > 0
            ? `Building muscle! Consider a slight calorie deficit to reduce fat.`
            : `Keep working on your nutrition and training plan.`}
        </p>
      </div>
    </div>
  );
}

// Panel 3: VAT Reduction Progress Bar
function VATProgressBar({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <div className="text-center text-gray-500">No data available</div>;
  }

  // Get first and latest scans
  const scans = [...data].reverse(); // oldest to newest
  const firstScan = scans[0];
  const latestScan = scans[scans.length - 1];
  
  const startVAT = parseFloat(firstScan.vatArea || "0");
  const currentVAT = parseFloat(latestScan.vatArea || "0");
  
  // Set target based on starting value (aim for healthy range < 100 cm²)
  const targetVAT = startVAT > 100 ? 90 : Math.max(startVAT * 0.8, 50);
  
  // Calculate progress
  const totalReduction = startVAT - targetVAT;
  const achievedReduction = startVAT - currentVAT;
  const progressPercent = Math.min((achievedReduction / totalReduction) * 100, 100);
  const remainingReduction = Math.max(currentVAT - targetVAT, 0);
  
  // Monthly rate (if more than one scan)
  const monthsElapsed = scans.length > 1 ? scans.length - 1 : 1;
  const monthlyRate = achievedReduction / monthsElapsed;
  
  // Estimate months to goal
  const monthsToGoal = monthlyRate > 0 ? Math.ceil(remainingReduction / monthlyRate) : null;
  
  return (
    <div className="flex flex-col">
      {/* Date Range */}
      <div className="text-sm text-gray-500 mb-4 text-center">
        Journey: {new Date(firstScan.scanDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} → {new Date(latestScan.scanDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
      </div>
      
      {/* Current Status */}
      <div className="text-center mb-8">
        <div className="text-6xl font-bold text-blue-600 mb-2">
          {progressPercent.toFixed(0)}%
        </div>
        <div className="text-lg text-gray-600">Progress to Goal</div>
      </div>
      
      {/* Progress Bar */}
      <div className="relative mb-8">
        {/* Bar container */}
        <div className="h-12 bg-gray-200 rounded-full overflow-hidden relative">
          {/* Progress fill */}
          <div
            className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
          
          {/* Milestone markers */}
          <div className="absolute inset-0 flex items-center justify-between px-2">
            <span className="text-xs font-semibold text-white">Start</span>
            {progressPercent > 50 && (
              <span className="text-xs font-semibold text-white">Current</span>
            )}
            <span className="text-xs font-semibold text-gray-600">Target</span>
          </div>
        </div>
        
        {/* Value labels */}
        <div className="flex justify-between mt-2 text-sm">
          <div className="text-left">
            <div className="font-semibold">{startVAT.toFixed(1)} cm²</div>
            <div className="text-gray-500 text-xs">Starting</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-blue-600">{currentVAT.toFixed(1)} cm²</div>
            <div className="text-gray-500 text-xs">Current</div>
          </div>
          <div className="text-right">
            <div className="font-semibold">{targetVAT.toFixed(1)} cm²</div>
            <div className="text-gray-500 text-xs">Target</div>
          </div>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <div className="text-3xl font-bold text-green-600">
            {achievedReduction.toFixed(1)}
          </div>
          <div className="text-sm text-gray-600 mt-1">cm² Reduced</div>
        </div>
        
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <div className="text-3xl font-bold text-blue-600">
            {remainingReduction.toFixed(1)}
          </div>
          <div className="text-sm text-gray-600 mt-1">cm² to Goal</div>
        </div>
      </div>
      
      {/* Rate & Projection */}
      <div className="bg-gray-50 p-4 rounded-lg space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Monthly Rate:</span>
          <span className="font-semibold">
            {monthlyRate > 0 ? '-' : '+'}{Math.abs(monthlyRate).toFixed(1)} cm²/month
          </span>
        </div>
        
        {monthsToGoal !== null && monthsToGoal > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Estimated Time to Goal:</span>
            <span className="font-semibold text-blue-600">
              {monthsToGoal} {monthsToGoal === 1 ? 'month' : 'months'}
            </span>
          </div>
        )}
        
        {progressPercent >= 100 && (
          <div className="text-center text-green-600 font-semibold pt-2 border-t">
            🎉 Goal Achieved! Excellent work!
          </div>
        )}
      </div>
      
      {/* Motivation Message */}
      <div className="mt-6 text-center text-sm text-gray-600">
        {progressPercent < 25 && "You're just getting started. Stay consistent!"}
        {progressPercent >= 25 && progressPercent < 50 && "Great progress! Keep up the momentum."}
        {progressPercent >= 50 && progressPercent < 75 && "You're over halfway there! Don't stop now."}
        {progressPercent >= 75 && progressPercent < 100 && "Almost there! The finish line is in sight."}
        {progressPercent >= 100 && "Maintain your healthy lifestyle to stay in the optimal zone."}
      </div>
    </div>
  );
}

// Panel 4: Bone Density Heatmap
function BoneDensityHeatmap({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <div className="text-center text-gray-500">No BMD data available</div>;
  }

  // Get latest scan BMD data by region
  const latestData = data.filter(d => d.scanDate === data[0].scanDate);
  
  // Group by region
  const regions: Record<string, any> = {};
  latestData.forEach(item => {
    if (item.region && item.tScore) {
      regions[item.region] = {
        bmd: parseFloat(item.bmd || "0"),
        tScore: parseFloat(item.tScore || "0"),
        zScore: parseFloat(item.zScore || "0"),
      };
    }
  });
  
  // Determine color based on T-score
  const getColor = (tScore: number) => {
    if (tScore >= -1.0) return { bg: '#10b981', label: 'Strong', text: 'text-green-700' };
    if (tScore >= -2.5) return { bg: '#fbbf24', label: 'Normal', text: 'text-yellow-700' };
    return { bg: '#ef4444', label: 'Low', text: 'text-red-700' };
  };
  
  // Key regions to display
  const keyRegions = [
    { key: 'L1-L4', label: 'Lumbar Spine', icon: '🦴' },
    { key: 'Femoral Neck', label: 'Femoral Neck', icon: '🦵' },
    { key: 'Total Hip', label: 'Total Hip', icon: '🦵' },
    { key: 'Total Body', label: 'Total Body', icon: '🧑' },
  ];
  
  return (
    <div className="flex flex-col">
      {/* Scan Date */}
      <div className="text-sm text-gray-500 mb-4 text-center">
        Latest Scan: {new Date(data[0].scanDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>
      
      {/* Simplified Body Diagram */}
      <div className="flex justify-center mb-8">
        <svg width="200" height="400" viewBox="0 0 200 400" className="">
          {/* Head */}
          <circle cx="100" cy="30" r="25" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="2" />
          
          {/* Spine (L1-L4 region) */}
          <rect
            x="90"
            y="70"
            width="20"
            height="80"
            fill={regions['L1-L4'] ? getColor(regions['L1-L4'].tScore).bg : '#e5e7eb'}
            stroke="#9ca3af"
            strokeWidth="2"
            rx="4"
          />
          <text x="100" y="115" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">L1-L4</text>
          
          {/* Pelvis */}
          <ellipse cx="100" cy="180" rx="50" ry="30" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="2" />
          
          {/* Left Hip */}
          <circle
            cx="70"
            cy="200"
            r="20"
            fill={regions['Total Hip'] || regions['Femoral Neck'] ? getColor((regions['Total Hip'] || regions['Femoral Neck']).tScore).bg : '#e5e7eb'}
            stroke="#9ca3af"
            strokeWidth="2"
          />
          <text x="70" y="205" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">Hip</text>
          
          {/* Right Hip */}
          <circle
            cx="130"
            cy="200"
            r="20"
            fill={regions['Total Hip'] || regions['Femoral Neck'] ? getColor((regions['Total Hip'] || regions['Femoral Neck']).tScore).bg : '#e5e7eb'}
            stroke="#9ca3af"
            strokeWidth="2"
          />
          <text x="130" y="205" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">Hip</text>
          
          {/* Legs */}
          <rect x="75" y="220" width="15" height="150" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="2" rx="4" />
          <rect x="110" y="220" width="15" height="150" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="2" rx="4" />
        </svg>
      </div>
      
      {/* Region Cards */}
      <div className="space-y-3 mb-6">
        {keyRegions.map(region => {
          const data = regions[region.key];
          if (!data) return null;
          
          const colorInfo = getColor(data.tScore);
          
          return (
            <div key={region.key} className="bg-gray-50 p-4 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{region.icon}</span>
                <div>
                  <div className="font-semibold">{region.label}</div>
                  <div className="text-sm text-gray-500">T-Score: {data.tScore.toFixed(2)}</div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className="px-3 py-1 rounded-full text-sm font-semibold"
                  style={{ backgroundColor: colorInfo.bg, color: 'white' }}
                >
                  {colorInfo.label}
                </div>
                <div className="text-xs text-gray-500 mt-1">{data.bmd.toFixed(3)} g/cm²</div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="text-sm font-semibold mb-3 text-center">T-Score Reference</div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }}></div>
              <span>Strong</span>
            </div>
            <span className="text-gray-500">T-Score ≥ -1.0</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#fbbf24' }}></div>
              <span>Normal</span>
            </div>
            <span className="text-gray-500">-2.5 ≤ T-Score &lt; -1.0</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }}></div>
              <span>Low (Osteopenia)</span>
            </div>
            <span className="text-gray-500">T-Score &lt; -2.5</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Panel 5: Metabolic Health Score
function MetabolicHealthScore({ data }: { data: any }) {
  if (!data) {
    return <div className="text-center text-gray-500">No data available</div>;
  }

  const vatArea = parseFloat(data.vatArea || "0");
  const bodyFatPercent = parseFloat(data.totalBodyFatPercent || "0");
  const leanMass = parseFloat(data.totalLeanMass || "0");
  const fatMass = parseFloat(data.totalFatMass || "0");
  const leanToFatRatio = fatMass > 0 ? leanMass / fatMass : 0;
  
  // Calculate score (0-100)
  let score = 100;
  let factors: { name: string; impact: string; points: number }[] = [];
  
  // VAT Area (max -40 points)
  if (vatArea > 150) {
    score -= 40;
    factors.push({ name: 'Visceral Fat', impact: 'High risk level', points: -40 });
  } else if (vatArea > 100) {
    score -= 20;
    factors.push({ name: 'Visceral Fat', impact: 'Elevated level', points: -20 });
  } else {
    factors.push({ name: 'Visceral Fat', impact: 'Healthy range', points: 0 });
  }
  
  // Body Fat % (max -30 points, gender-adjusted)
  if (bodyFatPercent > 30) {
    score -= 30;
    factors.push({ name: 'Body Fat %', impact: 'Above healthy range', points: -30 });
  } else if (bodyFatPercent > 25) {
    score -= 15;
    factors.push({ name: 'Body Fat %', impact: 'Slightly elevated', points: -15 });
  } else {
    factors.push({ name: 'Body Fat %', impact: 'Healthy range', points: 0 });
  }
  
  // Lean to Fat Ratio (max -30 points)
  if (leanToFatRatio < 1.5) {
    score -= 30;
    factors.push({ name: 'Lean/Fat Ratio', impact: 'Low muscle mass', points: -30 });
  } else if (leanToFatRatio < 2.5) {
    score -= 15;
    factors.push({ name: 'Lean/Fat Ratio', impact: 'Moderate ratio', points: -15 });
  } else {
    factors.push({ name: 'Lean/Fat Ratio', impact: 'Excellent ratio', points: 0 });
  }
  
  // Determine zone
  let zone = 'Optimal';
  let zoneColor = '#10b981';
  let zoneEmoji = '🌟';
  
  if (score < 50) {
    zone = 'At Risk';
    zoneColor = '#ef4444';
    zoneEmoji = '⚠️';
  } else if (score < 70) {
    zone = 'Fair';
    zoneColor = '#f59e0b';
    zoneEmoji = '🔶';
  } else if (score < 85) {
    zone = 'Good';
    zoneColor = '#3b82f6';
    zoneEmoji = '✅';
  }
  
  return (
    <div className="flex flex-col items-center">
      {/* Scan Date */}
      <div className="text-sm text-gray-500 mb-4">
        Based on scan: {new Date(data.scanDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>
      
      {/* Main Score */}
      <div className="text-center mb-8">
        <div className="text-8xl font-bold mb-2" style={{ color: zoneColor }}>
          {Math.round(score)}
        </div>
        <div className="text-2xl text-gray-600">Metabolic Health Score</div>
      </div>
      
      {/* Zone Badge */}
      <div
        className="px-6 py-3 rounded-full text-white text-xl font-bold mb-8 flex items-center gap-2"
        style={{ backgroundColor: zoneColor }}
      >
        <span>{zoneEmoji}</span>
        <span>{zone}</span>
      </div>
      
      {/* Key Metrics */}
      <div className="w-full space-y-3 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
          <span className="text-sm font-medium">Visceral Fat</span>
          <span className="font-bold">{vatArea.toFixed(1)} cm²</span>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
          <span className="text-sm font-medium">Body Fat %</span>
          <span className="font-bold">{bodyFatPercent.toFixed(1)}%</span>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
          <span className="text-sm font-medium">Lean/Fat Ratio</span>
          <span className="font-bold">{leanToFatRatio.toFixed(2)}:1</span>
        </div>
      </div>
      
      {/* Factor Breakdown */}
      <div className="w-full bg-blue-50 p-4 rounded-lg">
        <div className="font-semibold mb-3 text-center">Score Breakdown</div>
        <div className="space-y-2">
          {factors.map((factor, idx) => (
            <div key={idx} className="flex justify-between items-center text-sm">
              <div>
                <div className="font-medium">{factor.name}</div>
                <div className="text-gray-600 text-xs">{factor.impact}</div>
              </div>
              <div className={`font-bold ${factor.points < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {factor.points === 0 ? '✓' : factor.points}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Zone Reference */}
      <div className="mt-6 w-full bg-gray-50 p-4 rounded-lg text-sm">
        <div className="font-semibold mb-2 text-center">Health Zones</div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>🌟 Optimal</span>
            <span className="text-gray-500">85-100</span>
          </div>
          <div className="flex justify-between">
            <span>✅ Good</span>
            <span className="text-gray-500">70-84</span>
          </div>
          <div className="flex justify-between">
            <span>🔶 Fair</span>
            <span className="text-gray-500">50-69</span>
          </div>
          <div className="flex justify-between">
            <span>⚠️ At Risk</span>
            <span className="text-gray-500">0-49</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Panel 6: Monthly Progress Summary
function MonthlyProgressSummary({ bodyComp, bmd }: { bodyComp: any[]; bmd: any[] }) {
  if (!bodyComp || bodyComp.length === 0) {
    return <div className="text-center text-gray-500">No data available</div>;
  }

  // Reverse to show oldest to newest
  const scans = [...bodyComp].reverse();
  
  // Calculate month-over-month changes
  const timeline = scans.map((scan, idx) => {
    const prevScan = idx > 0 ? scans[idx - 1] : null;
    
    return {
      date: new Date(scan.scanDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      vatArea: parseFloat(scan.vatArea || "0"),
      vatChange: prevScan ? parseFloat(scan.vatArea || "0") - parseFloat(prevScan.vatArea || "0") : 0,
      bodyFat: parseFloat(scan.totalBodyFatPercent || "0"),
      bodyFatChange: prevScan ? parseFloat(scan.totalBodyFatPercent || "0") - parseFloat(prevScan.totalBodyFatPercent || "0") : 0,
      leanMass: parseFloat(scan.totalLeanMass || "0"),
      leanMassChange: prevScan ? parseFloat(scan.totalLeanMass || "0") - parseFloat(prevScan.totalLeanMass || "0") : 0,
      isFirst: idx === 0,
    };
  });
  
  // Get total BMD for each scan
  const bmdByDate: Record<string, number> = {};
  bmd.forEach(item => {
    if (item.region === 'Total Body' && item.bmd) {
      const dateKey = new Date(item.scanDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      bmdByDate[dateKey] = parseFloat(item.bmd);
    }
  });
  
  return (
    <div className="flex flex-col">
      {/* Summary Header */}
      <div className="text-center mb-6">
        <div className="text-3xl font-bold mb-2">Your DEXA Journey</div>
        <div className="text-gray-600">{scans.length} scans tracked</div>
        <div className="text-sm text-gray-500 mt-1">
          {new Date(scans[0].scanDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - {new Date(scans[scans.length - 1].scanDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </div>
      </div>
      
      {/* Timeline */}
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {timeline.map((entry, idx) => (
          <div key={idx} className="relative pl-8 pb-6 border-l-2 border-blue-300 last:border-l-0">
            {/* Timeline dot */}
            <div className="absolute left-0 top-0 -ml-2 w-4 h-4 rounded-full bg-blue-500 border-2 border-white"></div>
            
            {/* Date */}
            <div className="text-sm font-semibold text-blue-600 mb-2">{entry.date}</div>
            
            {/* Metrics Grid */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              {/* VAT Area */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Visceral Fat</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{entry.vatArea.toFixed(1)} cm²</span>
                  {!entry.isFirst && (
                    <span className={`text-xs ${entry.vatChange <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {entry.vatChange <= 0 ? '↓' : '↑'} {Math.abs(entry.vatChange).toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Body Fat % */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Body Fat %</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{entry.bodyFat.toFixed(1)}%</span>
                  {!entry.isFirst && (
                    <span className={`text-xs ${entry.bodyFatChange <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {entry.bodyFatChange <= 0 ? '↓' : '↑'} {Math.abs(entry.bodyFatChange).toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Lean Mass */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Lean Mass</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{entry.leanMass.toFixed(1)} kg</span>
                  {!entry.isFirst && (
                    <span className={`text-xs ${entry.leanMassChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {entry.leanMassChange >= 0 ? '↑' : '↓'} {Math.abs(entry.leanMassChange).toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
              
              {/* BMD if available */}
              {bmdByDate[entry.date] && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total BMD</span>
                  <span className="font-semibold">{bmdByDate[entry.date].toFixed(3)} g/cm²</span>
                </div>
              )}
            </div>
            
            {/* Milestone badge */}
            {idx === 0 && (
              <div className="mt-2 inline-block bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                🎉 Starting Point
              </div>
            )}
            {idx === timeline.length - 1 && idx > 0 && (
              <div className="mt-2 inline-block bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                🎯 Current Status
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Overall Progress Summary */}
      {timeline.length > 1 && (
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg">
          <div className="font-semibold mb-2 text-center">Total Progress</div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <div className={`font-bold ${timeline[timeline.length - 1].vatArea < timeline[0].vatArea ? 'text-green-600' : 'text-gray-600'}`}>
                {(timeline[0].vatArea - timeline[timeline.length - 1].vatArea).toFixed(1)}
              </div>
              <div className="text-xs text-gray-600">VAT Reduced (cm²)</div>
            </div>
            <div>
              <div className={`font-bold ${timeline[timeline.length - 1].bodyFat < timeline[0].bodyFat ? 'text-green-600' : 'text-gray-600'}`}>
                {(timeline[0].bodyFat - timeline[timeline.length - 1].bodyFat).toFixed(1)}
              </div>
              <div className="text-xs text-gray-600">Fat % Reduced</div>
            </div>
            <div>
              <div className={`font-bold ${timeline[timeline.length - 1].leanMass > timeline[0].leanMass ? 'text-green-600' : 'text-gray-600'}`}>
                {(timeline[timeline.length - 1].leanMass - timeline[0].leanMass).toFixed(1)}
              </div>
              <div className="text-xs text-gray-600">Lean Gained (kg)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RawDataDrawer({ clientId, onClose }: { clientId: number; onClose: () => void }) {
  const { data: scans } = trpc.dexa.getClientScans.useQuery({ clientId });
  const approvedScans = scans?.filter(s => s.status === 'approved') || [];
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end" onClick={onClose}>
      <div
        className="bg-white w-full max-h-[80vh] rounded-t-2xl p-6 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Raw DEXA Data</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        
        {approvedScans.length === 0 ? (
          <p className="text-gray-500">No approved scans available</p>
        ) : (
          <div className="space-y-6">
            {approvedScans.map((scan) => (
              <ScanDataSection key={scan.id} scanId={scan.id} scanDate={scan.scanDate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScanDataSection({ scanId, scanDate }: { scanId: number; scanDate: Date }) {
  const [expanded, setExpanded] = useState(false);
  const { data: scanDetails } = trpc.dexa.getScanDetails.useQuery({ scanId }, { enabled: expanded });
  
  return (
    <div className="border rounded-lg p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex justify-between items-center text-left"
      >
        <div>
          <div className="font-semibold">
            Scan: {new Date(scanDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <div className="text-sm text-gray-500">Click to {expanded ? 'hide' : 'view'} details</div>
        </div>
        <ChevronRight className={`w-5 h-5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      
      {expanded && scanDetails && (
        <div className="mt-4 space-y-4">
          {/* Extracted Images */}
          {scanDetails.images && scanDetails.images.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Extracted Images</h4>
              <div className="grid grid-cols-2 gap-2">
                {scanDetails.images.map((img: any, idx: number) => (
                  <div key={idx} className="border rounded p-2">
                    <img src={img.imageUrl} alt={img.imageType} className="w-full h-auto" />
                    <p className="text-xs text-gray-500 mt-1">{formatImageType(img.imageType)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Body Composition Data */}
          {scanDetails.bodyComp && (
            <div>
              <h4 className="font-semibold mb-2">Body Composition</h4>
              <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Total Fat Mass:</span>
                  <span className="font-medium">{scanDetails.bodyComp.totalFatMass} kg</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Lean Mass:</span>
                  <span className="font-medium">{scanDetails.bodyComp.totalLeanMass} kg</span>
                </div>
                <div className="flex justify-between">
                  <span>Body Fat %:</span>
                  <span className="font-medium">{scanDetails.bodyComp.totalBodyFatPct}%</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT Area:</span>
                  <span className="font-medium">{scanDetails.bodyComp.vatArea} cm²</span>
                </div>
              </div>
            </div>
          )}
          
          {/* BMD Data */}
          {scanDetails.bmdData && scanDetails.bmdData.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Bone Mineral Density</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left p-2">Region</th>
                      <th className="text-right p-2">BMD (g/cm²)</th>
                      <th className="text-right p-2">T-Score</th>
                      <th className="text-right p-2">Z-Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanDetails.bmdData.map((row: any, idx: number) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{row.region}</td>
                        <td className="text-right p-2">{row.bmd}</td>
                        <td className="text-right p-2">{row.tScore}</td>
                        <td className="text-right p-2">{row.zScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* PDF Link */}
          {scanDetails.scan?.pdfUrl && (
            <div>
              <a
                href={scanDetails.scan.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm flex items-center gap-1"
              >
                <Database className="w-4 h-4" />
                View Original PDF
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatImageType(type: string): string {
  const labels: Record<string, string> = {
    body_scan_colorized: "Body Scan (Color)",
    body_scan_grayscale: "Body Scan (Skeletal)",
    fracture_risk_chart: "Fracture Risk Chart",
    body_fat_chart: "Body Fat % Chart",
  };
  return labels[type] || type;
}
