import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface FavoriteMealsButtonsProps {
  clientId: number;
}

export function FavoriteMealsButtons({ clientId }: FavoriteMealsButtonsProps) {
  const utils = trpc.useUtils();
  
  const { data: favoriteMeals, isLoading: favoritesLoading } = trpc.meals.getFavorites.useQuery(
    { clientId },
    { enabled: clientId > 0 }
  );
  
  const logFavoriteMutation = trpc.meals.logFavorite.useMutation({
    onSuccess: () => {
      toast.success("Meal logged successfully!");
      utils.meals.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to log favorite meal");
    },
  });
  
  const repeatLastMealMutation = trpc.meals.repeatLast.useMutation({
    onSuccess: () => {
      toast.success("Last meal repeated successfully!");
      utils.meals.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to repeat last meal");
    },
  });
  
  if (favoritesLoading) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-10 bg-muted animate-pulse rounded"></div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-2 gap-2">
      {/* Favorite Meals (up to 3) */}
      {favoriteMeals?.slice(0, 3).map((meal) => (
        <Button
          key={meal.id}
          variant="outline"
          size="sm"
          onClick={() => logFavoriteMutation.mutate({ mealId: meal.id, clientId })}
          disabled={logFavoriteMutation.isPending}
          className="text-xs truncate"
          title={meal.aiDescription || meal.mealType}
        >
          {meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1)}
        </Button>
      ))}
      
      {/* Empty slots if less than 3 favorites */}
      {Array.from({ length: Math.max(0, 3 - (favoriteMeals?.length || 0)) }).map((_, i) => (
        <Button
          key={`empty-${i}`}
          variant="outline"
          size="sm"
          disabled
          className="text-xs text-muted-foreground"
        >
          No favorite
        </Button>
      ))}
      
      {/* Repeat Last Meal Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => repeatLastMealMutation.mutate({ clientId })}
        disabled={repeatLastMealMutation.isPending}
        className="text-xs"
      >
        <RotateCcw className="h-3 w-3 mr-1" />
        Repeat Last
      </Button>
    </div>
  );
}
