# task-canvas Requirements Specification

## Project Overview

**Project Name:** task-canvas

**Purpose:** UX prototype exploring multi-view project management paradigms – combining traditional list views with spatial canvas layouts, integrated wiki documentation, and project analytics in a single cohesive interface.

**Target Users:**
- Product teams managing features and backlogs
- Design teams organizing research and deliverables
- Small teams wanting flexible task organization
- On-the-go users checking tasks on mobile
- UX researchers evaluating the prototype

**Current Status:** Data model defined, frontend implementation starting

---

## Implementation Status Legend

| Symbol | Status |
|--------|--------|
| ✅ | Implemented |
| 🔄 | Partially implemented (mock/demo) |
| ⏳ | Planned |
| ❌ | Not started / Out of scope |

---

## Functional Requirements

### FR-1: Workspace & Project Management

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| FR-1.1 | Create/edit workspace with name and description | Must | ⏳ | Single workspace for prototype |
| FR-1.2 | Create new project with name, identifier, color | Must | ⏳ | |
| FR-1.3 | Project list/grid view on dashboard | Must | ⏳ | |
| FR-1.4 | Project search by name | Should | ⏳ | |
| FR-1.5 | Archive/restore projects | Should | ⏳ | Soft delete |
| FR-1.6 | Project icon/emoji selection | Could | ⏳ | |
| FR-1.7 | Default view selection per project | Should | ⏳ | List, canvas, or board |

### FR-2: Task Management (Core)

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| FR-2.1 | Create task with title | Must | ⏳ | |
| FR-2.2 | Edit task title and description | Must | ⏳ | Markdown support |
| FR-2.3 | Assign task to user | Must | ⏳ | Single assignee |
| FR-2.4 | Set task status | Must | ⏳ | Customizable per project |
| FR-2.5 | Set task priority | Should | ⏳ | Urgent, High, Medium, Low |
| FR-2.6 | Set due date | Should | ⏳ | |
| FR-2.7 | Set start date | Could | ⏳ | |
| FR-2.8 | Add labels/tags to tasks | Should | ⏳ | Multiple labels per task |
| FR-2.9 | Task comments | Should | ⏳ | |
| FR-2.10 | Archive/delete tasks | Must | ⏳ | Soft delete |
| FR-2.11 | Task sequence ID per project | Must | ⏳ | e.g., TC-1, TC-2 |
| FR-2.12 | Quick task creation (inline) | Should | ⏳ | |

### FR-3: List View

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| FR-3.1 | Display tasks in sortable table | Must | ⏳ | |
| FR-3.2 | Column visibility toggle | Should | ⏳ | |
| FR-3.3 | Sort by any column | Must | ⏳ | |
| FR-3.4 | Filter by status | Must | ⏳ | |
| FR-3.5 | Filter by assignee | Should | ⏳ | |
| FR-3.6 | Filter by label | Should | ⏳ | |
| FR-3.7 | Filter by priority | Should | ⏳ | |
| FR-3.8 | Group by status/assignee/priority | Should | ⏳ | |
| FR-3.9 | Drag to reorder tasks | Should | ⏳ | Updates sort_order |
| FR-3.10 | Inline editing of fields | Could | ⏳ | |
| FR-3.11 | Multi-select tasks | Should | ⏳ | Bulk actions |

### FR-4: Canvas View

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| FR-4.1 | Display tasks as draggable cards | Must | ⏳ | |
| FR-4.2 | Free positioning (x, y coordinates) | Must | ⏳ | |
| FR-4.3 | Pan canvas (drag background) | Must | ⏳ | |
| FR-4.4 | Zoom in/out | Must | ⏳ | Mouse wheel + controls |
| FR-4.5 | Zoom to fit all tasks | Should | ⏳ | |
| FR-4.6 | Reset view to origin | Should | ⏳ | |
| FR-4.7 | Card shows title, status, assignee | Must | ⏳ | |
| FR-4.8 | Card color based on status/priority | Should | ⏳ | |
| FR-4.9 | Click card to open task detail | Must | ⏳ | |
| FR-4.10 | Create task at cursor position | Should | ⏳ | Double-click to create |
| FR-4.11 | Snap to grid (optional) | Could | ⏳ | |
| FR-4.12 | Multi-select cards | Could | ⏳ | Box select or Shift+click |
| FR-4.13 | Z-index layering | Should | ⏳ | Bring to front/back |
| FR-4.14 | Minimap for navigation | Could | ❌ | Future consideration |

