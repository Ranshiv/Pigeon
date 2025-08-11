# Pigeon: API Testing & Collaboration Platform

## Architecture Overview

Pigeon is a comprehensive API testing platform with advanced visualization capabilities. The system consists of:

**Server** (`server.js`): Express.js backend with Socket.io for real-time features, MongoDB for persistence, and Google OAuth authentication### Visual API Designer

- `client/src/components/VisualApiDesigner/VisualApiDesigner.js` - Main designer interface
- `client/src/components/VisualApiDesigner/hooks/useDesignerState.js` - Canvas state management
- `client/src/components/VisualApiDesigner/components/DesignCanvas_new.js` - Cytoscape integration
- `client/src/components/VisualApiDesigner/components/EndpointNode.js` - Modern node implementation

### Modern UI Libraries Installation

```bash
# Install ReactBits for animated UI components
cd client && npm install @reactbits/core @reactbits/animations

# Install HeroUI for accessible UI components
cd client && npm install @heroui/react

# Install LiveKit for real-time collaboration
cd client && npm install livekit-client livekit-server-sdk
```

### UI Libraries Configuration

```javascript
// client/src/providers/HeroUIProvider.js
import { createTheme, HeroUIProvider } from "@heroui/react";

const lightTheme = createTheme({
  type: "light",
  theme: {
    colors: {
      primary: "#0070F3",
      secondary: "#7928CA",
      // Custom colors matching Pigeon branding
    },
  },
});

export const AppHeroUIProvider = ({ children }) => (
  <HeroUIProvider theme={lightTheme}>{children}</HeroUIProvider>
);

// client/src/providers/LiveKitProvider.js
import { LiveKitRoom } from "livekit-react";

export const LiveKitProvider = ({ children, workspaceId, token }) => {
  // Only wrap with LiveKit when in a workspace context
  if (!workspaceId || !token) return children;

  return (
    <LiveKitRoom
      url={process.env.REACT_APP_LIVEKIT_URL}
      token={token}
      options={{ adaptiveStream: true, dynacast: true }}
    >
      {children}
    </LiveKitRoom>
  );
};
```

**Visualization & Charts**:

- `client/src/components/ResponseDisplay.js` - Template rendering and chart integration
- `services/visualization/` - Backend data processing for visualization
- Chart.js integration patterns in React componentst.js.

**Client** (`client/`): React SPA built with Create React App + CRACO, featuring:

- Visual API Designer with Cytoscape.js for interactive API flow diagrams
- Response data visualization using Chart.js and Handlebars templates
- Real-time collaboration with LiveKit and Socket.io for scalable WebRTC capabilities
- Component-based architecture with 50+ specialized components
- Modern UI components using ReactBits for animations and HeroUI for accessible interfaces
- Advanced drag-and-drop functionality with enhanced user experience

**CLI** (`cli/`): Node.js command-line tool for CI/CD integration, supporting collection execution and multiple report formats (JSON, JUnit, HTML, CSV).

## Key Architectural Patterns

### Workspace-Centric Organization

- **Workspaces** are the primary organizational unit containing collections, environments, and collaborators
- Three types: Personal (private), Team (collaborative), Public (community-visible)
- Role-based access control: owner, admin, editor, viewer, visitor (active guests)

### Real-Time Collaboration

- LiveKit WebRTC infrastructure for high-performance video/audio collaboration
- Socket.io rooms for workspace/collection-scoped collaboration via `utils/socket/socket-server.js`
- Active user tracking, typing indicators, and live activity feeds
- Join/leave patterns: `joinWorkspace(id)`, `joinCollection(id)` in `CollaborationContext.js`
- Advanced user presence with LiveKit Rooms and Participants model
- Selective Forwarding Unit (SFU) architecture for scalable real-time communication
- Socket and WebRTC authentication with user profile data for consistent overlay display

### Visual API Designer Architecture

- **Interactive Flow Diagrams**: Cytoscape.js-based canvas in `client/src/components/VisualApiDesigner/`
- **Node-based API modeling**: Drag-and-drop components with real-time OpenAPI spec generation
- **Component hierarchy**: `DesignCanvas`, `ComponentPalette`, `PropertiesPanel`, `SpecPreview`
- **State management**: Custom hooks `useDesignerState`, `useSpecGeneration` for complex canvas operations
- **Modern node components**: Using ReactBits animations and transitions for fluid user experiences
- **Accessible UI elements**: HeroUI components for consistent, accessible interface design

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

**ReactBits Integration** for animated, interactive components:

