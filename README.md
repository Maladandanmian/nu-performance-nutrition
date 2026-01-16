# Nu Performance Nutrition

A full-stack nutrition tracking application for gym trainers and clients in Hong Kong, featuring AI-powered meal analysis using Manus Forge API with vision capabilities.

## Features

### For Clients
- **AI-Powered Meal Logging**: Take photos of meals or nutrition labels for instant AI analysis
- **Nutritional Breakdown**: Get detailed information on Calories, Protein, Fat, Carbs, and Fiber
- **Nutrition Scoring**: Receive a 1-5 score showing how well meals align with goals (hybrid quality + progress algorithm)
- **Manual Tracking**: Log drinks (type and volume) and body metrics (weight and hydration)
- **Progress Monitoring**: View personal nutrition history and trends
- **Today's Summary**: Circular progress indicators showing daily progress vs targets
- **14-Day Trend Graphs**: Visualize nutrient consumption with pre-populated target lines

### For Trainers
- **Client Management**: Add and manage multiple gym clients with custom 6-digit PINs
- **Goal Setting**: Customize nutrition targets for each client
- **Data Visualization**: View interactive charts showing:
  - Nutrition score trends
  - Macronutrient breakdown
  - Weight tracking
  - Hydration patterns
- **30-Day Analytics**: Track client adherence to nutrition goals with comprehensive charts
- **Meal History Review**: View and discuss client meal logs

## Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Backend**: Node.js, Express 4, tRPC 11
- **Database**: MySQL/TiDB with Drizzle ORM
- **AI**: Manus Forge API with vision support (Qwen-VL-Plus)
- **Storage**: S3-compatible object storage
- **Authentication**: Dual system (Manus OAuth for trainers, PIN for clients)
- **Charts**: Recharts

## Getting Started

### Prerequisites

- Node.js 22.x
- pnpm 10.x
- MySQL/TiDB database (auto-configured by Manus platform)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Push database schema:
   ```bash
   pnpm db:push
   ```

4. Start development server:
   ```bash
   pnpm dev
   ```

### First-Time Setup

1. **Login as Trainer**: The first user (owner) is automatically assigned the "admin" role
2. **Add a Client**: Click "Add Client" to create your first client profile with a custom 6-digit PIN
3. **Set Nutrition Goals**: Default goals are created automatically, but you can customize them
4. **Share PIN with Client**: Give the client their PIN for login access
5. **Test Meal Logging**: Client can use their PIN to login and upload a meal photo

## Authentication System

### Dual Authentication
- **Trainers**: Use Manus OAuth (click "Sign In as Trainer")
- **Clients**: Use 6-digit PIN (enter on left side of home page)

### Security
- Client sessions are cookie-based and last 7 days
- PINs are unique and managed by trainers
- All API endpoints use role-based access control

## Usage Guide

### For Trainers

1. **Adding Clients**:
   - Click "Add Client" from the trainer dashboard
   - Enter client name, email (optional), phone (optional), and custom 6-digit PIN
   - Default nutrition goals are created automatically
   - Share the PIN with your client

2. **Editing Nutrition Goals**:
   - Click "View Details" on any client card
   - Click "Edit Goals" to customize targets for:
     - Calories
     - Protein (g)
     - Fat (g)
     - Carbs (g)
     - Fiber (g)
     - Hydration (ml)

3. **Viewing Client Progress**:
   - Navigate to client detail page
   - View nutrition score trends (last 30 days)
   - Analyze macronutrient breakdown
   - Monitor weight and hydration trends
   - Review meal history with photos

### For Clients

1. **Logging In**:
   - Enter your 6-digit PIN on the home page (left side)
   - Click "Access Dashboard"

2. **Logging Meals**:
   - Go to "Log Meal" tab
   - Take a photo of your meal or nutrition label
   - Select meal type (breakfast, lunch, dinner, snack)
   - Add optional notes
   - Click "Analyze & Log Meal"
   - Wait for AI analysis (typically 3-5 seconds)
   - View detailed nutrition breakdown with your score (1-5 stars)

3. **Logging Drinks**:
   - Go to "Log Drink" tab
   - Enter drink type (e.g., Water, Coffee, Tea)
   - Enter volume in milliliters
   - Click "Log Drink"

4. **Logging Body Metrics**:
   - Go to "Body Metrics" tab
   - Enter weight in kg (optional)
   - Enter total daily hydration in ml (optional)
   - Click "Log Metrics"

