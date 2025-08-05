# Pigeon: API Testing & Collaboration Platform

## Architecture Overview

Pigeon is a comprehensive API testing platform with advanced visualization capabilities. The system consists of:

**Server** (`server.js`): Express.js backend with Socket.io for real-time features, MongoDB for persistence, and Google OAuth authentication via Passport.js.

**Client** (`client/`): React SPA built with Create React App + CRACO, featuring:

- Visual API Designer with Cytoscape.js for interactive API flow diagrams
- Response data visualization using Chart.js and Handlebars templates
- Real-time collaboration with Socket.io client
- Component-based architecture with 50+ specialized components
- Modern UI components using @dnd-kit for drag-and-drop functionality

**CLI** (`cli/`): Node.js command-line tool for CI/CD integration, supporting collection execution and multiple report formats (JSON, JUnit, HTML, CSV).

## Key Architectural Patterns

### Workspace-Centric Organization

- **Workspaces** are the primary organizational unit containing collections, environments, and collaborators
- Three types: Personal (private), Team (collaborative), Public (community-visible)
- Role-based access control: owner, admin, editor, viewer, visitor (active guests)

### Real-Time Collaboration

- Socket.io rooms for workspace/collection-scoped collaboration via `utils/socket/socket-server.js`
- Active user tracking, typing indicators, and live activity feeds
- Join/leave patterns: `joinWorkspace(id)`, `joinCollection(id)` in `CollaborationContext.js`
- Socket authentication with user profile data for consistent overlay display

### Visual API Designer Architecture

- **Interactive Flow Diagrams**: Cytoscape.js-based canvas in `client/src/components/VisualApiDesigner/`
- **Node-based API modeling**: Drag-and-drop components with real-time OpenAPI spec generation
- **Component hierarchy**: `DesignCanvas`, `ComponentPalette`, `PropertiesPanel`, `SpecPreview`
- **State management**: Custom hooks `useDesignerState`, `useSpecGeneration` for complex canvas operations
- **Modern node components**: Using @dnd-kit/sortable for enhanced drag-and-drop capabilities

### Database Architecture

- MongoDB with Mongoose ODMs in `models/` directory
- Key models: `Workspace`, `Collection`, `Request`, `Environment`, `User`, `ApiVersion`, `MockServer`
- String-based IDs used consistently in client-server communication
- Rich schema validation with custom methods and virtuals

## Development Workflow

### Starting the Application

```bash
# Automated startup (Windows) - PREFERRED METHOD
start-pigeon.bat

# Manual startup
node server.js                    # Backend (port 5001)
cd client && npm start           # Frontend (port 3000)
```

### VS Code Tasks (Use These First)

**Critical**: Always use VS Code tasks for development workflow:

- **"Start Pigeon Server"** - Background server with auto-restart
- **"Start React Client"** - Development server with hot reload (currently running)

Access via `Ctrl+Shift+P` → "Tasks: Run Task" or use `run_vs_code_task` tool.

### Testing Strategy

```bash
# Backend tests with Jest
npm test                         # Run all tests
npm run test:watch              # Watch mode for development
npm run test:coverage           # Coverage reports

# Frontend testing within client/
cd client && npm test           # React Testing Library + Jest
```

### Environment Variables

Configure in `.env` file:

- `MONGODB_URI` - Database connection
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - OAuth
- `SESSION_SECRET` - Session security
- `FRONTEND_URL`, `API_URL` - CORS and routing
- `NODE_ENV` - Development/production mode

## Component Communication Patterns

### API Endpoints Structure

All routes centralized in `routes/index.js` with modular organization:

- `/api/workspaces` - Workspace CRUD and collaboration
- `/api/collections` - API collection management with versioning
- `/api/environments` - Environment variables and contexts
- `/api/monitoring` - API health monitoring and alerting
- `/api/apiVersions` - OpenAPI specification versioning
- `/api/mockServers` - Dynamic mock server management

### Visual API Designer Integration

**Component Flow**:

1. `VisualApiDesigner.js` - Main container with tabbed interface
2. `DesignCanvas` - Cytoscape.js canvas for node manipulation
3. `ComponentPalette` - Draggable API components (endpoints, schemas)
4. `PropertiesPanel` - Node property editing with real-time validation
5. `SpecPreview` - Live OpenAPI spec generation and export

**Data Flow Pattern**:

```javascript
// Node creation and spec generation
const { addNode, generateSpec } = useDesignerState();
addNode(componentType, position) → updateSpec() → render SpecPreview
```

### Modern Node Components

**@dnd-kit Integration** for drag-and-drop operations:

```javascript
// EndpointNode.js pattern
const { attributes, listeners, setNodeRef, transform, transition } =
  useSortable({ id });
return (
  <div
    ref={setNodeRef}
    style={{ transform: CSS.Transform.toString(transform), transition }}
    {...attributes}
    {...listeners}
    className={`endpoint-node-modern ${selected ? "selected" : ""}`}
  >
    {/* Node content */}
  </div>
);
```