### FR-5: Board View (Kanban)

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| FR-5.1 | Display columns by status | Must | ⏳ | |
| FR-5.2 | Drag tasks between columns | Must | ⏳ | Updates status |
| FR-5.3 | Drag to reorder within column | Should | ⏳ | |
| FR-5.4 | Column task count | Should | ⏳ | |
| FR-5.5 | Collapse/expand columns | Could | ⏳ | |
| FR-5.6 | WIP limits per column | Could | ❌ | Future consideration |

### FR-6: Wiki / Pages

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| FR-6.1 | Create wiki page with title | Must | ⏳ | |
| FR-6.2 | Edit page content (Markdown) | Must | ⏳ | |
| FR-6.3 | Page list in sidebar | Must | ⏳ | |
| FR-6.4 | Search pages by title | Should | ⏳ | |
| FR-6.5 | Link tasks from pages | Should | ⏳ | Bidirectional |
| FR-6.6 | Page icon/emoji | Could | ⏳ | |
| FR-6.7 | Archive/delete pages | Should | ⏳ | |
| FR-6.8 | Page comments | Could | ⏳ | |

### FR-7: Saved Views

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| FR-7.1 | Save current filter/sort as view | Should | ⏳ | |
| FR-7.2 | Name and describe saved view | Should | ⏳ | |
| FR-7.3 | Switch between saved views | Should | ⏳ | |
| FR-7.4 | Set default view for project | Could | ⏳ | |
| FR-7.5 | Delete saved views | Should | ⏳ | |

### FR-8: Analytics Dashboard

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| FR-8.1 | Task count by status (pie/donut) | Must | ⏳ | |
| FR-8.2 | Task count by priority | Should | ⏳ | |
| FR-8.3 | Task count by assignee | Should | ⏳ | |
| FR-8.4 | Tasks created over time | Could | ⏳ | Line chart |
| FR-8.5 | Tasks completed over time | Could | ⏳ | Line chart |
| FR-8.6 | Overdue tasks count | Should | ⏳ | |

### FR-9: User Management (Simplified)

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| FR-9.1 | Display user list | Must | ⏳ | Mock users for prototype |
| FR-9.2 | User avatar and name | Must | ⏳ | |
| FR-9.3 | User role (Admin, Member, Viewer) | Could | ⏳ | Display only for prototype |

### FR-10: Identity & Access Management (IAM)

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| **Social Login Providers** |||||
| FR-10.1 | Google OAuth login | Should | ⏳ | OIDC |
| FR-10.2 | Microsoft Entra ID login | Should | ⏳ | OIDC |
| FR-10.3 | GitHub OAuth login | Could | ⏳ | For developer users |
| **Swiss Government Identity** |||||
| FR-10.4 | CH-LOGIN integration | Could | ⏳ | Citizens & business via eIAM |
| FR-10.5 | FED-LOGIN integration | Could | ⏳ | Federal employees via eIAM |
| FR-10.6 | AGOV support | Could | ⏳ | Replacing CH-LOGIN |
| **Core Auth Features** |||||
| FR-10.7 | Email/password fallback | Must | ⏳ | For users without SSO |
| FR-10.8 | Session management | Must | ⏳ | JWT or session cookies |
| FR-10.9 | Logout / sign out | Must | ⏳ | Clear session |
| FR-10.10 | Remember me option | Should | ⏳ | Extended session |
| FR-10.11 | Account linking | Could | ⏳ | Link multiple providers |
| FR-10.12 | User profile from provider | Should | ⏳ | Name, email, avatar |