5. **Viewing Progress**:
   - **Today's Summary**: See daily progress with circular indicators at top of dashboard
   - **History Tab**: Review all past meals with photos and scores
   - **Trends Tab**: View 14-day nutrient graphs with target lines

## AI Analysis Details

### Manus Forge API Integration

The app uses **Manus Forge API** with vision capabilities:

- **Model**: Qwen-VL-Plus
- **Capabilities**:
  - Food item recognition
  - Portion size estimation
  - Nutrition label reading
  - Nutritional value extraction

### Nutrition Scoring Algorithm (Hybrid Approach)

The 1-5 scoring system uses a hybrid approach:

**60% Intrinsic Quality Score**:
- Protein ratio (20-35% of calories)
- Fiber content per 100 calories
- Macronutrient balance

**40% Daily Progress Score**:
- Fits within remaining daily budget
- Considers meals already logged today
- Compares against 1/3 of daily goals per meal

**Final Score Mapping**:
- **5 stars**: Excellent quality and fits daily budget
- **4 stars**: Good quality or good budget fit
- **3 stars**: Moderate quality and budget fit
- **2 stars**: Below average quality or over budget
- **1 star**: Poor quality and significantly over budget

## Database Schema

### Tables

- **users**: Authentication and role management (admin/user)
- **clients**: Client profiles managed by trainers (with PIN field)
- **nutrition_goals**: Customizable nutrition targets per client
- **meals**: Meal logs with AI-analyzed nutritional data
- **drinks**: Manual drink entries for hydration tracking
- **body_metrics**: Weight and hydration measurements

## API Endpoints (tRPC)

### Authentication
- `auth.me`: Get current user
- `auth.clientSession`: Get client session
- `auth.loginWithPIN`: Login with 6-digit PIN
- `auth.logout`: Logout user
- `auth.logoutClient`: Logout client

### Clients (Trainer only)
- `clients.create`: Add new client with PIN
- `clients.list`: Get all clients for trainer
- `clients.get`: Get client by ID
- `clients.update`: Update client information
- `clients.delete`: Remove client

### Nutrition Goals (Trainer only)
- `nutritionGoals.get`: Get goals for a client
- `nutritionGoals.update`: Update client nutrition goals

### Meals
- `meals.uploadAndAnalyze`: Upload meal image and get AI analysis
- `meals.list`: Get meals for a client
- `meals.get`: Get meal by ID
- `meals.dailyTotals`: Get aggregated daily totals for charts

### Drinks
- `drinks.create`: Log a drink
- `drinks.list`: Get drinks for a client

### Body Metrics
- `bodyMetrics.create`: Log body metrics
- `bodyMetrics.list`: Get body metrics for a client

## Deployment

### Using Manus Platform

1. **Save Checkpoint**: Use the Manus interface to create a checkpoint
2. **Publish**: Click the "Publish" button in the Management UI
3. **Custom Domain** (Optional): Go to Settings → Domains to add your custom domain

### Environment Variables

All required environment variables are auto-configured by the Manus platform:
- `DATABASE_URL`: Database connection string
- `JWT_SECRET`: Session signing secret
- `BUILT_IN_FORGE_API_KEY`: Manus Forge API key (server-side)
- `BUILT_IN_FORGE_API_URL`: Manus Forge API URL
- OAuth configuration variables

## Branding

**Nu Performance Nutrition** uses the following brand colors:
- **Sky Blue**: #578DB3 (primary actions, protein)
- **Powder Blue**: #86BBD8 (secondary elements, fat)
- **Tangerine Orange**: #CE4C27 (accents, calories)
- **Dark Grey**: #6F6E70
- **Black**: #2B2A2C

**Typography**:
- **Headings**: Outfit (Google Fonts)
- **Body**: Inter (Google Fonts)

## Key Features Implemented

✅ Dual authentication system (OAuth + PIN)
✅ AI-powered meal analysis with Manus Forge API
✅ Hybrid nutrition scoring (quality + progress)
✅ Client management with custom PINs
✅ Nutrition goal customization
✅ Meal history feed with photos
✅ Today's summary with circular progress indicators
✅ Nutrient trend graphs with pre-populated target lines (even with no data)
✅ 14-day trends for clients, 30-day analytics for trainers
✅ Drink and body metrics tracking
✅ Responsive design with Nu Performance branding
✅ Role-based access control

## Support

For issues related to the Manus Platform, visit https://help.manus.im

## License

Proprietary - All rights reserved

## Credits

- Built with Manus full-stack web development platform
- AI powered by Manus Forge API (Qwen-VL-Plus)
- UI components by shadcn/ui
- Charts by Recharts
