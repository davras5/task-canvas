# Data Model

Data model for task-canvas – a multi-view project management prototype with list, canvas, wiki, and analytics views.

## ER Diagram

```mermaid
erDiagram
    Workspace ||--o{ Project : contains
    Workspace ||--o{ Member : has
    Workspace ||--o{ Priority : defines
    
    Project ||--o{ Task : contains
    Project ||--o{ Status : defines
    Project ||--o{ Label : defines
    Project ||--o{ WikiPage : contains
    Project ||--o{ View : has
    
    Task ||--o| TaskCanvasPosition : has
    Task ||--o{ Task : subtasks
    Task }o--|| Status : has
    Task }o--o| Priority : has
    Task }o--o| Member : assigned_to
    Task ||--o{ Comment : has
    Task ||--o{ Attachment : has
    Task ||--o{ Activity : tracks
    Task }o--o{ Label : tagged_with
    Task }o--o{ WikiPage : linked_to
    
    WikiPage ||--o{ WikiPage : children
    WikiPage ||--o{ Comment : has
    WikiPage ||--o{ Attachment : has
    
    Member }o--|| User : is
    
    Workspace {
        uuid id PK
        string name
        string slug
    }
    
    Project {
        uuid id PK
        uuid workspace_id FK
        string name
        string identifier
    }
    
    Task {
        uuid id PK
        uuid project_id FK
        uuid parent_id FK
        string title
        text description
        uuid status_id FK
        uuid assignee_id FK
        date due_date
    }
    
    TaskCanvasPosition {
        uuid id PK
        uuid task_id FK
        float x
        float y
        int z_index
    }
    
    WikiPage {
        uuid id PK
        uuid project_id FK
        uuid parent_id FK
        string title
        text content
    }
    
    View {
        uuid id PK
        uuid project_id FK
        string name
        enum type
        jsonb filters
    }
```

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          Workspace                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Project  │  │ Project  │  │ Project  │  │   ...    │        │
│  └────┬─────┘  └──────────┘  └──────────┘  └──────────┘        │
│       │                                                         │
│  ┌────┴────────────────────────────────────┐                   │
│  │                                          │                   │
│  ▼                                          ▼                   │
│  Tasks ◄──────────────────────────────► Wiki Pages             │
│  │                                          │                   │
│  ├── List View                              └── Linked Tasks   │
│  ├── Canvas View (x, y positions)                              │
│  └── Grouped by Status/Priority/Label                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Core Entities

### Workspace

Top-level container for projects and members.

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `name` | string | Workspace name |
| `slug` | string | URL-friendly identifier |
| `description` | text | Optional description |
| `logo_url` | string | Workspace logo |
| `created_at` | timestamp | Creation date |
| `updated_at` | timestamp | Last modification |

### Project

A project groups related tasks, wiki pages, and views.

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | FK → Workspace |
| `name` | string | Project name |
| `slug` | string | URL-friendly identifier |
| `description` | text | Project description |
| `identifier` | string(5) | Short prefix for task IDs (e.g., "TC") |
| `color` | string | Project accent color |
| `icon` | string | Emoji or icon identifier |
| `is_archived` | boolean | Soft archive flag |
| `default_view` | enum | `list` \| `canvas` \| `board` |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### Task

The central work item entity.

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `project_id` | uuid | FK → Project |
| `parent_id` | uuid | FK → Task (for subtasks) |
| `sequence_id` | integer | Auto-increment per project |
| `title` | string | Task title |
| `description` | text | Rich text / markdown content |
| `status_id` | uuid | FK → Status |
| `priority_id` | uuid | FK → Priority |
| `assignee_id` | uuid | FK → Member |
| `reporter_id` | uuid | FK → Member |
| `start_date` | date | Planned start |
| `due_date` | date | Deadline |
| `completed_at` | timestamp | When marked done |
| `estimate_hours` | decimal | Time estimate |
| `sort_order` | integer | Position in list view |
| `is_archived` | boolean | Soft delete |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### TaskCanvasPosition

