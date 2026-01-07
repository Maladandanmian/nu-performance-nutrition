import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { NutritionHistoryFeed } from "@/components/NutritionHistoryFeed";
import { NutrientTrendGraphs } from "@/components/NutrientTrendGraphs";
import TodaysSummary from "@/components/TodaysSummary";
import { PhotoGuidelinesModal } from "@/components/PhotoGuidelinesModal";
import { ComponentEditor } from "@/components/ComponentEditor";
import { AddComponentForm } from "@/components/AddComponentForm";
import { Camera, Droplets, History, LogOut, Scale, Upload } from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useClientAuth } from "@/hooks/useClientAuth";
import { fromHongKongDateTimeLocal } from "@/lib/timezone";
import { BodyweightTrendChart } from "@/components/BodyweightTrendChart";

// Helper function to determine meal type based on current time
const getMealTypeFromTime = (): "breakfast" | "lunch" | "dinner" | "snack" => {
  const now = new Date();
  const hongKongTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
  const hour = hongKongTime.getHours();
  
  // Breakfast: 5am - 10am
  if (hour >= 5 && hour < 11) return 'breakfast';
  // Lunch: 11am - 2pm
  if (hour >= 11 && hour < 15) return 'lunch';
  // Dinner: 5pm - 9pm
  if (hour >= 17 && hour < 22) return 'dinner';
  // Snack: all other times
  return 'snack';
};