### FR-11: UI Components

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| FR-11.1 | Global navigation sidebar | Must | ⏳ | Collapsible on mobile |
| FR-11.2 | Breadcrumb navigation | Should | ⏳ | |
| FR-11.3 | Command palette (Cmd+K) | Should | ⏳ | Desktop only |
| FR-11.4 | Toast notifications | Must | ⏳ | Success, error, info |
| FR-11.5 | Modal dialogs | Must | ⏳ | Full-screen on mobile |
| FR-11.6 | Dropdown menus | Must | ⏳ | |
| FR-11.7 | Context menus (right-click) | Could | ⏳ | Long-press on mobile |
| FR-11.8 | Keyboard shortcuts | Should | ⏳ | Desktop only |

### FR-12: Mobile Experience

| ID | Requirement | Priority | Status | Notes |
|----|-------------|----------|--------|-------|
| FR-12.1 | Bottom navigation bar | Must | ⏳ | Quick access to views |
| FR-12.2 | Swipe gestures for task actions | Should | ⏳ | Swipe to complete/archive |
| FR-12.3 | Pull-to-refresh | Should | ⏳ | |
| FR-12.4 | Touch-friendly tap targets | Must | ⏳ | Min 44x44px |
| FR-12.5 | Canvas: pinch to zoom | Must | ⏳ | Two-finger gesture |
| FR-12.6 | Canvas: two-finger pan | Must | ⏳ | |
| FR-12.7 | Canvas: long-press to create task | Should | ⏳ | |
| FR-12.8 | Simplified card view on small screens | Should | ⏳ | Hide secondary info |
| FR-12.9 | Offline indicator | Could | ⏳ | |

---

## Non-Functional Requirements

### NFR-1: Performance

| ID | Requirement | Target | Status | Notes |
|----|-------------|--------|--------|-------|
| NFR-1.1 | Initial page load | < 2 seconds | ⏳ | |
| NFR-1.2 | Task list render (100 tasks) | < 500ms | ⏳ | |
| NFR-1.3 | Canvas pan/zoom | 60 fps | ⏳ | Smooth interaction |
| NFR-1.4 | Task drag response | < 16ms | ⏳ | No perceptible lag |
| NFR-1.5 | Mobile touch response | < 100ms | ⏳ | Immediate feedback |

### NFR-2: Usability

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| NFR-2.1 | Responsive design (desktop, tablet, mobile) | ⏳ | Touch-friendly on mobile |
| NFR-2.2 | Keyboard navigable | ⏳ | |
| NFR-2.3 | WCAG 2.1 AA accessibility | ⏳ | Color contrast, ARIA |
| NFR-2.4 | Consistent visual language | ⏳ | Design system |
| NFR-2.5 | Undo/redo for destructive actions | Could | Future consideration |

### NFR-3: Browser Support

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| NFR-3.1 | Chrome (latest 2 versions) | ⏳ | Primary target |
| NFR-3.2 | Firefox (latest 2 versions) | ⏳ | |
| NFR-3.3 | Safari (latest 2 versions) | ⏳ | Desktop + iOS |
| NFR-3.4 | Edge (latest 2 versions) | ⏳ | |
| NFR-3.5 | Chrome Mobile (Android) | ⏳ | |
| NFR-3.6 | Safari Mobile (iOS) | ⏳ | |

### NFR-4: Data Persistence

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| NFR-4.1 | Static JSON for prototype | ⏳ | Phase 1 |
| NFR-4.2 | LocalStorage fallback | Could | Optional |
| NFR-4.3 | PostgreSQL migration path | ⏳ | Phase 2+ |

---

## Technology Stack

### Frontend

| Technology | Purpose | Notes |
|------------|---------|-------|
| React 18+ | UI framework | Vite for bundling |
| TypeScript | Type safety | Strict mode |
| Tailwind CSS | Styling | Utility-first |
| Lucide React | Icons | MIT licensed |
| React DnD or dnd-kit | Drag and drop | Canvas + list reordering |
| Zustand or Jotai | State management | Lightweight |
| React Router | Navigation | |

### Responsive Breakpoints

| Breakpoint | Width | Target |
|------------|-------|--------|
| `sm` | 640px | Large phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large screens |

### Data Layer (Prototype)

