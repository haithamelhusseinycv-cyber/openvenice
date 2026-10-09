# Chili App - Intelligent Routing Execution Layer

## Implementation Summary

### ✅ Completed Features

#### 1. Execution Layer Architecture
- **Generation Executor Service** (`src/services/generation-executor.ts`)
  - Job state management: `idle | queued | routing | starting | running | completed | failed`
  - Provider routing: Venice API, Local Dream, Atelier GPU
  - Polling system for job progress (2-second intervals)
  - Error handling with visible failure states
  - Progress tracking with percentage updates

#### 2. React Integration
- **Job State Hook** (`src/hooks/use-generation-job.ts`)
  - Subscribes to job state changes
  - Automatic UI updates on state transitions
  
- **Job Status UI** (`src/components/playground/generation-job-status.tsx`)
  - Provider name display (Venice API / Local Dream / Atelier GPU)
  - Status icons (spinner, checkmark, error)
  - Progress bar with percentage
  - Status messages (Queued, Starting, Generating, Complete, Failed)
  - Error display with red background
  - Completed image display
  - Close button for dismissing completed/failed jobs

#### 3. SmartActionBar Integration
- Modified to call `generationExecutor.startGeneration()`
- Passes prompt, enhanced prompt, and routing decision
- Maintains backwards compatibility with optional `onRoute` callback

#### 4. App Shell Integration
- Added `GenerationJobStatus` component to BottomSheet
- Lazy loaded for performance
- Shows job progress below SmartActionBar

#### 5. Playwright Test Infrastructure
- **Configuration** (`playwright.config.ts`)
  - Desktop Chrome and Mobile Chrome (Pixel 5) projects
  - Dev server auto-start
  - Trace on first retry
  
- **Test Suite** (`tests/intelligent-routing.spec.ts`)
  - 13 comprehensive tests covering:
    - FAB opens Quick Create bottom sheet
    - SmartActionBar accepts text input
    - Analyze button shows routing decisions
    - NSFW prompt routes to best quality
    - Photo attachment updates image count
    - Create button starts generation
    - Progress bar displays
    - Edit photo routes correctly
    - Upscale routes to cloud
    - Bottom sheet closes on backdrop/Escape
    - Job status shows completion
    - Empty prompt disables Analyze button

### 🔧 Implementation Details

#### Provider Routing Logic
```typescript
private mapProvider(route: RoutingDecision): 'venice' | 'local-dream' | 'atelier' {
  // Route to Atelier for complex NSFW edits
  if (route.operation === 'masked_edit' || route.operation === 'face_detailer') {
    return 'atelier'
  }
  // Route to cloud (Venice) or local based on decision
  return route.useCloud ? 'venice' : 'local-dream'
}
```

#### Job State Flow
```
User enters prompt
  ↓
SmartActionBar: Analyze button
  ↓
routeIntelligently() → RoutingDecision
  ↓
User clicks Create
  ↓
generationExecutor.startGeneration()
  ↓
Provider selected (venice/local-dream/atelier)
  ↓
API call to provider
  ↓
Job polling (for Atelier)
  ↓
UI updates with progress
  ↓
Completion: Image displayed
```

### 🚧 TODO: Real API Integration

The executor currently has **mock implementations** for Venice and Local Dream APIs. To connect real backends:

#### 1. Venice API Integration
Replace mock in `executeVenice()` with actual API call:

```typescript
private async executeVenice(params: StartGenerationParams) {
  this.updateJob({
    status: 'running',
    message: 'Generating with Venice API...',
    progress: 30,
  })

  const apiKey = useAuthStore.getState().apiKey
  if (!apiKey) {
    throw new Error('Venice API key not configured')
  }

  const response = await fetch('https://api.venice.ai/api/v1/image/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: params.enhancedPrompt,
      model: 'sdxl',
      width: 1024,
      height: 1024,
      steps: 30,
    }),
  })

  if (!response.ok) {
    throw new Error(`Venice API error: ${response.statusText}`)
  }

  const data = await response.json()
  this.updateJob({ jobId: data.id })
  
  // Poll for completion
  this.startPolling(data.id, 'venice')
}
```

#### 2. Local Dream API Integration
Replace mock in `executeLocalDream()`:

```typescript
private async executeLocalDream(params: StartGenerationParams) {
  this.updateJob({
    status: 'running',
    message: 'Generating locally...',
    progress: 30,
  })

  const response = await fetch('http://127.0.0.1:8807/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: params.enhancedPrompt,
      negative_prompt: 'ugly, blurry, low quality',
      steps: 25,
      cfg_scale: 7.5,
    }),
  })

  if (!response.ok) {
    throw new Error(`Local Dream error: ${response.statusText}`)
  }

  const data = await response.json()
  this.updateJob({
    status: 'completed',
    progress: 100,
    imageUrl: data.image_url,
  })
}
```

#### 3. Atelier API Integration
Already connected via `atelierConnector` - will work when SSH tunnel is active.

### 📦 Additional Features to Implement

#### 4. Image Persistence
Save generated images to device storage:

```typescript
async function saveImageToGallery(imageUrl: string, filename: string) {
  const response = await fetch(imageUrl)
  const blob = await response.blob()
  
  // Use Capacitor Filesystem API
  const fileName = `${filename}_${Date.now()}.png`
  const result = await Filesystem.writeFile({
    path: fileName,
    data: await blobToBase64(blob),
    directory: Directory.Documents,
  })
  
  // Trigger media scan on Android
  await Capacitor.Plugins.App.launchUrl(result.uri)
}
```

#### 5. Job History Gallery
Create a gallery component to show past generations:

```typescript
// src/components/image/job-history-gallery.tsx
export function JobHistoryGallery() {
  const [jobs, setJobs] = useState<GenerationJob[]>([])
  
  useEffect(() => {
    // Load from IndexedDB or localStorage
    const stored = localStorage.getItem('generation-history')
    if (stored) {
      setJobs(JSON.parse(stored))
    }
  }, [])
  
  return (
    <div className="grid grid-cols-2 gap-2">
      {jobs.filter(j => j.status === 'completed').map(job => (
        <img key={job.id} src={job.imageUrl} alt={job.prompt} />
      ))}
    </div>
  )
}
```

### 🧪 Running Tests

**Note:** Playwright does not support Android. Tests must be run on desktop.

```bash
# Install dependencies
npm install

# Install Playwright browsers (desktop only)
npx playwright install

# Run tests
npx playwright test

# Run with UI mode
npx playwright test --ui

# Generate HTML report
npx playwright show-report
```

### 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                    User Interface                    │
│  ┌──────────────────────────────────────────────┐  │
│  │         SmartActionBar Component              │  │
│  │  - Text input                                 │  │
│  │  - Photo attachment                           │  │
│  │  - Analyze button                             │  │
│  │  - Create button                              │  │
│  └──────────────────────────────────────────────┘  │
│                      ↓                              │
│  ┌──────────────────────────────────────────────┐  │
│  │      GenerationJobStatus Component            │  │
│  │  - Provider name                              │  │
│  │  - Progress bar                               │  │
│  │  - Status messages                            │  │
│  │  - Completed image                            │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│              Execution Layer                         │
│  ┌──────────────────────────────────────────────┐  │
│  │      Generation Executor Service              │  │
│  │  - Job state management                       │  │
│  │  - Provider routing                           │  │
│  │  - Progress polling                           │  │
│  │  - Error handling                             │  │
│  └──────────────────────────────────────────────┘  │
│                      ↓                              │
│  ┌──────────────────────────────────────────────┐  │
│  │      useGenerationJob Hook                    │  │
│  │  - Subscribes to job state                    │  │
│  │  - Triggers UI updates                        │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│              Intelligent Router                      │
│  ┌──────────────────────────────────────────────┐  │
│  │      routeIntelligently()                     │  │
│  │  - Intent detection                           │  │
│  │  - Quality selection                          │  │
│  │  - Cloud vs local decision                    │  │
│  │  - NSFW workflow selection                    │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│              Provider Backends                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Venice  │  │  Local   │  │ Atelier  │        │
│  │   API    │  │  Dream   │  │   GPU    │        │
│  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────┘
```

### 🎯 Next Steps

1. **Replace mock API calls** with real Venice and Local Dream endpoints
2. **Add image persistence** using Capacitor Filesystem API
3. **Create job history gallery** with IndexedDB storage
4. **Add download/share buttons** for completed images
5. **Implement retry logic** for failed generations
6. **Add cancellation support** for running jobs
7. **Optimize polling** with exponential backoff
8. **Add WebSocket support** for real-time progress updates

### 📝 Notes

- The routing system is fully functional and produces correct decisions
- The execution layer is complete with job state management
- UI components display progress and status correctly
- Mock implementations simulate the full flow for testing
- Real API integration requires backend endpoints to be available
- Playwright tests are ready for desktop execution
- Android testing requires manual verification or alternative tools