Stores x/y coordinates for the canvas view (separate from task to keep task entity clean).

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `task_id` | uuid | FK → Task (unique) |
| `view_id` | uuid | FK → View (optional, for multiple canvas views) |
| `x` | float | X coordinate |
| `y` | float | Y coordinate |
| `width` | float | Card width (optional) |
| `height` | float | Card height (optional) |
| `z_index` | integer | Layer order |
| `updated_at` | timestamp | |

### Status

Workflow states for tasks.

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `project_id` | uuid | FK → Project |
| `name` | string | Status name |
| `color` | string | Hex color |
| `category` | enum | `backlog` \| `todo` \| `in_progress` \| `done` \| `cancelled` |
| `sort_order` | integer | Display order |
| `is_default` | boolean | Default for new tasks |

### Priority

Task priority levels.

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | FK → Workspace (shared across projects) |
| `name` | string | e.g., "Urgent", "High", "Medium", "Low" |
| `color` | string | Hex color |
| `icon` | string | Icon identifier |
| `sort_order` | integer | Display order (higher = more urgent) |

### Label

Tags for categorizing tasks.

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `project_id` | uuid | FK → Project |
| `name` | string | Label name |
| `color` | string | Hex color |
| `description` | text | Optional description |

### TaskLabel

Many-to-many relationship between tasks and labels.

| Field | Type | Description |
|-------|------|-------------|
| `task_id` | uuid | FK → Task |
| `label_id` | uuid | FK → Label |

### Member

User membership in a workspace.

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `workspace_id` | uuid | FK → Workspace |
| `user_id` | uuid | FK → User |
| `role` | enum | `owner` \| `admin` \| `member` \| `guest` |
| `display_name` | string | Name shown in workspace |
| `joined_at` | timestamp | |

### User

Authentication entity (can belong to multiple workspaces).

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `email` | string | Unique email |
| `name` | string | Display name |
| `avatar_url` | string | Profile image |
| `created_at` | timestamp | |

## Wiki System

### WikiPage

Documentation pages linked to a project.

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `project_id` | uuid | FK → Project |
| `parent_id` | uuid | FK → WikiPage (for hierarchy) |
| `title` | string | Page title |
| `slug` | string | URL-friendly identifier |
| `content` | text | Markdown/rich text content |
| `icon` | string | Emoji or icon |
| `is_locked` | boolean | Prevent edits |
| `sort_order` | integer | Position in sidebar |
| `created_by` | uuid | FK → Member |
| `updated_by` | uuid | FK → Member |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### WikiPageTaskLink

Links between wiki pages and tasks (bidirectional references).

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `page_id` | uuid | FK → WikiPage |
| `task_id` | uuid | FK → Task |
| `created_by` | uuid | FK → Member |
| `created_at` | timestamp | |

## Views & Filters

### View

Saved views with custom filters and display settings.

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `project_id` | uuid | FK → Project |
| `name` | string | View name |
| `type` | enum | `list` \| `board` \| `canvas` \| `calendar` \| `timeline` |
| `filters` | jsonb | Filter configuration |
| `sort_by` | jsonb | Sort configuration |
| `group_by` | string | Grouping field |
| `display_fields` | jsonb | Visible columns/fields |
| `is_default` | boolean | Default view for project |
| `is_shared` | boolean | Visible to all members |
| `created_by` | uuid | FK → Member |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Example `filters` JSON:**
```json
{
  "status_id": { "in": ["uuid1", "uuid2"] },
  "priority_id": { "eq": "uuid3" },
  "assignee_id": { "is_not_null": true },
  "due_date": { "lte": "2025-01-31" },
  "labels": { "contains": ["uuid4"] }
}
```

## Activity & Comments

### Comment

