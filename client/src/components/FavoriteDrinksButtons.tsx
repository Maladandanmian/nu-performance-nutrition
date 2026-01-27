import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface FavoriteDrinksButtonsProps {
  clientId: number;
}

export function FavoriteDrinksButtons({ clientId }: FavoriteDrinksButtonsProps) {
  const utils = trpc.useUtils();
  
  const { data: favoriteDrinks, isLoading: favoritesLoading } = trpc.drinks.getFavorites.useQuery(
    { clientId },
    { enabled: clientId > 0 }
  );
  
  const logFavoriteMutation = trpc.drinks.logFavorite.useMutation({
    onSuccess: () => {
      toast.success("Drink logged successfully!");
      utils.drinks.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to log favorite drink");
    },
  });
  
  const repeatLastDrinkMutation = trpc.drinks.repeatLast.useMutation({
    onSuccess: () => {
      toast.success("Last drink repeated successfully!");
      utils.drinks.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to repeat last drink");
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
      {/* Favorite Drinks (up to 3) */}
      {favoriteDrinks?.slice(0, 3).map((drink) => (
        <Button
          key={drink.id}
          variant="outline"
          size="sm"
          onClick={() => logFavoriteMutation.mutate({ drinkId: drink.id, clientId })}
          disabled={logFavoriteMutation.isPending}
          className="text-xs truncate"
          title={`${drink.drinkType} (${drink.volumeMl}ml)`}
        >
          {drink.drinkType}
        </Button>
      ))}
      
      {/* Empty slots if less than 3 favorites */}
      {Array.from({ length: Math.max(0, 3 - (favoriteDrinks?.length || 0)) }).map((_, i) => (
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
      
      {/* Repeat Last Drink Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => repeatLastDrinkMutation.mutate({ clientId })}
        disabled={repeatLastDrinkMutation.isPending}
        className="text-xs"
      >
        <RotateCcw className="h-3 w-3 mr-1" />
        Repeat Last
      </Button>
    </div>
  );
}