### Visualization Engine

**Template-based rendering** using Handlebars:

```javascript
// Response data visualization pattern
const template = `<div>{{#each items}}<span>{{name}}</span>{{/each}}</div>`;
const rendered = VisualizationEngine.set(template, responseData);
```

**Chart generation** with automatic type detection:

```javascript
// Chart.js integration with React wrapper
<ChartComponent
  data={responseData}
  type="auto" // Auto-detects optimal chart type
  interactive={true}
/>
```

### Real-Time Events

Socket.io event patterns in collaboration context:

```javascript
// Join workspace for collaboration
joinWorkspace(workspaceId);
sendActivity("workspace_view", { workspaceId, workspaceName });

// Active user tracking
getActiveUsers(workspaceId); // Returns current collaborators
```

### State Management

- React Context for collaboration state (`CollaborationContext.js`)
- Local component state for UI interactions
- Fetch-based API calls with credential inclusion for CORS
- History tracking for undo/redo operations in designer components

## Testing & CLI Integration

### CLI Usage

```bash
pigeon run -c collection.json -e environment.json --reporter html
```

### CLI Architecture & Usage

**Full CI/CD Integration**:

```bash
# Collection execution with environment resolution
pigeon run -c collection.json -e environment.json --reporter html

# Multiple output formats supported
--reporter json|junit|html|csv
```

**Key CLI Features**:

- Database environment resolution via `--userId` and `--workspaceId`
- Variable interpolation through `VariableResolver.js`
- Windows-compatible with proper error handling
- Extensible reporter system in `cli/reporter.js`

### Mock Server Integration

**Dynamic endpoint generation** from OpenAPI specs:

- Auto-creation during OpenAPI import with user confirmation
- RESTful endpoint patterns: `GET /pets`, `POST /pets/{id}`
- Proxy-based testing: `/proxy?url=<endpoint>&mockServerId=<id>`
- Custom response editing and endpoint management

## Critical Development Patterns

### File Structure Conventions

**Component organization** (50+ specialized components):

```
client/src/components/
├── VisualApiDesigner/          # Visual API design tools
│   ├── components/             # Canvas, palette, properties
│   ├── hooks/                  # State management hooks
│   ├── services/               # API integration
│   └── utils/                  # Canvas utilities
├── monitoring/                 # API monitoring components
├── Documentation/              # API documentation tools
└── [ComponentName].js/.css     # Co-located styles pattern
```

**Backend service organization**:

```
services/
├── monitoring/MonitoringService.js    # Health checks & alerting
├── integration/IntegrationService.js  # Third-party integrations
└── visualization/                     # Data processing for charts
```

### State Management Patterns

**Context-based collaboration**:

```javascript
// Collaboration state pattern
const { joinWorkspace, sendActivity, getActiveUsers } = useCollaboration();
joinWorkspace(workspaceId); // Automatic socket room management
```

**Custom hooks for complex UI**:

```javascript
// Visual designer state management
const { nodes, edges, selectedNode, addNode, generateSpec } =
  useDesignerState();
const { validateSpec, exportSpec } = useSpecGeneration();
```

### Authentication & Security

- **Google OAuth** with Passport.js session-based auth
- **User serialization** includes workspace permissions
- **Credential inclusion** required: `credentials: 'include'` in all fetch calls
- **MongoDB session storage** with automatic cleanup

## Key Files for Feature Development

**Core Architecture**:

- `models/Workspace.js` - Business logic for permissions and collaboration
- `routes/workspaces.js` - Workspace API endpoints with real-time integration
- `utils/socket/socket-server.js` - Real-time event handling and room management
- `server.js` - Express app setup, middleware order, and Socket.io initialization

**Visual API Designer**:

- `client/src/components/VisualApiDesigner/VisualApiDesigner.js` - Main designer interface
- `client/src/components/VisualApiDesigner/hooks/useDesignerState.js` - Canvas state management
- `client/src/components/VisualApiDesigner/components/DesignCanvas_new.js` - Cytoscape integration
- `client/src/components/VisualApiDesigner/components/EndpointNode.js` - Modern node implementation

**Visualization & Charts**:

- `client/src/components/ResponseDisplay.js` - Template rendering and chart integration
- `services/visualization/` - Backend data processing for visualization
- Chart.js integration patterns in React components

**API Versioning & Mock Servers**:

- `models/ApiVersion.js`, `models/MockServer.js` - Version and mock data models
- `routes/apiVersions.js`, `routes/mockServers.js` - Version management APIs
- OpenAPI import flow in Documentation components

**Testing & CLI**:

- `cli/pigeon-cli.js` - Main CLI entry point with yargs configuration
- `cli/runner.js` - Collection execution engine with environment resolution
- `__tests__/` - Jest test suites with React Testing Library patterns

```

```