Discussion on tasks or wiki pages.

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `task_id` | uuid | FK → Task (nullable) |
| `page_id` | uuid | FK → WikiPage (nullable) |
| `parent_id` | uuid | FK → Comment (for threads) |
| `content` | text | Comment body |
| `created_by` | uuid | FK → Member |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### Activity

Audit log for changes.

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `project_id` | uuid | FK → Project |
| `task_id` | uuid | FK → Task (nullable) |
| `page_id` | uuid | FK → WikiPage (nullable) |
| `actor_id` | uuid | FK → Member |
| `action` | string | e.g., `created`, `updated`, `moved`, `commented` |
| `field` | string | Changed field name |
| `old_value` | jsonb | Previous value |
| `new_value` | jsonb | New value |
| `created_at` | timestamp | |

## Attachments

### Attachment

Files attached to tasks or wiki pages.

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `task_id` | uuid | FK → Task (nullable) |
| `page_id` | uuid | FK → WikiPage (nullable) |
| `filename` | string | Original filename |
| `file_url` | string | Storage URL |
| `file_size` | integer | Size in bytes |
| `mime_type` | string | MIME type |
| `uploaded_by` | uuid | FK → Member |
| `created_at` | timestamp | |

## Analytics (Aggregated)

### DailyProjectStats

Pre-computed daily statistics for analytics dashboards.

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `project_id` | uuid | FK → Project |
| `date` | date | Statistics date |
| `total_tasks` | integer | Total task count |
| `completed_tasks` | integer | Done tasks |
| `created_tasks` | integer | Tasks created that day |
| `tasks_by_status` | jsonb | `{ "status_id": count }` |
| `tasks_by_priority` | jsonb | `{ "priority_id": count }` |
| `tasks_by_assignee` | jsonb | `{ "member_id": count }` |

## Entity Relationships

```
Workspace 1──N Project
Workspace 1──N Member
Workspace 1──N Priority

Project 1──N Task
Project 1──N Status
Project 1──N Label
Project 1──N WikiPage
Project 1──N View
Project 1──N DailyProjectStats

Task N──1 Status
Task N──1 Priority
Task N──1 Member (assignee)
Task N──1 Member (reporter)
Task 1──N Task (subtasks)
Task N──M Label (via TaskLabel)
Task 1──1 TaskCanvasPosition
Task 1──N Comment
Task 1──N Attachment
Task 1──N Activity
Task N──M WikiPage (via WikiPageTaskLink)

WikiPage 1──N WikiPage (children)
WikiPage 1──N Comment
WikiPage 1──N Attachment

Member N──1 User
View N──1 Member (created_by)
Comment N──1 Member (created_by)
Activity N──1 Member (actor)
```

## Indexes

Recommended indexes for common queries:

```sql
-- Task lookups
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status_id ON tasks(status_id);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_project_sequence ON tasks(project_id, sequence_id);

-- Canvas positions
CREATE UNIQUE INDEX idx_canvas_task_view ON task_canvas_positions(task_id, view_id);

-- Activity feed
CREATE INDEX idx_activity_project_created ON activity(project_id, created_at DESC);
CREATE INDEX idx_activity_task_id ON activity(task_id);

-- Wiki
CREATE INDEX idx_wiki_pages_project ON wiki_pages(project_id);
CREATE INDEX idx_wiki_pages_parent ON wiki_pages(parent_id);

-- Full-text search (PostgreSQL)
CREATE INDEX idx_tasks_search ON tasks USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));
CREATE INDEX idx_wiki_search ON wiki_pages USING gin(to_tsvector('english', title || ' ' || COALESCE(content, '')));
```

## Notes

- **Canvas View**: The `TaskCanvasPosition` table is separate to allow different positions per view and keep the Task entity clean for list/board views.
- **Soft Deletes**: Use `is_archived` flags rather than hard deletes to preserve history and allow restoration.
- **Multi-tenancy**: Workspace provides isolation; all queries should be scoped by `workspace_id` or `project_id`.
- **Real-time Updates**: Consider WebSocket subscriptions per project for live collaboration on the canvas.
