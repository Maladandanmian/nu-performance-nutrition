import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, CreditCard, Sun, Ruler, CheckCircle2, XCircle } from "lucide-react";

interface PhotoGuidelinesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PhotoGuidelinesModal({ open, onOpenChange }: PhotoGuidelinesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Camera className="h-6 w-6" style={{color: '#578DB3'}} />
            Photo Guidelines for Accurate Analysis
          </DialogTitle>
          <DialogDescription>
            Follow these tips to help the AI estimate portion sizes more accurately
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Credit Card Reference */}
          <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <CreditCard className="h-6 w-6 mt-1 flex-shrink-0" style={{color: '#578DB3'}} />
              <div>
                <h3 className="font-semibold text-lg mb-2" style={{color: '#578DB3'}}>
                  📏 Include a Reference Card for Scale
                </h3>
                <p className="text-sm text-gray-700 mb-2">
                  Place a <strong>credit card</strong>, <strong>business card</strong>, or <strong>Octopus card</strong> next to your meal in every photo. 
                  This helps the AI calculate actual portion sizes accurately.
                </p>
                <div className="bg-white p-2 rounded border border-blue-300 text-xs text-gray-600 mt-2">
                  <strong>Why?</strong> The AI can use the card's known size to determine the scale 
                  of your meal, making estimates consistent regardless of camera distance.
                </div>
              </div>
            </div>
          </div>

          {/* Best Practices */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg" style={{color: '#578DB3'}}>Best Practices</h3>
            
            {/* Distance & Angle */}
            <div className="flex items-start gap-3">
              <Ruler className="h-5 w-5 mt-1 flex-shrink-0 text-green-600" />
              <div>
                <h4 className="font-medium text-gray-900">Distance & Angle</h4>
                <p className="text-sm text-gray-600">
                  Take photo from <strong>30-45cm away</strong> at a <strong>45° angle</strong>. 
                  Show the entire plate/bowl in frame.
                </p>
              </div>
            </div>

            {/* Lighting */}
            <div className="flex items-start gap-3">
              <Sun className="h-5 w-5 mt-1 flex-shrink-0 text-yellow-600" />
              <div>
                <h4 className="font-medium text-gray-900">Good Lighting</h4>
                <p className="text-sm text-gray-600">
                  Use natural light or bright indoor lighting. Avoid harsh shadows or dark photos.
                </p>
              </div>
            </div>

            {/* Complete View */}
            <div className="flex items-start gap-3">
              <Camera className="h-5 w-5 mt-1 flex-shrink-0 text-blue-600" />
              <div>
                <h4 className="font-medium text-gray-900">Complete View</h4>
                <p className="text-sm text-gray-600">
                  Capture all food items in one shot. If meal has multiple components, arrange them visibly.
                </p>
              </div>
            </div>
          </div>

          {/* Do's and Don'ts */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-green-700 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Do This
              </h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>✓ Include reference card for scale</li>
                <li>✓ Show entire plate/bowl</li>
                <li>✓ Use good lighting</li>
                <li>✓ Take from 30-45cm away</li>
                <li>✓ Keep camera steady</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-red-700 flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                Avoid This
              </h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>✗ Extreme close-ups</li>
                <li>✗ Photos from far away</li>
                <li>✗ Dark or shadowy lighting</li>
                <li>✗ Blurry or tilted photos</li>
                <li>✗ Cutting off food items</li>
              </ul>
            </div>
          </div>

          {/* Pro Tip */}
          <div className="p-3 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg">
            <p className="text-sm">
              <strong className="text-orange-800">💡 Pro Tip:</strong>{" "}
              <span className="text-gray-700">
                Keep a dedicated card in your wallet for meal photos. Consistency in photo technique 
                leads to more accurate nutrition tracking over time!
              </span>
            </p>
          </div>

          <Button 
            onClick={() => onOpenChange(false)} 
            className="w-full"
            style={{backgroundColor: '#578DB3'}}
          >
            Got it! Let's take a photo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