export default function ClientDashboard() {
  // ALL HOOKS MUST BE CALLED AT THE TOP BEFORE ANY RETURNS
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { clientSession, loading: clientLoading, logout: clientLogout } = useClientAuth();
  const [, setLocation] = useLocation();
  
  // Fetch goals data for bodyweight trend
  const timezoneOffset = new Date().getTimezoneOffset();
  const { data: goalsData } = trpc.meals.dailyTotals.useQuery(
    { 
      clientId: clientSession?.clientId || 0, 
      days: 1,
      timezoneOffset
    },
    { enabled: !!clientSession?.clientId }
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mealType, setMealType] = useState<"breakfast" | "lunch" | "dinner" | "snack">(() => getMealTypeFromTime());
  const [mealNotes, setMealNotes] = useState("");
  const [drinkType, setDrinkType] = useState("");
  const [volumeMl, setVolumeMl] = useState("");
  const [drinkDateTime, setDrinkDateTime] = useState(() => {
    const now = new Date();
    const hongKongTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
    const year = hongKongTime.getFullYear();
    const month = String(hongKongTime.getMonth() + 1).padStart(2, '0');
    const day = String(hongKongTime.getDate()).padStart(2, '0');
    const hours = String(hongKongTime.getHours()).padStart(2, '0');
    const minutes = String(hongKongTime.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  const [mealDateTime, setMealDateTime] = useState(() => {
    const now = new Date();
    const hongKongTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
    const year = hongKongTime.getFullYear();
    const month = String(hongKongTime.getMonth() + 1).padStart(2, '0');
    const day = String(hongKongTime.getDate()).padStart(2, '0');
    const hours = String(hongKongTime.getHours()).padStart(2, '0');
    const minutes = String(hongKongTime.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  const [justLoggedDrinkId, setJustLoggedDrinkId] = useState<number | null>(null);
  const [weight, setWeight] = useState("");
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [showPhotoGuide, setShowPhotoGuide] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedComponents, setEditedComponents] = useState<any[]>([]);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageKey, setImageKey] = useState<string>("");
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [improvementAdvice, setImprovementAdvice] = useState<string>("");
  const [showAdvice, setShowAdvice] = useState(false);
  const [editingMealId, setEditingMealId] = useState<number | null>(null);
  const [beverageNutrition, setBeverageNutrition] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate totals from edited components + beverage
  const calculatedTotals = useMemo(() => {
    let mealTotals;
    if (editedComponents.length === 0) {
      mealTotals = {
        calories: analysisResult?.calories || 0,
        protein: analysisResult?.protein || 0,
        fat: analysisResult?.fat || 0,
        carbs: analysisResult?.carbs || 0,
        fibre: analysisResult?.fibre || 0,
      };
    } else {
      mealTotals = editedComponents.reduce(
        (totals, component) => ({
          calories: totals.calories + (component.calories || 0),
          protein: totals.protein + (component.protein || 0),
          fat: totals.fat + (component.fat || 0),
          carbs: totals.carbs + (component.carbs || 0),
          fibre: totals.fibre + (component.fibre || 0),
        }),
        { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 }
      );
    }

    // Add beverage nutrition if available
    if (beverageNutrition) {
      return {
        calories: mealTotals.calories + (beverageNutrition.calories || 0),
        protein: mealTotals.protein + (beverageNutrition.protein || 0),
        fat: mealTotals.fat + (beverageNutrition.fat || 0),
        carbs: mealTotals.carbs + (beverageNutrition.carbs || 0),
        fibre: mealTotals.fibre + (beverageNutrition.fibre || 0),
      };
    }

    return mealTotals;
  }, [editedComponents, analysisResult, beverageNutrition]);

  // ALL TRPC HOOKS MUST BE CALLED UNCONDITIONALLY
  const uploadAndAnalyzeMutation = trpc.meals.uploadAndAnalyze.useMutation({
    onSuccess: (data) => {
      setAnalysisResult(data.analysis);
      setEditedComponents((data.analysis as any).components || []);
      setImageUrl(data.imageUrl);
      setImageKey(data.imageKey);
      setIsEditMode(false);
      setShowAnalysisModal(true);
      // Reset all form fields
      setSelectedFile(null);
      setMealType("lunch");
      setMealNotes("");
      setDrinkType("");
      setVolumeMl("");
      setBeverageNutrition(null);
      // Reset file input element
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    onError: (error) => {
      toast.error(`Failed to analyze meal: ${error.message}`);
    },
  });

  const utils = trpc.useUtils();
  
  const deleteMealMutation = trpc.meals.delete.useMutation({
    onSuccess: () => {
      toast.success("Meal deleted successfully!");
      utils.meals.list.invalidate();
      utils.meals.dailyTotals.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete meal: ${error.message}`);
    },
  });

  const updateMealMutation = trpc.meals.update.useMutation({
    onSuccess: () => {
      toast.success("Meal updated successfully!");
      setShowAnalysisModal(false);
      setIsEditMode(false);
      setShowAdvice(false);
      setImprovementAdvice("");
      setEditingMealId(null);
      utils.meals.list.invalidate();
      utils.meals.dailyTotals.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to update meal: ${error.message}`);
    },
  });
  
  const recalculateScoreMutation = trpc.meals.recalculateScore.useMutation({
    onSuccess: (data) => {
      if (data.success && analysisResult) {
        setAnalysisResult({
          ...analysisResult,
          score: data.score,
        });
        toast.success('Meal score updated');
      }
    },
  });

  const saveMealMutation = trpc.meals.saveMeal.useMutation({
    onSuccess: () => {
      toast.success('Meal logged successfully!');
      setShowAnalysisModal(false);
      setIsEditMode(false);
      setShowAdvice(false);
      setImprovementAdvice("");
      // Invalidate queries to refresh meal history and daily totals
      utils.meals.list.invalidate();
      utils.meals.dailyTotals.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to save meal: ${error.message}`);
    },
  });

  const getAdviceMutation = trpc.meals.getImprovementAdvice.useMutation({
    onSuccess: (data) => {
      setImprovementAdvice(data.advice);
      setShowAdvice(true);
    },
    onError: (error) => {
      toast.error(`Failed to generate advice: ${error.message}`);
    },
  });

  const estimateBeverageMutation = trpc.meals.estimateBeverage.useMutation({
    onSuccess: (data) => {
      setBeverageNutrition(data.nutrition);
      toast.success('Beverage estimated successfully!');
    },
    onError: (error) => {
      toast.error(`Failed to estimate beverage: ${error.message}`);
    },
  });

  const logDrinkMutation = trpc.drinks.create.useMutation({
    onSuccess: (data) => {
      toast.success("Drink logged successfully!");
      // Store the drink ID for potential editing in summary modal
      if (data && data.drinkId) {
        setJustLoggedDrinkId(data.drinkId);
      }
      // Don't clear form yet - user might want to edit in summary modal
      // Refetch today's summary to update hydration
      // Show summary instead of reloading
    },
    onError: (error) => {
      toast.error(`Failed to log drink: ${error.message}`);
    },
  });

  const deleteDrinkMutation = trpc.drinks.delete.useMutation({
    onSuccess: () => {
      toast.success("Drink deleted successfully!");
      utils.drinks.list.invalidate();
      utils.meals.dailyTotals.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete drink: ${error.message}`);
    },
  });

  const updateDrinkMutation = trpc.drinks.update.useMutation({
    onSuccess: () => {
      toast.success("Drink updated successfully!");
      setShowAnalysisModal(false);
      setDrinkType("");
      setVolumeMl("");
      setBeverageNutrition(null);
      setEditingMealId(null);
      utils.drinks.list.invalidate();
      utils.meals.dailyTotals.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to update drink: ${error.message}`);
    },
  });

  const logMetricsMutation = trpc.bodyMetrics.create.useMutation({
    onSuccess: () => {
      toast.success("Metrics logged successfully!");
      setWeight("");
      // Invalidate bodyMetrics query to refetch data in the graph
      utils.bodyMetrics.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to log metrics: ${error.message}`);
    },
  });

  // Redirect non-authenticated users (both OAuth and PIN)
  useEffect(() => {
    if (!loading && !clientLoading && !isAuthenticated && !clientSession) {
      setLocation('/');
    }
  }, [loading, clientLoading, isAuthenticated, clientSession, setLocation]);

  // Redirect trainers to trainer dashboard
  useEffect(() => {
    if (user?.role === 'admin') {
      setLocation('/trainer');
    }
  }, [user, setLocation]);

  // NOW WE CAN SAFELY DO EARLY RETURNS AFTER ALL HOOKS ARE CALLED
  
  // Show loading while checking auth
  if (loading || clientLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Return null if not authenticated (will redirect via useEffect)
  if (!isAuthenticated && !clientSession) {
    return null;
  }

  // Use client session if available, otherwise use OAuth user
  const displayName = clientSession?.name || user?.name || "Client";
  const currentClientId = clientSession?.clientId || 1; // Default to 1 for demo
  const handleLogoutClick = clientSession ? clientLogout : logout;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleLogMeal = async () => {
    // Auto-estimate beverage if fields filled but not estimated yet
    let nutritionToUse = beverageNutrition;
    if (drinkType && volumeMl && !beverageNutrition) {
      // Special handling for plain water - no API call needed
      if (drinkType.toLowerCase().trim() === 'water') {
        const waterNutrition = {
          drinkType: 'Water',
          volumeMl: parseInt(volumeMl),
          calories: 0,
          protein: 0,
          fat: 0,
          carbs: 0,
          fibre: 0,
          confidence: 100,
          description: 'Plain water has no calories or nutrients'
        };
        setBeverageNutrition(waterNutrition);
        nutritionToUse = waterNutrition;
      } else {
        try {
          const result = await estimateBeverageMutation.mutateAsync({
            drinkType,
            volumeMl: parseInt(volumeMl),
          });
          setBeverageNutrition(result.nutrition);
          nutritionToUse = result.nutrition; // Use the nutrition object from the result
        } catch (error) {
          toast.error("Failed to estimate beverage nutrition");
          return;
        }
      }
    }

    // Drink-only logging
    if (!selectedFile && (nutritionToUse || (drinkType && volumeMl))) {
      if (!drinkType || !volumeMl) {
        toast.error("Please fill in drink type and volume");
        return;
      }
      
      if (!nutritionToUse) {
        toast.error("Please estimate beverage nutrition first");
        return;
      }
      
      // For beverage-only, create a drink entry (not a meal entry)
      try {
        await logDrinkMutation.mutateAsync({
          clientId: currentClientId,
          drinkType,
          volumeMl: parseInt(volumeMl),
          calories: nutritionToUse.calories,
          protein: nutritionToUse.protein,
          fat: nutritionToUse.fat,
          carbs: nutritionToUse.carbs,
          fibre: nutritionToUse.fibre,
          notes: "",
        });
        
        // Store drink details before clearing
        const currentDrinkType = drinkType;
        const currentVolumeMl = volumeMl;
        
        // Clear form
        setDrinkType("");
        setVolumeMl("");
        setBeverageNutrition(null);
        
        toast.success("Beverage logged successfully!");
        // Show summary modal with drink nutrition
        // Score drinks 1-5: low-cal drinks score higher (5 is best)
        const drinkScore = nutritionToUse.calories < 50 ? 5 : nutritionToUse.calories < 100 ? 4 : nutritionToUse.calories < 150 ? 3 : nutritionToUse.calories < 200 ? 2 : 1;
        setAnalysisResult({
          description: currentDrinkType,
          calories: nutritionToUse.calories,
          protein: nutritionToUse.protein,
          fat: nutritionToUse.fat,
          carbs: nutritionToUse.carbs,
          fibre: nutritionToUse.fibre,
          score: drinkScore,
          isDrink: true,
          drinkType: currentDrinkType,
          volumeMl: currentVolumeMl,
        });
        // Set the modal state variables with the drink details
        setDrinkType(currentDrinkType);
        setVolumeMl(currentVolumeMl);
        setShowAnalysisModal(true);
      } catch (error) {
        console.error('Error logging beverage:', error);
        toast.error("Failed to log beverage");
      }
      return;
    }

    // Meal logging (with or without beverage)
    if (!selectedFile) {
      toast.error("Please select an image or add a beverage");
      return;
    }

    const clientId = currentClientId;

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1]; // Remove data:image/jpeg;base64, prefix

        await uploadAndAnalyzeMutation.mutateAsync({
          clientId,
          imageBase64: base64Data,
          mealType,
          notes: mealNotes || undefined,
        });
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error('Error uploading meal:', error);
    }
  };

  const handleLogDrink = async () => {
    if (!drinkType || !volumeMl) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!beverageNutrition) {
      toast.error("Please estimate beverage nutrition first");
      return;
    }

    const clientId = clientSession?.clientId;
    if (!clientId) {
      toast.error("Client session not found");
      return;
    }

    await logDrinkMutation.mutateAsync({
      clientId,
      drinkType,
      volumeMl: parseInt(volumeMl),
      calories: beverageNutrition.calories,
      protein: beverageNutrition.protein,
      fat: beverageNutrition.fat,
      carbs: beverageNutrition.carbs,
      fibre: beverageNutrition.fibre,
    });
  };

  const handleLogMetrics = async () => {
    if (!weight) {
      toast.error("Please enter weight");
      return;
    }

    const clientId = clientSession?.clientId;
    if (!clientId) {
      toast.error("Client session not found");
      return;
    }

    await logMetricsMutation.mutateAsync({
      clientId,
      weight: weight ? parseFloat(weight) : undefined,
    });
  };

  const handleLogout = async () => {
    await logout();
    setLocation('/');
  };

  const handleDeleteMeal = async (mealId: number) => {
    if (confirm("Are you sure you want to delete this meal? This action cannot be undone.")) {
      await deleteMealMutation.mutateAsync({ mealId });
    }
  };

  const handleEditMeal = (meal: any) => {
    // Populate the analysis modal with the meal data
    setAnalysisResult({
      description: meal.aiDescription,
      calories: meal.calories,
      protein: meal.protein,
      fat: meal.fat,
      carbs: meal.carbs,
      fibre: meal.fibre,
      confidence: meal.aiConfidence,
      components: [], // We'll need to fetch components if stored
      score: meal.nutritionScore,
    });
    setEditedComponents([]); // Initialize empty, will need to parse from meal data
    setImageUrl(meal.imageUrl || "");
    setImageKey(meal.imageKey || "");
    setIsEditMode(true);
    setShowAnalysisModal(true);
    setEditingMealId(meal.id);
    setMealType(meal.mealType);
    
    // Set meal date/time from loggedAt
    if (meal.loggedAt) {
      const mealDate = new Date(meal.loggedAt);
      const hongKongTime = new Date(mealDate.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
      const year = hongKongTime.getFullYear();
      const month = String(hongKongTime.getMonth() + 1).padStart(2, '0');
      const day = String(hongKongTime.getDate()).padStart(2, '0');
      const hours = String(hongKongTime.getHours()).padStart(2, '0');
      const minutes = String(hongKongTime.getMinutes()).padStart(2, '0');
      setMealDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
    }
    
    // Set beverage data if present
    if (meal.beverageType) {
      setDrinkType(meal.beverageType);
      setVolumeMl(meal.beverageVolumeMl?.toString() || "");
      // Set beverage nutrition from meal data
      setBeverageNutrition({
        drinkType: meal.beverageType,
        volumeMl: meal.beverageVolumeMl,
        calories: meal.beverageCalories || 0,
        protein: meal.beverageProtein || 0,
        fat: meal.beverageFat || 0,
        carbs: meal.beverageCarbs || 0,
        fibre: meal.beverageFibre || 0,
      });
    } else {
      // Clear beverage fields if no beverage
      setDrinkType("");
      setVolumeMl("");
      setBeverageNutrition(null);
    }
  };

  const handleEditDrink = (drink: any) => {
    // Set drink data for editing
    setDrinkType(drink.drinkType);
    setVolumeMl(drink.volumeMl.toString());
    setBeverageNutrition({
      drinkType: drink.drinkType,
      volumeMl: drink.volumeMl,
      calories: drink.calories,
      protein: drink.protein,
      fat: drink.fat,
      carbs: drink.carbs,
      fibre: drink.fibre,
    });
    // Set analysis result for the modal
    // Score drinks 1-5: low-cal drinks score higher (5 is best)
    const drinkScore = drink.calories < 50 ? 5 : drink.calories < 100 ? 4 : drink.calories < 150 ? 3 : drink.calories < 200 ? 2 : 1;
    setAnalysisResult({
      description: drink.drinkType,
      calories: drink.calories,
      protein: drink.protein,
      fat: drink.fat,
      carbs: drink.carbs,
      fibre: drink.fibre,
      score: drinkScore,
      isDrink: true,
    });
    // Mark as editing drink
    setEditingMealId(-drink.id);
    setShowAnalysisModal(true);
  };

  const handleDeleteDrink = async (drinkId: number) => {
    if (confirm("Are you sure you want to delete this drink? This action cannot be undone.")) {
      await deleteDrinkMutation.mutateAsync({ drinkId });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/nu-logo.png" alt="Nu Performance" className="h-12 w-auto" />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm" style={{color: '#6F6E70'}}>{displayName}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogoutClick}
              style={{borderColor: '#578DB3', color: '#578DB3'}}
              className="hover:bg-blue-50"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Today's Summary Widget */}
          <TodaysSummary clientId={clientSession?.clientId || 0} />
          
          <Tabs defaultValue="log-meal">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="log-meal">Log Meal</TabsTrigger>
            <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="log-metrics">Metrics</TabsTrigger>
          </TabsList>

          {/* Log Meal Tab */}
          <TabsContent value="log-meal">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Log Your Meal
                </CardTitle>
                <CardDescription>
                  Take a photo or select from gallery for AI analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="meal-image">Meal Photo</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPhotoGuide(true)}
                      className="text-xs"
                    >
                      <Camera className="h-3 w-3 mr-1" />
                      Photo Tips
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center gap-4">
                    <Input
                      id="meal-image"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="flex-1"
                      ref={fileInputRef}
                    />
                    {selectedFile && (
                      <span className="text-sm text-gray-600">{selectedFile.name}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Include a credit card, business card, or Octopus card for accurate portion sizing
                  </p>
                </div>

                <div>
                  <Label htmlFor="meal-type">Meal Type</Label>
                  <Select value={mealType} onValueChange={(value: any) => setMealType(value)}>
                    <SelectTrigger id="meal-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="breakfast">Breakfast</SelectItem>
                      <SelectItem value="lunch">Lunch</SelectItem>
                      <SelectItem value="dinner">Dinner</SelectItem>
                      <SelectItem value="snack">Snack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="meal-notes">Notes (optional)</Label>
                  <Textarea
                    id="meal-notes"
                    placeholder="Any additional notes about this meal..."
                    value={mealNotes}
                    onChange={(e) => setMealNotes(e.target.value)}
                  />
                </div>

                {/* Beverage Section */}
                <div className="border-t pt-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-blue-500" />
                    <Label className="text-base font-semibold">Add Beverage</Label>
                  </div>
                  <p className="text-xs text-gray-500">
                    💡 Log a drink, a meal, or both together
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="drink-type">Drink Type</Label>
                      <Input
                        id="drink-type"
                        placeholder="e.g., Cappuccino, Soda"
                        value={drinkType}
                        onChange={(e) => setDrinkType(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="volume">Volume (ml)</Label>
                      <Input
                        id="volume"
                        type="number"
                        placeholder="e.g., 250"
                        value={volumeMl}
                        onChange={(e) => setVolumeMl(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  {/* Volume Reference Guide */}
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-700 mb-2">Quick Reference:</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                      <div>• Glass = 250ml</div>
                      <div>• Mug = 250ml</div>
                      <div>• Water Bottle = 500ml</div>
                      <div>• Can = 330ml</div>
                      <div>• Wine Glass = 150ml</div>
                      <div>• Shot = 30ml</div>
                    </div>
                  </div>

                </div>

                <Button 
                  onClick={handleLogMeal} 
                  className="w-full"
                  disabled={uploadAndAnalyzeMutation.isPending || (!selectedFile && !(drinkType && volumeMl))}
                >
                  {uploadAndAnalyzeMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Analyze
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Nutrition History Tab (Meals + Drinks) */}
          <TabsContent value="nutrition">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Nutrition History
                </CardTitle>
                <CardDescription>
                  View and edit all your logged meals and drinks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <NutritionHistoryFeed 
                  clientId={clientSession?.clientId || 0} 
                  onEditMeal={handleEditMeal}
                  onDeleteMeal={handleDeleteMeal}
                  onEditDrink={handleEditDrink}
                  onDeleteDrink={handleDeleteDrink}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-xl">📈</span>
                  Nutrition Trends
                </CardTitle>
                <CardDescription>
                  Track your daily nutrient consumption vs targets
                </CardDescription>
              </CardHeader>
              <CardContent>
                <NutrientTrendGraphs clientId={clientSession?.clientId || 0} days={14} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Log Metrics Tab */}
          <TabsContent value="log-metrics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Body Metrics
                </CardTitle>
                <CardDescription>
                  Track your weight over time
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    placeholder="e.g., 75.5"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                  />
                </div>

                <Button onClick={handleLogMetrics} className="w-full">
                  Log Metrics
                </Button>
              </CardContent>
            </Card>

            {/* Bodyweight Trend Chart */}
            {clientSession?.clientId && goalsData?.goals && (
              <BodyweightTrendChart 
                clientId={clientSession.clientId} 
                goals={goalsData.goals}
              />
            )}
          </TabsContent>
        </Tabs>
        </div>
      </main>

      {/* Nutrition Analysis Modal */}
      <Dialog open={showAnalysisModal} onOpenChange={setShowAnalysisModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <span className="text-3xl">🎉</span>
              {analysisResult?.isDrink ? 'Beverage Logged!' : 'Meal Analysis Complete!'}
            </DialogTitle>
            {/* Only show description for meal entries, not beverage-only */}
            {!analysisResult?.isDrink && (
              <DialogDescription>
                {analysisResult?.description}
              </DialogDescription>
            )}
          </DialogHeader>

          {/* Reference Card Detection Indicator - only for meal entries */}
          {analysisResult && !analysisResult.isDrink && (
            <div className="flex items-center gap-2 px-1 py-2 text-sm text-gray-700">
              <input 
                type="checkbox" 
                checked={analysisResult.referenceCardDetected} 
                readOnly 
                className="h-4 w-4 rounded border-gray-300"
                style={{ accentColor: '#10b981' }}
              />
              <span>Card Detected for Portion Estimation</span>
            </div>
          )}

          <div className="space-y-4 mt-2">
            {/* Drink Details Section - show for drink-only */}
            {analysisResult?.isDrink && (
              <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-sm" style={{color: '#578DB3'}}>Drink Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="drink-type-display" className="text-xs">Drink Type</Label>
                    <Input
                      id="drink-type-display"
                      value={drinkType}
                      onChange={(e) => setDrinkType(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="volume-display" className="text-xs">Volume (ml)</Label>
                    <Input
                      id="volume-display"
                      type="number"
                      value={volumeMl}
                      onChange={(e) => setVolumeMl(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="drink-date" className="text-xs">Date</Label>
                    <Input
                      id="drink-date"
                      type="date"
                      value={drinkDateTime.split('T')[0]}
                      onChange={(e) => {
                        const time = drinkDateTime.split('T')[1] || '00:00';
                        setDrinkDateTime(`${e.target.value}T${time}`);
                      }}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="drink-time" className="text-xs">Time</Label>
                    <Input
                      id="drink-time"
                      type="time"
                      value={drinkDateTime.split('T')[1] || '00:00'}
                      onChange={(e) => {
                        const date = drinkDateTime.split('T')[0];
                        setDrinkDateTime(`${date}T${e.target.value}`);
                      }}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Meal Type Selector - hide for drink-only */}
            {!analysisResult?.isDrink && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="edit-meal-type">Meal Type</Label>
                  <Select value={mealType} onValueChange={(value) => setMealType(value as "breakfast" | "lunch" | "dinner" | "snack")}>
                    <SelectTrigger id="edit-meal-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="breakfast">Breakfast</SelectItem>
                      <SelectItem value="lunch">Lunch</SelectItem>
                      <SelectItem value="dinner">Dinner</SelectItem>
                      <SelectItem value="snack">Snack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="meal-date" className="text-xs">Date</Label>
                    <Input
                      id="meal-date"
                      type="date"
                      value={mealDateTime.split('T')[0]}
                      onChange={(e) => {
                        const time = mealDateTime.split('T')[1] || '00:00';
                        setMealDateTime(`${e.target.value}T${time}`);
                      }}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="meal-time" className="text-xs">Time</Label>
                    <Input
                      id="meal-time"
                      type="time"
                      value={mealDateTime.split('T')[1] || '00:00'}
                      onChange={(e) => {
                        const date = mealDateTime.split('T')[0];
                        setMealDateTime(`${date}T${e.target.value}`);
                      }}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Beverage Section - hide for drink-only */}
            {!analysisResult?.isDrink && (
              <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-sm" style={{color: '#578DB3'}}>Beverage (Optional)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-drink-type" className="text-xs">Drink Type</Label>
                  <Input
                    id="edit-drink-type"
                    placeholder="e.g., Water, Tea"
                    value={drinkType}
                    onChange={(e) => setDrinkType(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-volume" className="text-xs">Volume (ml)</Label>
                  <Input
                    id="edit-volume"
                    type="number"
                    placeholder="e.g., 350"
                    value={volumeMl}
                    onChange={(e) => setVolumeMl(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
              {drinkType && volumeMl && !analysisResult?.isDrink && (
                <>
                  {/* Special handling for plain water - auto-estimate */}
                  {drinkType.toLowerCase().trim() === 'water' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Auto-set water nutrition values
                        setBeverageNutrition({
                          drinkType: 'Water',
                          volumeMl: parseInt(volumeMl),
                          calories: 0,
                          protein: 0,
                          fat: 0,
                          carbs: 0,
                          fibre: 0,
                          confidence: 100,
                          description: 'Plain water has no calories or nutrients'
                        });
                      }}
                      className="w-full text-xs"
                    >
                      {beverageNutrition ? '✓ Water Logged' : 'Log Water'}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        estimateBeverageMutation.mutate({
                          drinkType,
                          volumeMl: parseInt(volumeMl),
                        });
                      }}
                      disabled={estimateBeverageMutation.isPending}
                      className="w-full text-xs"
                    >
                      {estimateBeverageMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 mr-1"></div>
                          Estimating...
                        </>
                      ) : (
                        beverageNutrition ? '✓ Beverage Estimated' : 'Estimate Beverage Nutrition'
                      )}
                    </Button>
                  )}
                </>
              )}
              {drinkType && volumeMl && analysisResult?.isDrink && (
                <div className="text-xs text-green-600 font-medium text-center py-2">✓ Beverage Estimated</div>
              )}
            </div>
            )}

            {/* Nutrition Score */}
            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-blue-50 rounded-lg border-2 border-green-200">
              <div className="text-sm font-medium text-gray-600 mb-2">Nutrition Score</div>
              <div className="text-5xl font-bold" style={{color: '#578DB3'}}>
                {analysisResult?.score}/5
              </div>
              <div className="flex justify-center gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className="text-2xl">
                    {star <= (analysisResult?.score || 0) ? '⭐' : '☆'}
                  </span>
                ))}
              </div>
            </div>

            {/* Food Components Breakdown */}
            {editedComponents.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg" style={{color: '#578DB3'}}>Food Components</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (isEditMode) {
                        // Recalculate score when done editing
                        await recalculateScoreMutation.mutateAsync({
                          clientId: currentClientId,
                          calories: calculatedTotals.calories,
                          protein: calculatedTotals.protein,
                          fat: calculatedTotals.fat,
                          carbs: calculatedTotals.carbs,
                          fibre: calculatedTotals.fibre,
                        });
                        // Clear old improvement advice since meal has changed
                        setShowAdvice(false);
                        setImprovementAdvice("");
                      }
                      setIsEditMode(!isEditMode);
                    }}
                    className="text-xs"
                    disabled={recalculateScoreMutation.isPending}
                  >
                    {recalculateScoreMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 mr-1"></div>
                        Updating...
                      </>
                    ) : (
                      isEditMode ? 'Done Editing' : 'Edit Meal'
                    )}
                  </Button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {editedComponents.map((component: any, index: number) => (
                    <ComponentEditor
                      key={index}
                      component={component}
                      index={index}
                      isEditMode={isEditMode}
                      imageUrl={imageUrl}
                      onUpdate={(updated) => {
                        const newComponents = [...editedComponents];
                        newComponents[index] = updated;
                        setEditedComponents(newComponents);
                      }}
                      onDelete={() => {
                        setEditedComponents(editedComponents.filter((_, i) => i !== index));
                      }}
                    />
                  ))}
                </div>
                {isEditMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddComponent(true)}
                    className="w-full"
                  >
                    + Add Component
                  </Button>
                )}
              </div>
            )}

            {/* Validation Warnings */}
            {analysisResult?.validationWarnings && analysisResult.validationWarnings.length > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="font-semibold text-sm text-yellow-800 mb-1">⚠️ Validation Notes</div>
                <ul className="text-xs text-yellow-700 space-y-1">
                  {analysisResult.validationWarnings.map((warning: string, index: number) => (
                    <li key={index}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Nutritional Breakdown */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg" style={{color: '#578DB3'}}>Total Nutrition</h3>
              
              {/* Calories */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium flex items-center gap-2">
                    <span className="text-xl">🔥</span>
                    Calories
                  </span>
                  <span className="text-lg font-bold">{calculatedTotals.calories} kcal</span>
                </div>
                <Progress value={Math.min(calculatedTotals.calories / 10, 100)} className="h-2" />
              </div>

              {/* Protein */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium flex items-center gap-2">
                    <span className="text-xl">💪</span>
                    Protein
                  </span>
                  <span className="text-lg font-bold">{calculatedTotals.protein}g</span>
                </div>
                <Progress value={Math.min(calculatedTotals.protein * 2, 100)} className="h-2" />
              </div>

              {/* Fats */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium flex items-center gap-2">
                    <span className="text-xl">🥑</span>
                    Fats
                  </span>
                  <span className="text-lg font-bold">{calculatedTotals.fat}g</span>
                </div>
                <Progress value={Math.min(calculatedTotals.fat * 2, 100)} className="h-2" />
              </div>

              {/* Carbs */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium flex items-center gap-2">
                    <span className="text-xl">🍞</span>
                    Carbohydrates
                  </span>
                  <span className="text-lg font-bold">{calculatedTotals.carbs}g</span>
                </div>
                <Progress value={Math.min(calculatedTotals.carbs * 1.5, 100)} className="h-2" />
              </div>

              {/* Fiber */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium flex items-center gap-2">
                    <span className="text-xl">🌾</span>
                    Fiber
                  </span>
                  <span className="text-lg font-bold">{calculatedTotals.fibre}g</span>
                </div>
                <Progress value={Math.min(calculatedTotals.fibre * 4, 100)} className="h-2" />
              </div>
            </div>

            {/* AI Confidence */}
            <div className="text-center text-sm text-gray-600 pt-4 border-t">
              AI Confidence: {analysisResult?.confidence}%
            </div>

            {/* Improvement Advice Section */}
            {!showAdvice ? (
              <Button
                variant="outline"
                onClick={() => {
                  getAdviceMutation.mutate({
                    clientId: currentClientId,
                    mealDescription: analysisResult?.description || '',
                    components: editedComponents,
                    calories: calculatedTotals.calories,
                    protein: calculatedTotals.protein,
                    fat: calculatedTotals.fat,
                    carbs: calculatedTotals.carbs,
                    fibre: calculatedTotals.fibre,
                  });
                }}
                className="w-full"
                disabled={getAdviceMutation.isPending}
              >
                {getAdviceMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                    Generating Advice...
                  </>
                ) : (
                  '💡 Improve My Score'
                )}
              </Button>
            ) : (
              <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-blue-900">💡 Personalized Advice</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvice(false)}
                    className="h-6 w-6 p-0"
                  >
                    ✕
                  </Button>
                </div>
                <div className="text-sm text-blue-900 whitespace-pre-wrap">
                  {improvementAdvice}
                </div>
              </div>
            )}

            <Button 
              onClick={() => {
                // If this is a drink-only summary (just logged), save any edits
                if (analysisResult?.isDrink && !editingMealId && justLoggedDrinkId) {
                  // Update the just-logged drink with any changes
                  updateDrinkMutation.mutate({
                    drinkId: justLoggedDrinkId,
                    drinkType,
                    volumeMl: parseInt(volumeMl),
                    loggedAt: fromHongKongDateTimeLocal(drinkDateTime),
                  });
                  setJustLoggedDrinkId(null);
                  return;
                }
                
                // If drink-only summary with no edits, just close
                if (analysisResult?.isDrink && !editingMealId) {
                  setShowAnalysisModal(false);
                  setJustLoggedDrinkId(null);
                  return;
                }
                
                // Check if editing a drink (negative ID)
                if (editingMealId && editingMealId < 0) {
                  // Update existing drink
                  updateDrinkMutation.mutate({
                    drinkId: -editingMealId,
                    drinkType,
                    volumeMl: parseInt(volumeMl),
                    loggedAt: fromHongKongDateTimeLocal(drinkDateTime),
                  });
                } else if (isEditMode && editingMealId) {
                  // Update existing meal
                  updateMealMutation.mutate({
                    mealId: editingMealId,
                    clientId: currentClientId,
                    imageUrl,
                    imageKey,
                    mealType,
                    calories: calculatedTotals.calories,
                    protein: calculatedTotals.protein,
                    fat: calculatedTotals.fat,
                    carbs: calculatedTotals.carbs,
                    fibre: calculatedTotals.fibre,
                    aiDescription: analysisResult?.description || '',
                    aiConfidence: analysisResult?.confidence || 0,
                    loggedAt: fromHongKongDateTimeLocal(mealDateTime),
                    beverageType: beverageNutrition?.drinkType,
                    beverageVolumeMl: beverageNutrition?.volumeMl,
                    beverageCalories: beverageNutrition?.calories,
                    beverageProtein: beverageNutrition?.protein,
                    beverageFat: beverageNutrition?.fat,
                    beverageCarbs: beverageNutrition?.carbs,
                    beverageFibre: beverageNutrition?.fibre,
                  });
                } else {
                  // Create new meal
                  saveMealMutation.mutate({
                    clientId: currentClientId,
                    imageUrl,
                    imageKey,
                    mealType,
                    calories: calculatedTotals.calories,
                    protein: calculatedTotals.protein,
                    fat: calculatedTotals.fat,
                    carbs: calculatedTotals.carbs,
                    fibre: calculatedTotals.fibre,
                    aiDescription: analysisResult?.description || '',
                    aiConfidence: analysisResult?.confidence || 0,
                    beverageType: beverageNutrition?.drinkType,
                    beverageVolumeMl: beverageNutrition?.volumeMl,
                    beverageCalories: beverageNutrition?.calories,
                    beverageProtein: beverageNutrition?.protein,
                    beverageFat: beverageNutrition?.fat,
                    beverageCarbs: beverageNutrition?.carbs,
                    beverageFibre: beverageNutrition?.fibre,
                  });
                }
                setEditingMealId(null);
              }} 
              className="w-full"
              style={{backgroundColor: '#578DB3'}}
              disabled={saveMealMutation.isPending || updateMealMutation.isPending || updateDrinkMutation.isPending}
            >
              {(saveMealMutation.isPending || updateMealMutation.isPending || updateDrinkMutation.isPending) ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                analysisResult?.isDrink && !editingMealId && justLoggedDrinkId ? 'Save Changes' : analysisResult?.isDrink && !editingMealId ? 'Done' : (editingMealId && editingMealId < 0) ? 'Update Drink' : (isEditMode ? 'Update Meal' : 'Log Meal')
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Guidelines Modal */}
      <PhotoGuidelinesModal 
        open={showPhotoGuide} 
        onOpenChange={setShowPhotoGuide} 
      />

      {/* Add Component Form */}
      <AddComponentForm
        open={showAddComponent}
        onOpenChange={setShowAddComponent}
        onAdd={(newComponent) => {
          setEditedComponents([...editedComponents, newComponent]);
          setShowAddComponent(false);
        }}
      />
    </div>
  );
}