```javascript
// EndpointNode.js pattern with ReactBits
import { Card, Animation, InteractiveElement } from "@reactbits/core";

const EndpointNode = ({ id, selected, data }) => {
  return (
    <Animation type="fadeIn" duration={300}>
      <InteractiveElement
        dragId={id}
        onClick={handleSelect}
        className={`endpoint-node-modern ${selected ? "selected" : ""}`}
      >
        <Card elevation={selected ? "elevated" : "flat"}>
          <div className="endpoint-header">
            <span className="method">{data.method}</span>
            <span className="path">{data.path}</span>
          </div>
        </Card>
      </InteractiveElement>
    </Animation>
  );
};
```

### UI Components with HeroUI

**Modern Select Component**:

```javascript
// EndpointSelector.js pattern with HeroUI
import { Select, SelectItem, SelectSection } from "@heroui/react";

const EndpointSelector = ({ endpoints, onSelect, selectedEndpoint }) => {
  // Group endpoints by tag
  const endpointsByTag = groupEndpointsByTag(endpoints);

  return (
    <Select
      label="Select Endpoint"
      placeholder="Choose an API endpoint"
      selectedKeys={selectedEndpoint ? [selectedEndpoint.id] : []}
      onSelectionChange={(keys) => {
        const selected = endpoints.find((e) => e.id === Array.from(keys)[0]);
        onSelect(selected);
      }}
    >
      {Object.entries(endpointsByTag).map(([tag, endpoints]) => (
        <SelectSection title={tag} key={tag}>
          {endpoints.map((endpoint) => (
            <SelectItem
              key={endpoint.id}
              startContent={
                <span className={`method-tag ${endpoint.method.toLowerCase()}`}>
                  {endpoint.method}
                </span>
              }
            >
              {endpoint.path}
            </SelectItem>
          ))}
        </SelectSection>
      ))}
    </Select>
  );
};
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

LiveKit and Socket.io integration in collaboration context:

```javascript
// Initialize LiveKit room connection
import { Room, RoomEvent, LocalParticipant } from "livekit-client";

const room = new Room({
  adaptiveStream: true,
  dynacast: true,
  reconnect: true,
});

// Join workspace for collaboration with video/audio
const joinWorkspace = async (workspaceId) => {
  // Socket.io for messaging and presence
  socket.emit("join_room", { roomId: workspaceId });
  sendActivity("workspace_view", { workspaceId, workspaceName });

  // LiveKit for rich collaboration features
  await room.connect(process.env.LIVEKIT_URL, token);
  room.localParticipant.setMetadata(
    JSON.stringify({
      userId: user.id,
      name: user.displayName,
      avatar: user.photoURL,
      role: user.role,
    })
  );

  // Handle real-time collaboration events
  room.on(RoomEvent.ParticipantConnected, handleParticipantJoined);
  room.on(RoomEvent.DataReceived, handleCollaborationData);
};

// Active user tracking with enhanced presence
const getActiveUsers = (workspaceId) => {
  const socketUsers = socket.getConnectedUsers(workspaceId);
  const livekitParticipants = room.participants;

  // Merge presence data from both sources
  return mergePresenceData(socketUsers, livekitParticipants);
};
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
├── ui/                         # HeroUI customized components
│   ├── Select/                 # Custom select components
│   ├── Button/                 # Styled buttons
│   └── themes/                 # Light/dark theme configurations
├── collaboration/              # Real-time collaboration features
│   ├── LiveKitProvider.js      # LiveKit integration setup
│   ├── CollaborationContext.js # Context for real-time state
│   └── hooks/                  # Custom hooks for collaboration
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

## Modern UI Libraries Benefits

### ReactBits Benefits

- **90+ animated, interactive components** that enhance user experience
- **Optimized rendering** through smart component architecture
- **Fluid animations and transitions** for a more engaging interface
- **Consistent animation patterns** across the application
- **Developer-friendly API** for building dynamic interfaces quickly

### HeroUI Benefits

- **Built on Tailwind CSS** for consistent styling without runtime CSS
- **Fully accessible components** using React Aria for WCAG compliance
- **Dark/light mode support** with automatic theme detection
- **Extensive component library** (30+) with full TypeScript support
- **Modern, clean design aesthetic** with consistent branding

### LiveKit Benefits

- **Production-ready WebRTC** infrastructure for real-time collaboration
- **More reliable than basic Socket.io** for video/audio collaboration
- **Selective Forwarding Unit (SFU)** architecture for better scaling
- **Pre-built SDKs** for React, React Native, iOS, and Android
- **Advanced features** like connection recovery and adaptive streaming quality

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