| Technology | Purpose | Notes |
|------------|---------|-------|
| Static JSON | Mock data | /data/*.json files |
| TypeScript interfaces | Data contracts | Matches data model |

### Backend (Future)

| Technology | Purpose | Notes |
|------------|---------|-------|
| Node.js + Express or Hono | API server | |
| PostgreSQL | Database | |
| Prisma or Drizzle | ORM | |
| Docker | Containerization | |

---

## IAM Architecture

### Overview

The application should support multiple identity providers through a unified authentication layer, using **OIDC** (OpenID Connect) as the primary protocol.

```
┌─────────────────────────────────────────────────────────────────┐
│                        task-canvas                              │
│                     (Service Provider)                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │ OIDC
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Auth Abstraction Layer                        │
│              (NextAuth.js / Auth.js / Lucia)                    │
└───────┬───────────┬───────────┬───────────┬─────────────────────┘
        │           │           │           │
        ▼           ▼           ▼           ▼
   ┌────────┐  ┌─────────┐  ┌────────┐  ┌─────────────────────┐
   │ Google │  │Microsoft│  │ GitHub │  │       eIAM          │
   │  OIDC  │  │Entra ID │  │ OAuth  │  │  (Swiss Federal)    │
   └────────┘  └─────────┘  └────────┘  │                     │
                                        │  ┌───────────────┐  │
                                        │  │   CH-LOGIN    │  │
                                        │  │  (Citizens)   │  │
                                        │  └───────────────┘  │
                                        │  ┌───────────────┐  │
                                        │  │   FED-LOGIN   │  │
                                        │  │  (Federal)    │  │
                                        │  └───────────────┘  │
                                        │  ┌───────────────┐  │
                                        │  │     AGOV      │  │
                                        │  │   (Future)    │  │
                                        │  └───────────────┘  │
                                        └─────────────────────┘
```

### Identity Providers

| Provider | Protocol | Use Case | Notes |
|----------|----------|----------|-------|
| **Google** | OIDC | General public users | Widely adopted, easy setup |
| **Microsoft Entra ID** | OIDC | Enterprise / M365 users | Azure AD integration |
| **GitHub** | OAuth 2.0 | Developer users | Good for tech-focused teams |
| **eIAM (CH-LOGIN)** | OIDC/SAML | Swiss citizens & businesses | Via eIAM broker |
| **eIAM (FED-LOGIN)** | OIDC/SAML | Swiss federal employees | Requires smartcard/MFA |
| **AGOV** | OIDC | Future Swiss gov identity | Replacing CH-LOGIN |

### Swiss eIAM Integration

[eIAM](https://www.eiam.swiss) is the Swiss Federal Administration's central IAM system. It acts as a **trust broker** between identity providers and applications.

**Key Concepts:**
- **CH-LOGIN**: Login for citizens and business representatives
- **FED-LOGIN**: Login for federal employees (higher security, smartcard/MFA)
- **AGOV**: Next-generation Swiss government identity (replacing CH-LOGIN)
- **Quality of Authentication (QoA)**: eIAM provides QoA levels (10-60) indicating authentication strength

**Integration Options:**
1. **OIDC** (recommended) – Modern, works with mobile apps
2. **SAML 2.0** – Legacy support, enterprise systems

**eIAM Endpoints (Reference):**
| Environment | Purpose |
|-------------|---------|
| REF | Reference/testing |
| ABN | Acceptance testing |
| PROD | Production |

**Required for eIAM Integration:**
- Register application via [eIAM Dossier](https://dossier.eiam.swiss)
- Define required QoA level
- Configure callback URLs
- Request necessary user attributes

### Recommended Auth Libraries

| Library | Framework | Notes |
|---------|-----------|-------|
| [NextAuth.js / Auth.js](https://authjs.dev) | Next.js / Any | Built-in providers, custom OIDC support |
| [Lucia](https://lucia-auth.com) | Any | Lightweight, flexible |
| [Arctic](https://arcticjs.dev) | Any | OAuth 2.0 helpers |
| [jose](https://github.com/panva/jose) | Any | JWT/OIDC token handling |

### Implementation Phases

| Phase | Scope | Priority |
|-------|-------|----------|
| **Prototype** | Mock auth / bypass | — |
| **Phase 1** | Google + Microsoft OIDC | Must |
| **Phase 2** | Email/password fallback | Should |
| **Phase 3** | eIAM (CH-LOGIN) | Could |
| **Production** | Full eIAM + AGOV | Future |

---

## Prototype Scope

### Phase 1: Core Views (MVP)

**Data:**
- [ ] JSON data files for all entities
- [ ] TypeScript interfaces matching data model
- [ ] Mock users (3-5)
- [ ] Mock project with 20-30 tasks

**Views:**
- [ ] Project dashboard (list projects)
- [ ] List view with sorting and filtering
- [ ] Canvas view with pan/zoom/drag
- [ ] Task detail modal
- [ ] Basic navigation sidebar
- [ ] Mobile: bottom navigation bar
- [ ] Mobile: responsive list view

**Auth:**
- [ ] Mock auth bypass for development
- [ ] Login UI placeholder

### Phase 2: Extended Features

- [ ] Board view (Kanban)
- [ ] Wiki pages (create, edit, list)
- [ ] Task-page linking
- [ ] Saved views
- [ ] Labels management
- [ ] Comments on tasks
- [ ] Mobile: touch gestures for canvas
- [ ] Mobile: swipe actions on tasks
- [ ] **Auth: Google + Microsoft OIDC**

### Phase 3: Polish & Analytics

- [ ] Analytics dashboard with charts
- [ ] Command palette (Cmd+K)
- [ ] Keyboard shortcuts
- [ ] Mobile: pull-to-refresh
- [ ] Mobile: optimized card layouts
- [ ] Performance optimization
- [ ] PostgreSQL migration
- [ ] **Auth: Email/password fallback**
- [ ] **Auth: eIAM (CH-LOGIN) integration**

---

## JSON Data Structure

```
/data
├── workspace.json       # Single workspace
├── users.json           # 3-5 mock users
├── projects.json        # 2-3 projects
├── statuses.json        # Per-project statuses
├── priorities.json      # Workspace-wide priorities
├── labels.json          # Per-project labels
├── tasks.json           # 20-30 tasks with canvas positions
├── wiki-pages.json      # 5-10 pages
├── views.json           # Saved views
└── comments.json        # Task/page comments
```

---

## Open Questions

1. **Canvas interactions:** Should cards be resizable, or fixed size?
2. **Canvas connections:** Should tasks be connectable with lines/arrows (like a whiteboard)?
3. **Real-time collaboration:** Is this a consideration for future phases?
4. **Canvas on mobile:** Simplified view, or full pan/zoom with touch gestures?
5. **Dark mode:** Should this be supported from the start?
6. **Data persistence:** Should prototype save to LocalStorage, or reset on refresh?
7. **IAM for prototype:** Skip auth entirely, mock login, or implement Google OIDC from start?
8. **eIAM priority:** Is Swiss government identity (CH-LOGIN/FED-LOGIN) needed for MVP or later phase?
9. **User provisioning:** Auto-create users on first login, or require invitation?
10. **Multi-workspace:** Can a user belong to multiple workspaces with different providers?

---

## References

### Project Management Inspiration
- [Plane](https://github.com/makeplane/plane) – Open source project management
- [Worklenz](https://github.com/Worklenz/worklenz) – Open source PM tool
- [OpenProject](https://github.com/opf/openproject) – Enterprise PM software
- [Linear](https://linear.app) – Design inspiration
- [Notion](https://notion.so) – Wiki/docs inspiration
- [Miro](https://miro.com) – Canvas interaction patterns

### Identity & Access Management
- [eIAM Swiss Federal IAM](https://www.eiam.swiss) – Swiss government identity broker
- [eIAM Technical Docs](https://docs.eiam.swiss) – Integration guides
- [CH-LOGIN](https://www.eiam.swiss/?c=chlink) – Swiss citizen/business login
- [Auth.js (NextAuth)](https://authjs.dev) – Authentication library
- [Lucia Auth](https://lucia-auth.com) – Lightweight auth library
- [OIDC Spec](https://openid.net/specs/openid-connect-core-1_0.html) – OpenID Connect specification
