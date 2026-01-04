# Nu Performance Nutrition - TODO

## Database Schema & Backend
- [x] Extend user table with role field (admin/user)
- [x] Create clients table with PIN field for authentication
- [x] Create nutrition_goals table (per client, editable by trainer)
- [x] Create meals table (food entries with AI analysis)
- [x] Create drinks table (manual entries)
- [x] Create body_metrics table (weight and hydration tracking)
- [x] Add database query helpers in server/db.ts
- [x] Create tRPC procedures for client management (trainer only)
- [x] Create tRPC procedures for nutrition goal management (trainer only)
- [x] Create tRPC procedures for meal logging with AI analysis
- [x] Create tRPC procedures for drink logging
- [x] Create tRPC procedures for body metrics logging
- [x] Create tRPC procedures for daily totals aggregation

## AI Integration
- [x] Create Qwen-VL API client wrapper using Manus Forge API
- [x] Implement image upload to S3
- [x] Implement AI image analysis for food recognition
- [x] Implement AI nutritional value extraction
- [x] Implement hybrid scoring algorithm (60% quality + 40% progress)
- [x] Add error handling for AI API failures

## Authentication System
- [x] Add PIN field to clients table in database schema
- [x] Create PIN generation function (6-digit unique codes)
- [x] Create PIN authentication endpoint (separate from OAuth)
- [x] Create client session management for PIN auth
- [x] Create authenticatedProcedure middleware for both auth types
- [x] Update login page to show PIN entry option
- [x] Create PIN login UI component with two-column layout

## Client Interface
- [x] Create meal logging page with photo upload
- [x] Create detailed nutrition breakdown modal
- [x] Display nutrition score (1-5 stars) after meal analysis
- [x] Create drink logging form (type and volume)
- [x] Create body metrics logging form (weight and hydration)
- [x] Create meal history feed component
- [x] Create today's summary widget with circular progress indicators
- [x] Create nutrient trend graphs (14-day view for clients)
- [x] Pre-populate target lines in trend graphs

## Trainer Interface
- [x] Create client management page (create, view, list, delete clients)
- [x] Create nutrition goal editing interface
- [x] Create trainer dashboard showing all clients
- [x] Create client detail page with 30-day analytics
- [x] Add charts for Calories, Protein, Fat, Carbs, Fiber
- [x] Add charts for Hydration and Bodyweight trends
- [x] Add meal history view for trainers

## UI/UX & Design
- [x] Apply Nu Performance Nutrition branding colors
- [x] Set up typography (Outfit for headings, Inter for body)
- [x] Design and implement responsive layouts
- [x] Add loading states for AI analysis
- [x] Add error handling and user feedback
- [x] Implement role-based navigation
- [x] Make PIN login prominent on home page
- [x] Add confirmation dialog for trainer login

## Testing & Deployment
- [x] Test meal photo upload and AI analysis
- [x] Test PIN authentication flow
- [x] Test OAuth authentication for trainers
- [x] Test data visualization charts
- [x] Test role-based access control
- [x] Verify mobile responsiveness
- [x] Create initial checkpoint
- [x] Provide deployment instructions

## Logo Update
- [x] Copy Nu Performance logo to public assets
- [x] Update homepage to display logo in white circle
- [x] Update favicon with logo
- [x] Test logo display on all pages

## Multi-Trainer Support
- [x] Add Luke@nuperformancecoaching.com as additional trainer
- [x] Update authentication to support multiple admin users
- [x] Test Luke's login and trainer access

## Image Upload Enhancement
- [x] Update meal photo input to support both camera and gallery
- [x] Test on iOS devices
- [x] Test on Android devices

## AI Re-Analysis for Edited Components
- [x] Create tRPC endpoint for AI-powered component re-estimation
- [x] Update ComponentEditor to call AI re-analysis when description changes
- [x] Pass image context to AI for accurate portion estimation
- [x] Display loading state during re-analysis
- [x] Test with various food substitutions (milk types, protein sources, etc.)

## AI-Powered Add Component
- [x] Create AI endpoint to estimate nutrition from food name + quantity
- [x] Update AddComponentForm to use food name and quantity inputs
- [x] Remove manual nutrition entry fields from add component form
- [x] Recalculate meal score after adding components
- [x] Update improvement advice based on complete edited meal
- [x] Save updated meal to database (replace original)
- [x] Test with various food items and quantities

## Hydration in Today's Summary
- [x] Add hydration indicator to TodaysSummary component
- [x] Display current hydration vs target (ml)
- [x] Show circular progress indicator for hydration
- [x] Ensure hydration data is fetched from body_metrics table
- [x] Test hydration display with various intake levels

## Form Reset After Meal Logging
- [x] Clear meal photo input after successful submission
- [x] Reset meal type to default value
- [x] Clear notes textarea
- [x] Clear drink type and volume fields
- [x] Test form reset with various meal logging scenarios
