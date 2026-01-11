/**
 * Task Canvas - Vanilla JS MVP
 * Simple hash-based routing and JSON data loading
 */

// ==========================================================================
// Color System - Centralized color palette using CSS variables
// ==========================================================================

/**
 * Gets the computed value of a CSS custom property
 * @param {string} varName - CSS variable name (e.g., '--color-primary-500')
 * @returns {string} - The computed color value
 */
function getCSSVar(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

/**
 * Color palette mapped to CSS variable names for consistency with design tokens.
 * These correspond to --color-palette-* variables in tokens.css
 */
const COLOR_PALETTE = {
  blue:    { hex: '#3b82f6', cssVar: '--color-palette-1', name: 'Blue' },
  purple:  { hex: '#8b5cf6', cssVar: '--color-palette-2', name: 'Purple' },
  pink:    { hex: '#ec4899', cssVar: '--color-palette-3', name: 'Pink' },
  red:     { hex: '#ef4444', cssVar: '--color-palette-4', name: 'Red' },
  amber:   { hex: '#f59e0b', cssVar: '--color-palette-5', name: 'Amber' },
  green:   { hex: '#22c55e', cssVar: '--color-palette-6', name: 'Green' },
  cyan:    { hex: '#06b6d4', cssVar: '--color-palette-7', name: 'Cyan' },
  indigo:  { hex: '#6366f1', cssVar: '--color-palette-8', name: 'Indigo' },
  gray:    { hex: '#6b7280', cssVar: '--color-palette-fallback', name: 'Gray' },
  lime:    { hex: '#84cc16', cssVar: '--color-lime-500', name: 'Lime' },
  emerald: { hex: '#10b981', cssVar: '--color-green-500', name: 'Emerald' },
};

// Pre-computed arrays for quick access
const AVATAR_COLORS = ['blue', 'purple', 'pink', 'red', 'amber', 'green', 'cyan', 'indigo'].map(k => COLOR_PALETTE[k].hex);
const PROJECT_COLORS = ['blue', 'purple', 'pink', 'red', 'amber', 'green', 'cyan', 'indigo'].map(k => COLOR_PALETTE[k].hex);
const WORKFLOW_COLORS = ['gray', 'blue', 'purple', 'pink', 'red', 'amber', 'green', 'cyan'].map(k => COLOR_PALETTE[k].hex);
const FALLBACK_COLOR = COLOR_PALETTE.gray.hex;

// ==========================================================================
// State
// ==========================================================================

const state = {
  workspace: null,
  projects: [],
  tasks: [],
  statuses: [],
  users: [],
  priorities: [],
  labels: [],
  files: [],

  // UI State
  currentView: 'grid', // 'grid' or 'list'
  currentFilter: 'all', // 'all', 'favorites', 'archived'
  currentProjectTab: 'tasks', // 'tasks' or 'board'
  currentInsightsTab: 'overview', // 'overview', 'members', 'tasks'
  projectGroupBy: {}, // { projectId: 'none' | 'status' | 'priority' | 'assignee' } - for list view
  projectSort: {}, // { projectId: { field: 'title' | 'priority' | 'dueDate' | 'created' | 'updated', direction: 'asc' | 'desc' } }
  boardSwimlane: {}, // { projectId: 'none' | 'priority' | 'assignee' } - for board view
  showArchivedTasks: {}, // { projectId: boolean }
  assignedToMe: {}, // { projectId: boolean } - filter to show only tasks assigned to current user
  assigneeFilter: {}, // { projectId: [userId1, userId2, ...] } - filter by selected assignees
  projectFields: {}, // { projectId: { status: bool, priority: bool, ... } }
  taskSearch: {}, // { projectId: string } - search query for filtering tasks
  collapsedGroups: new Set(),
  selectedFiles: new Set(),
  selectedTasks: new Set(),
  selectedMembers: new Set(),

  // Pagination state
  filesPagination: { page: 1, pageSize: 10 },
  membersPagination: { page: 1, pageSize: 10 },

  // Roadmap state
  roadmapScale: 'month', // 'week' | 'month' | 'quarter' | 'year'
  roadmapOffset: 0, // Timeline navigation offset (in scale units)

  // Modal state
  activeModal: null,
  activeDropdown: null,
  quickAddStatus: null, // For inline task creation (group ID)
  quickAddGroupType: null, // For inline task creation (group type)

  // Task detail panel state
  openTaskId: null,
  openTaskProjectSlug: null,

  // File preview panel state
  openFileId: null,
  openFileProjectSlug: null,
};

// ==========================================================================
// Event Listener Cleanup (Memory Leak Prevention)
// ==========================================================================

// AbortController for cleaning up event listeners on re-renders
let viewAbortController = new AbortController();

/**
 * Get the current abort signal for view-level event listeners.
 * All event listeners attached during renders should use this signal
 * so they can be automatically cleaned up on re-render.
 */
function getViewSignal() {
  return viewAbortController.signal;
}

/**
 * Clean up all view-level event listeners before a re-render.
 * This prevents memory leaks from accumulating event listeners.
 */
function cleanupViewListeners() {
  viewAbortController.abort();
  viewAbortController = new AbortController();
}

// ==========================================================================
// Data Loading
// ==========================================================================

async function loadJSON(filename) {
  try {
    const response = await fetch(`data/${filename}`);
    if (!response.ok) throw new Error(`Failed to load ${filename}`);
    return await response.json();
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    return null;
  }
}

async function loadAllData() {
  const [workspace, projects, tasks, statuses, users, priorities, labels, files] = await Promise.all([
    loadJSON('workspace.json'),
    loadJSON('projects.json'),
    loadJSON('tasks.json'),
    loadJSON('statuses.json'),
    loadJSON('users.json'),
    loadJSON('priorities.json'),
    loadJSON('labels.json'),
    loadJSON('files.json'),
  ]);

  state.workspace = workspace;
  state.projects = projects || [];
  state.tasks = tasks || [];
  state.statuses = statuses || [];
  state.users = users || [];
  state.priorities = priorities || [];
  state.labels = labels || [];
  state.files = files || [];
}

// ==========================================================================
// Data Helpers
// ==========================================================================

function getProjectById(id) {
  return state.projects.find(p => p.id === id);
}

function getProjectBySlug(slug) {
  return state.projects.find(p => p.slug === slug);
}

function getTasksForProject(projectId, includeArchived = null) {
  // If includeArchived is not specified, use the project's showArchivedTasks setting
  const showArchived = includeArchived !== null ? includeArchived : (state.showArchivedTasks[projectId] || false);
  const searchQuery = (state.taskSearch[projectId] || '').toLowerCase().trim();
  const filterAssignedToMe = state.assignedToMe[projectId] || false;
  const currentUser = getCurrentUser();

  return state.tasks.filter(t => {
    // Project filter
    if (t.project_id !== projectId) return false;

    // Archived filter
    if (!showArchived && t.is_archived) return false;

    // Assigned to me filter
    if (filterAssignedToMe && currentUser) {
      if (t.assignee_id !== currentUser.id) return false;
    }

    // Assignee filter (multi-select)
    const selectedAssignees = state.assigneeFilter[projectId] || [];
    if (selectedAssignees.length > 0) {
      // Check if task's assignee is in selected list, or if 'unassigned' is selected and task has no assignee
      const hasUnassigned = selectedAssignees.includes('unassigned');
      const taskAssigneeSelected = t.assignee_id && selectedAssignees.includes(t.assignee_id);
      const taskIsUnassigned = !t.assignee_id && hasUnassigned;
      if (!taskAssigneeSelected && !taskIsUnassigned) return false;
    }

    // Search filter
    if (searchQuery) {
      const titleMatch = t.title.toLowerCase().includes(searchQuery);
      const descMatch = t.description?.toLowerCase().includes(searchQuery);
      const keyMatch = t.key?.toLowerCase().includes(searchQuery);

      // Also search in assignee name
      const assignee = t.assignee_id ? state.users.find(u => u.id === t.assignee_id) : null;
      const assigneeMatch = assignee?.name?.toLowerCase().includes(searchQuery);

      // Search in labels
      const taskLabels = t.label_ids?.map(id => state.labels.find(l => l.id === id)?.name?.toLowerCase()) || [];
      const labelMatch = taskLabels.some(name => name?.includes(searchQuery));

      if (!titleMatch && !descMatch && !keyMatch && !assigneeMatch && !labelMatch) return false;
    }

    return true;
  });
}

function getDefaultFields() {
  return {
    taskKey: true,
    status: true,
    priority: true,
    assignee: true,
    dueDate: true,
    labels: true,
    progress: false
  };
}

function getProjectFields(projectId) {
  return state.projectFields[projectId] || getDefaultFields();
}

function getStatusById(id) {
  return state.statuses.find(s => s.id === id);
}

function getStatusesForProject(projectId) {
  return state.statuses.filter(s => s.project_id === projectId).sort((a, b) => a.sort_order - b.sort_order);
}

function getUserById(id) {
  return state.users.find(u => u.id === id);
}

function getCurrentUser() {
  // In a real app, this would come from auth state
  // For demo, we use the first user (Sarah Chen) as the current user
  return state.users[0];
}

function getPriorityById(id) {
  return state.priorities.find(p => p.id === id);
}

function getPriorityIcon(priorityName) {
  if (!priorityName) return '';
  const name = priorityName.toLowerCase();
  if (name === 'highest' || name === 'urgent' || name === 'critical') return icons.priorityHighest;
  if (name === 'high') return icons.priorityHigh;
  if (name === 'medium' || name === 'normal') return icons.priorityMedium;
  if (name === 'low') return icons.priorityLow;
  if (name === 'lowest' || name === 'trivial') return icons.priorityLowest;
  return icons.priorityMedium; // Default fallback
}

function getLabelById(id) {
  return state.labels.find(l => l.id === id);
}

function getLabelsForProject(projectId) {
  return state.labels.filter(l => l.project_id === projectId);
}

function getFilesForProject(projectId) {
  return state.files.filter(f => f.project_id === projectId);
}

function getTaskById(id) {
  return state.tasks.find(t => t.id === id);
}

function getFileById(id) {
  return state.files.find(f => f.id === id);
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileTypeFromName(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const typeMap = {
    pdf: 'pdf',
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image',
    doc: 'document', docx: 'document', txt: 'document', rtf: 'document',
    xls: 'spreadsheet', xlsx: 'spreadsheet', csv: 'spreadsheet',
    zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
    dwg: 'cad', dxf: 'cad', step: 'cad', stp: 'cad'
  };
  return typeMap[ext] || 'document';
}

function generateId() {
  return 'file-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
}

function handleFileUpload(fileList, projectId, taskId) {
  const currentUser = getCurrentUser();
  const newFiles = [];

  for (const file of fileList) {
    const newFile = {
      id: generateId(),
      project_id: projectId,
      task_id: taskId,
      name: file.name,
      file_type: getFileTypeFromName(file.name),
      size_bytes: file.size,
      uploaded_by: currentUser?.id || null,
      uploaded_at: new Date().toISOString()
    };
    newFiles.push(newFile);
    state.files.push(newFile);
  }

  const fileCount = newFiles.length;
  const message = fileCount === 1
    ? `"${newFiles[0].name}" uploaded successfully`
    : `${fileCount} files uploaded successfully`;

  showToast(message, 'success');

  // Re-render the current view
  if (state.openTaskId) {
    const task = getTaskById(state.openTaskId);
    if (task) {
      renderTaskPanel(task, state.openTaskProjectSlug);
      attachTaskPanelEventListeners(state.openTaskId, state.openTaskProjectSlug);
    }
  }

  const currentPath = window.location.hash.slice(1);
  const projectMatch = currentPath.match(/^\/projects\/([^/]+)/);
  if (projectMatch) {
    renderProjectDetail(projectMatch[1]);
  }
}

function calculateProjectProgress(projectId) {
  const tasks = getTasksForProject(projectId);
  if (tasks.length === 0) return { done: 0, total: 0, percentage: 0 };

  const statuses = getStatusesForProject(projectId);
  const doneStatusIds = statuses.filter(s => s.category === 'done').map(s => s.id);

  const doneTasks = tasks.filter(t => doneStatusIds.includes(t.status_id));
  const percentage = Math.round((doneTasks.length / tasks.length) * 100);

  return {
    done: doneTasks.length,
    total: tasks.length,
    percentage
  };
}

function getProjectMembers(projectId) {
  const tasks = getTasksForProject(projectId);
  const memberIds = [...new Set(tasks.map(t => t.assignee_id).filter(Boolean))];
  return memberIds.map(id => getUserById(id)).filter(Boolean);
}

function getFilteredProjects() {
  return state.projects.filter(project => {
    switch (state.currentFilter) {
      case 'favorites':
        return project.is_favorite && !project.is_archived;
      case 'archived':
        return project.is_archived;
      default:
        return !project.is_archived;
    }
  });
}

// ==========================================================================
// Routing
// ==========================================================================

function parseRoute() {
  const hash = window.location.hash || '#/projects';
  const parts = hash.slice(2).split('/'); // Remove '#/'

  return {
    page: parts[0] || 'projects',
    param: parts[1] || null
  };
}

function navigate(path) {
  window.location.hash = path;
}

function handleRouteChange() {
  const route = parseRoute();

  // Update nav active state
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.nav === route.page);
  });

  // Render appropriate view
  switch (route.page) {
    case 'projects':
      if (route.param) {
        renderProjectDetail(route.param);
      } else {
        renderProjectsLanding();
      }
      break;
    case 'reports':
      renderPlaceholderPage('Reports', 'Analytics and reporting features coming soon.');
      break;
    case 'wiki':
      renderPlaceholderPage('Wiki', 'Documentation and wiki features coming soon.');
      break;
    case 'ai-assistant':
      renderPlaceholderPage('AI Assistant', 'Intelligent task suggestions and automation coming soon.');
      break;
    default:
      renderProjectsLanding();
  }
}

// ==========================================================================
// Icons (SVG)
// ==========================================================================

const icons = {
  grid: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>`,
  list: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>`,
  plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>`,
  star: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>`,
  starFilled: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>`,
  check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`,
  tasks: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>`,
  users: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>`,
  chevronDown: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="6 9 12 15 18 9"/>
  </svg>`,
  chevronRight: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="9 18 15 12 9 6"/>
  </svg>`,
  chevronLeft: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="15 18 9 12 15 6"/>
  </svg>`,
  search: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>`,
  filter: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>`,
  sort: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="16" y2="12"/><line x1="4" y1="18" x2="12" y2="18"/>
  </svg>`,
  arrowUp: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
  </svg>`,
  arrowDown: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
  </svg>`,
  grip: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
    <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
  </svg>`,
  folder: `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>`,
  moreHorizontal: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>
  </svg>`,
  settings: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>`,
  tag: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>`,
  file: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>`,
  filePdf: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15v-2h2c.6 0 1 .4 1 1s-.4 1-1 1H9z"/>
  </svg>`,
  fileImage: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
  </svg>`,
  fileArchive: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="11"/><line x1="12" y1="15" x2="12" y2="15"/><line x1="12" y1="19" x2="12" y2="19"/>
  </svg>`,
  fileSpreadsheet: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="12" y1="9" x2="12" y2="21"/>
  </svg>`,
  download: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>`,
  eye: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>`,
  trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>`,
  upload: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>`,
  link: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>`,
  x: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>`,
  close: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>`,
  mail: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>`,
  calendar: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>`,
  flag: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
  </svg>`,
  flagOutline: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
  </svg>`,
  hash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
  </svg>`,
  barChart: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>
  </svg>`,
  user: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>`,
  userPlus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
  </svg>`,
  edit: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>`,
  checkCircle: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>`,
  clock: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>`,
  warning: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>`,
  // Priority arrows (Jira-style)
  priorityHighest: `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M3 10l5-6 5 6H3z"/><path d="M3 14l5-6 5 6H3z"/>
  </svg>`,
  priorityHigh: `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M3 12l5-6 5 6H3z"/>
  </svg>`,
  priorityMedium: `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <rect x="2" y="7" width="12" height="2" rx="1"/>
  </svg>`,
  priorityLow: `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M3 4l5 6 5-6H3z"/>
  </svg>`,
  priorityLowest: `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M3 2l5 6 5-6H3z"/><path d="M3 6l5 6 5-6H3z"/>
  </svg>`,
};

// ==========================================================================
// Render Functions - Projects Landing
// ==========================================================================

function renderProjectsLanding() {
  // Clean up previous event listeners to prevent memory leaks
  cleanupViewListeners();

  updateBreadcrumb([{ label: 'Projects', href: '#/projects' }]);

  const projects = getFilteredProjects();
  const mainContent = document.getElementById('main-content');

  mainContent.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">
        <span class="page-title-count">${projects.length}</span> Projects
      </h1>
      <div class="page-actions">
        <div class="view-toggle">
          <button class="view-toggle-btn ${state.currentView === 'grid' ? 'active' : ''}" data-view="grid">
            ${icons.grid} Grid
          </button>
          <button class="view-toggle-btn ${state.currentView === 'list' ? 'active' : ''}" data-view="list">
            ${icons.list} List
          </button>
        </div>
        <div class="filter-tabs">
          <button class="filter-tab ${state.currentFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
          <button class="filter-tab ${state.currentFilter === 'favorites' ? 'active' : ''}" data-filter="favorites">Favorites</button>
          <button class="filter-tab ${state.currentFilter === 'archived' ? 'active' : ''}" data-filter="archived">Archived</button>
        </div>
        <button class="btn-primary" data-action="create-project">
          ${icons.plus} Create Project
        </button>
      </div>
    </div>

    ${projects.length === 0
      ? renderEmptyState()
      : state.currentView === 'grid'
        ? renderProjectsGrid(projects)
        : renderProjectsList(projects)
    }
  `;

  // Attach event listeners
  attachProjectsEventListeners();
}

function renderEmptyState() {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icons.folder}</div>
      <h2 class="empty-state-title">No projects found</h2>
      <p class="empty-state-description">
        ${state.currentFilter === 'favorites'
          ? 'You haven\'t favorited any projects yet.'
          : state.currentFilter === 'archived'
            ? 'No archived projects.'
            : 'Get started by creating your first project.'}
      </p>
      ${state.currentFilter === 'all'
        ? `<button class="btn-primary" data-action="create-project">${icons.plus} Create Project</button>`
        : ''}
    </div>
  `;
}

function renderProjectsGrid(projects) {
  return `
    <div class="projects-grid">
      ${projects.map(project => {
        const progress = calculateProjectProgress(project.id);
        const members = getProjectMembers(project.id);

        return `
          <div class="card card--project project-card" data-project-slug="${project.slug}" style="--project-color: ${project.color}">
            <div class="project-card-header">
              <div>
                <h3 class="project-name">${escapeHtml(project.name)}</h3>
                <span class="project-identifier">${escapeHtml(project.identifier)}</span>
              </div>
              <button class="project-favorite ${project.is_favorite ? 'is-favorite' : ''}" data-project-id="${project.id}">
                ${project.is_favorite ? icons.starFilled : icons.star}
              </button>
            </div>
            <div class="project-progress">
              <div class="progress-label">
                <span>Progress</span>
                <span>${progress.percentage}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress.percentage}%"></div>
              </div>
            </div>
            <div class="project-meta">
              <div class="project-stat">
                ${icons.tasks}
                <span>${progress.done}/${progress.total} tasks</span>
              </div>
              <div class="project-stat">
                ${icons.users}
                <span>${members.length} members</span>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderProjectsList(projects) {
  return `
    <div class="projects-list">
      ${projects.map(project => {
        const progress = calculateProjectProgress(project.id);
        const members = getProjectMembers(project.id);

        return `
          <div class="project-list-item" data-project-slug="${project.slug}">
            <div class="project-list-color" style="--project-color: ${project.color}"></div>
            <div class="project-list-info">
              <div class="project-list-name">${escapeHtml(project.name)}</div>
              <div class="project-identifier">${escapeHtml(project.identifier)}</div>
            </div>
            <div class="project-list-progress">
              <div class="progress-label">
                <span>Progress</span>
                <span>${progress.percentage}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress.percentage}%; background: ${project.color}"></div>
              </div>
            </div>
            <div class="project-stat">
              ${icons.tasks}
              <span>${progress.done}/${progress.total}</span>
            </div>
            <div class="project-stat">
              ${icons.users}
              <span>${members.length}</span>
            </div>
            <button class="project-favorite ${project.is_favorite ? 'is-favorite' : ''}" data-project-id="${project.id}">
              ${project.is_favorite ? icons.starFilled : icons.star}
            </button>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function attachProjectsEventListeners() {
  const signal = getViewSignal();

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      state.currentFilter = tab.dataset.filter;
      renderProjectsLanding();
    }, { signal });
  });

  // View toggle
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentView = btn.dataset.view;
      renderProjectsLanding();
    }, { signal });
  });

  // Create Project button
  document.querySelectorAll('[data-action="create-project"]').forEach(btn => {
    btn.addEventListener('click', () => {
      showCreateProjectModal();
    }, { signal });
  });

  // Project cards/items - navigate to project detail
  document.querySelectorAll('.project-card, .project-list-item').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't navigate if clicking the favorite button
      if (e.target.closest('.project-favorite')) return;

      const slug = card.dataset.projectSlug;
      navigate(`#/projects/${slug}`);
    }, { signal });
  });

  // Favorite buttons (prevent propagation is handled above)
  document.querySelectorAll('.project-favorite').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Toggle favorite (in real app, this would persist)
      const projectId = btn.dataset.projectId;
      const project = getProjectById(projectId);
      if (project) {
        project.is_favorite = !project.is_favorite;
        renderProjectsLanding();
      }
    }, { signal });
  });
}

// ==========================================================================
// Render Functions - Project Detail (Task List & Board)
// ==========================================================================

function renderProjectDetail(slug) {
  // Clean up previous event listeners to prevent memory leaks
  cleanupViewListeners();

  const project = getProjectBySlug(slug);

  if (!project) {
    renderNotFound();
    return;
  }

  updateBreadcrumb([
    { label: 'Projects', href: '#/projects' },
    { label: project.name, href: `#/projects/${slug}` }
  ]);

  const tasks = getTasksForProject(project.id);
  const statuses = getStatusesForProject(project.id);
  const mainContent = document.getElementById('main-content');

  // Group tasks by status and sort by sort_order
  const tasksByStatus = {};
  statuses.forEach(status => {
    tasksByStatus[status.id] = tasks
      .filter(t => t.status_id === status.id)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  });

  const currentTab = state.currentProjectTab;

  mainContent.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">${escapeHtml(project.name)}</h1>
      <div class="page-actions">
        <button class="btn-secondary" data-action="invite-member" data-project-slug="${slug}">
          ${icons.users} Invite
        </button>
        <button class="btn-primary" data-action="create-task" data-project-slug="${slug}">
          ${icons.plus} Create Task
        </button>
      </div>
    </div>

    <nav class="project-tabs">
      <button class="project-tab ${currentTab === 'tasks' ? 'active' : ''}" data-tab="tasks">Task List</button>
      <button class="project-tab ${currentTab === 'board' ? 'active' : ''}" data-tab="board">Board</button>
      <button class="project-tab ${currentTab === 'roadmap' ? 'active' : ''}" data-tab="roadmap">Roadmap</button>
      <button class="project-tab ${currentTab === 'insights' ? 'active' : ''}" data-tab="insights">Insights</button>
      <button class="project-tab ${currentTab === 'files' ? 'active' : ''}" data-tab="files">Files</button>
      <button class="project-tab ${currentTab === 'members' ? 'active' : ''}" data-tab="members">Members</button>
      <button class="project-tab ${currentTab === 'settings' ? 'active' : ''}" data-tab="settings">Settings</button>
    </nav>

    ${renderTabContent(currentTab, statuses, tasksByStatus, tasks, project)}
  `;

  // Attach event listeners
  attachProjectDetailEventListeners(slug);
}

function renderTabContent(tab, statuses, tasksByStatus, tasks, project) {
  const groupBy = state.projectGroupBy[project.id] || 'none';
  const swimlane = state.boardSwimlane[project.id] || 'none';

  switch (tab) {
    case 'board':
      return `<div class="board-view">${renderBoardToolbar(project)}${renderBoardView(statuses, tasksByStatus, tasks, project, swimlane)}</div>`;
    case 'roadmap':
      return renderRoadmapView(tasks, project);
    case 'insights':
      return renderInsightsView(tasks, project);
    case 'members':
      return renderMembersView(tasks, project);
    case 'files':
      return renderFilesView(project);
    case 'settings':
      return renderSettingsView(project);
    default:
      return `<div class="task-list-view">${renderTaskListToolbar(project, groupBy)}${renderTaskListView(statuses, tasksByStatus, tasks, project, groupBy)}</div>`;
  }
}

function getProjectSort(projectId) {
  return state.projectSort[projectId] || { field: 'manual', direction: 'asc' };
}

function renderTaskListToolbar(project, groupBy) {
  const showArchived = state.showArchivedTasks[project.id] || false;
  const assignedToMe = state.assignedToMe[project.id] || false;
  const selectedAssignees = state.assigneeFilter[project.id] || [];
  const assigneeFilterCount = selectedAssignees.length;
  const sort = getProjectSort(project.id);
  const groupByLabels = {
    none: 'None',
    status: 'Status',
    priority: 'Priority',
    assignee: 'Assignee'
  };
  const sortLabels = {
    manual: 'Manual',
    title: 'Title',
    priority: 'Priority',
    dueDate: 'Due Date',
    created: 'Created',
    updated: 'Updated'
  };
  const sortLabel = sortLabels[sort.field] || 'Manual';
  const directionIcon = sort.field !== 'manual' ? (sort.direction === 'asc' ? icons.arrowUp : icons.arrowDown) : '';

  const searchQuery = state.taskSearch[project.id] || '';
  const searchExpanded = searchQuery.length > 0;

  return `
    <div class="view-toolbar view-toolbar--wrap">
      <div class="toolbar-filters">
        <div class="toolbar-search ${searchExpanded ? 'expanded' : ''}" data-project-id="${project.id}">
          <button class="filter-btn toolbar-search-toggle" data-action="toggle-search" aria-label="Search tasks" aria-expanded="${searchExpanded}">
            ${icons.search}
            <span class="toolbar-search-label">Search</span>
          </button>
          <div class="toolbar-search-input-wrapper">
            <span class="toolbar-search-icon">${icons.search}</span>
            <input type="text"
                   class="toolbar-search-input"
                   placeholder="Search tasks..."
                   value="${escapeHtml(searchQuery)}"
                   data-action="search-tasks"
                   aria-label="Search tasks">
            <button class="toolbar-search-clear" data-action="clear-search" aria-label="Clear search">
              ${icons.x}
            </button>
          </div>
        </div>
        <button class="filter-btn" data-action="toggle-sort">
          ${icons.sort} ${sortLabel}
          ${directionIcon}
          ${icons.chevronDown}
        </button>
        <button class="filter-btn" data-action="toggle-group-by">
          ${icons.grid} Group by ${groupByLabels[groupBy]}
          ${icons.chevronDown}
        </button>
        <button class="filter-btn ${assigneeFilterCount > 0 ? 'active' : ''}" data-action="toggle-assignee-filter">
          ${icons.user} Assignee${assigneeFilterCount > 0 ? ` (${assigneeFilterCount})` : ''}
          ${icons.chevronDown}
        </button>
        <label class="checkbox-label">
          <input type="checkbox" class="checkbox-input" data-action="toggle-assigned-to-me" ${assignedToMe ? 'checked' : ''}>
          <span class="checkbox-custom"></span>
          <span class="checkbox-text">Assigned to me</span>
        </label>
      </div>
      <div class="toolbar-actions">
        <label class="checkbox-label">
          <input type="checkbox" class="checkbox-input" data-action="toggle-archived" ${showArchived ? 'checked' : ''}>
          <span class="checkbox-custom"></span>
          <span class="checkbox-text">Show archived</span>
        </label>
        <button class="filter-btn" data-action="toggle-fields">
          ${icons.settings} Fields
          ${icons.chevronDown}
        </button>
        <button class="btn-manage-workflow">
          ${icons.settings} Manage Workflow
        </button>
      </div>
    </div>
  `;
}

function renderBoardToolbar(project) {
  const showArchived = state.showArchivedTasks[project.id] || false;
  const assignedToMe = state.assignedToMe[project.id] || false;
  const swimlane = state.boardSwimlane[project.id] || 'none';
  const selectedAssignees = state.assigneeFilter[project.id] || [];
  const assigneeFilterCount = selectedAssignees.length;
  const swimlaneLabels = {
    none: 'None',
    priority: 'Priority',
    assignee: 'Assignee'
  };

  const searchQuery = state.taskSearch[project.id] || '';
  const searchExpanded = searchQuery.length > 0;

  return `
    <div class="view-toolbar view-toolbar--wrap">
      <div class="toolbar-filters">
        <div class="toolbar-search ${searchExpanded ? 'expanded' : ''}" data-project-id="${project.id}">
          <button class="filter-btn toolbar-search-toggle" data-action="toggle-search" aria-label="Search tasks" aria-expanded="${searchExpanded}">
            ${icons.search}
            <span class="toolbar-search-label">Search</span>
          </button>
          <div class="toolbar-search-input-wrapper">
            <span class="toolbar-search-icon">${icons.search}</span>
            <input type="text"
                   class="toolbar-search-input"
                   placeholder="Search tasks..."
                   value="${escapeHtml(searchQuery)}"
                   data-action="search-tasks"
                   aria-label="Search tasks">
            <button class="toolbar-search-clear" data-action="clear-search" aria-label="Clear search">
              ${icons.x}
            </button>
          </div>
        </div>
        <button class="filter-btn" data-action="toggle-swimlane">
          ${icons.grid} Group by ${swimlaneLabels[swimlane]}
          ${icons.chevronDown}
        </button>
        <button class="filter-btn ${assigneeFilterCount > 0 ? 'active' : ''}" data-action="toggle-assignee-filter">
          ${icons.user} Assignee${assigneeFilterCount > 0 ? ` (${assigneeFilterCount})` : ''}
          ${icons.chevronDown}
        </button>
        <label class="checkbox-label">
          <input type="checkbox" class="checkbox-input" data-action="toggle-assigned-to-me" ${assignedToMe ? 'checked' : ''}>
          <span class="checkbox-custom"></span>
          <span class="checkbox-text">Assigned to me</span>
        </label>
      </div>
      <div class="toolbar-actions">
        <label class="checkbox-label">
          <input type="checkbox" class="checkbox-input" data-action="toggle-archived" ${showArchived ? 'checked' : ''}>
          <span class="checkbox-custom"></span>
          <span class="checkbox-text">Show archived</span>
        </label>
        <button class="filter-btn" data-action="toggle-fields">
          ${icons.settings} Fields
          ${icons.chevronDown}
        </button>
        <button class="btn-manage-workflow">
          ${icons.settings} Manage Workflow
        </button>
      </div>
    </div>
  `;
}

function getGroupsForTasks(tasks, project, groupBy) {
  const groups = [];
  const tasksByGroup = {};

  if (groupBy === 'none') {
    // No grouping - single flat list
    groups.push({
      id: 'all-tasks',
      name: 'All Tasks',
      color: null,
      type: 'none'
    });
    tasksByGroup['all-tasks'] = [...tasks];
  } else if (groupBy === 'status') {
    // Group by workflow status
    const statuses = getStatusesForProject(project.id);
    statuses.forEach(status => {
      groups.push({
        id: status.id,
        name: status.name,
        color: status.color,
        type: 'status'
      });
      tasksByGroup[status.id] = [];
    });
    tasks.forEach(task => {
      if (tasksByGroup[task.status_id]) {
        tasksByGroup[task.status_id].push(task);
      }
    });
  } else if (groupBy === 'priority') {
    // Group by priority
    const priorityOrder = ['priority-high', 'priority-medium', 'priority-low', 'priority-none'];
    const priorityGroups = [
      { id: 'priority-high', name: 'High', color: COLOR_PALETTE.red.hex, type: 'priority', priorityId: 'priority-high' },
      { id: 'priority-medium', name: 'Medium', color: COLOR_PALETTE.amber.hex, type: 'priority', priorityId: 'priority-medium' },
      { id: 'priority-low', name: 'Low', color: COLOR_PALETTE.emerald.hex, type: 'priority', priorityId: 'priority-low' },
      { id: 'priority-none', name: 'No Priority', color: COLOR_PALETTE.gray.hex, type: 'priority', priorityId: null }
    ];
    priorityGroups.forEach(pg => {
      groups.push(pg);
      tasksByGroup[pg.id] = [];
    });
    tasks.forEach(task => {
      const groupId = task.priority_id || 'priority-none';
      if (tasksByGroup[groupId]) {
        tasksByGroup[groupId].push(task);
      } else {
        tasksByGroup['priority-none'].push(task);
      }
    });
  } else if (groupBy === 'assignee') {
    // Group by assignee
    const projectMembers = getProjectMembers(project.id);

    // Add unassigned group first
    groups.push({
      id: 'unassigned',
      name: 'Unassigned',
      color: FALLBACK_COLOR,
      type: 'assignee',
      assigneeId: null
    });
    tasksByGroup['unassigned'] = [];

    // Add member groups
    projectMembers.forEach(member => {
      groups.push({
        id: `assignee-${member.id}`,
        name: member.name,
        color: stringToColor(member.name),
        type: 'assignee',
        assigneeId: member.id
      });
      tasksByGroup[`assignee-${member.id}`] = [];
    });

    tasks.forEach(task => {
      if (task.assignee_id) {
        const groupId = `assignee-${task.assignee_id}`;
        if (tasksByGroup[groupId]) {
          tasksByGroup[groupId].push(task);
        } else {
          tasksByGroup['unassigned'].push(task);
        }
      } else {
        tasksByGroup['unassigned'].push(task);
      }
    });
  }

  return { groups, tasksByGroup };
}

function renderTaskListView(statuses, tasksByStatus, tasks, project, groupBy) {
  const { groups, tasksByGroup } = getGroupsForTasks(tasks, project, groupBy);

  return `
    <div class="task-table-container">
      ${groups.map(group => renderTaskGroup(group, tasksByGroup[group.id] || [], project, groupBy)).join('')}
    </div>
  `;
}

function renderBoardView(statuses, tasksByStatus, tasks, project, swimlane) {
  // Board always uses Status for columns
  return `
    <div class="board-container">
      ${statuses.map(status => {
        const statusTasks = tasks.filter(t => t.status_id === status.id);
        return renderBoardColumn(status, statusTasks, project, swimlane);
      }).join('')}
    </div>
  `;
}

function renderBoardColumn(status, tasks, project, swimlane) {
  const isQuickAdding = state.quickAddStatus === status.id;
  const isEmpty = tasks.length === 0;

  // Get swimlanes if enabled
  const swimlanes = getSwimlanes(tasks, project, swimlane);

  return `
    <div class="board-column" data-group-id="${status.id}" data-group-type="status" style="--column-color: ${status.color}">
      <div class="board-column-header">
        <div class="board-column-title">
          <span class="board-column-name">${escapeHtml(status.name)}</span>
          <span class="count-badge">${tasks.length}</span>
        </div>
        <div class="board-column-actions">
          <button class="icon-btn board-column-btn" title="Add task">
            ${icons.plus}
          </button>
          <button class="icon-btn board-column-btn" title="More options">
            ${icons.moreHorizontal}
          </button>
        </div>
      </div>
      <div class="board-column-content">
        ${isEmpty && !isQuickAdding ? `
          <div class="board-column-empty">
            <span class="board-column-empty-text">No tasks yet</span>
            <span class="board-column-empty-hint">Drag tasks here or click below to add</span>
          </div>
        ` : swimlane === 'none' ? `
          ${tasks.map(task => renderBoardCard(task, project)).join('')}
        ` : `
          ${swimlanes.map(lane => renderBoardSwimlane(lane, tasks.filter(t => lane.filter(t)), project, status)).join('')}
        `}
      </div>
      ${isQuickAdding ? `
        <div class="quick-add-input">
          <input type="text" placeholder="Task title..." autofocus>
          <div class="quick-add-actions">
            <button class="quick-add-btn save">Save</button>
            <button class="quick-add-btn cancel">Cancel</button>
          </div>
        </div>
      ` : `
        <div class="board-add-card">
          ${icons.plus} Add Task
        </div>
      `}
    </div>
  `;
}

function getSwimlanes(tasks, project, swimlane) {
  if (swimlane === 'none') return [];

  if (swimlane === 'priority') {
    const lanes = state.priorities
      .slice()
      .sort((a, b) => b.sort_order - a.sort_order)
      .map(priority => ({
        id: priority.id,
        name: priority.name,
        color: priority.color,
        filter: t => t.priority_id === priority.id
      }));
    lanes.push({ id: 'priority-none', name: 'No Priority', color: FALLBACK_COLOR, filter: t => !t.priority_id });
    return lanes;
  }

  if (swimlane === 'assignee') {
    const projectMembers = getProjectMembers(project.id);
    const lanes = [
      { id: 'unassigned', name: 'Unassigned', color: FALLBACK_COLOR, filter: t => !t.assignee_id }
    ];
    projectMembers.forEach(member => {
      lanes.push({
        id: `assignee-${member.id}`,
        name: member.name,
        color: stringToColor(member.name),
        filter: t => t.assignee_id === member.id
      });
    });
    return lanes;
  }

  return [];
}

function renderBoardSwimlane(lane, tasks, project, status) {
  if (tasks.length === 0) return '';

  return `
    <div class="board-swimlane" data-swimlane-id="${lane.id}">
      <div class="board-swimlane-header">
        <span class="board-swimlane-color" style="background: ${lane.color}"></span>
        <span class="board-swimlane-name">${escapeHtml(lane.name)}</span>
        <span class="board-swimlane-count">${tasks.length}</span>
      </div>
      <div class="board-swimlane-cards">
        ${tasks.map(task => renderBoardCard(task, project)).join('')}
      </div>
    </div>
  `;
}

function renderBoardCard(task, project) {
  const fields = getProjectFields(project.id);
  const assignee = task.assignee_id ? getUserById(task.assignee_id) : null;
  const taskLabels = (task.label_ids || []).map(id => getLabelById(id)).filter(Boolean);
  const firstLabel = taskLabels[0];
  const status = getStatusById(task.status_id);
  const priority = task.priority_id ? getPriorityById(task.priority_id) : null;
  const priorityBg = priority ? hexToRgba(priority.color, 0.15) : '';
  const taskKey = `${project.identifier}-${task.sequence_id}`;
  const dueDateOverdue = isOverdue(task.due_date);
  const isArchived = task.is_archived;

  // Check if footer has any visible content
  const hasFooterContent = (fields.dueDate && task.due_date) || fields.assignee;

  return `
    <div class="card card--board board-card ${isArchived ? 'archived' : ''}" data-task-id="${task.id}" draggable="true">
      <div class="board-card-header">
        <div class="board-card-header-left">
          ${fields.taskKey ? `<span class="task-key">${escapeHtml(taskKey)}</span>` : ''}
          ${fields.labels && firstLabel ? `
            <span class="task-label">${escapeHtml(firstLabel.name)}</span>
          ` : ''}
        </div>
        ${fields.priority && priority ? `
          <span class="task-priority" style="background: ${priorityBg}; color: var(--color-text-secondary)">
            ${getPriorityIcon(priority.name)} ${escapeHtml(priority.name)}
          </span>
        ` : ''}
      </div>
      <div class="task-title">${escapeHtml(task.title)}</div>
      ${hasFooterContent ? `
        <div class="board-card-footer">
          <div class="board-card-meta">
            ${fields.dueDate && task.due_date ? `
              <span class="task-due-date ${dueDateOverdue ? 'overdue' : ''}">
                ${formatDate(task.due_date)}
              </span>
            ` : ''}
          </div>
          <div class="board-card-actions">
            ${fields.assignee ? `
              ${assignee
                ? `<div class="table-avatar board-card-assignee" style="background: ${stringToColor(assignee.name)}" title="${escapeHtml(assignee.name)}">
                    ${getInitials(assignee.name)}
                  </div>`
                : ''}
              <button class="add-icon-btn" title="Assign">+</button>
            ` : ''}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function attachProjectDetailEventListeners(slug) {
  const signal = getViewSignal();

  // Tab switching
  document.querySelectorAll('.project-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.classList.contains('placeholder')) {
        return;
      }
      const tabName = tab.dataset.tab;
      state.currentProjectTab = tabName;
      // Clear selections when switching tabs
      state.selectedFiles.clear();
      state.selectedMembers.clear();
      renderProjectDetail(slug);
    }, { signal });
  });

  // Sort dropdown (list view)
  document.querySelectorAll('[data-action="toggle-sort"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showSortDropdown(btn, slug);
    }, { signal });
  });

  // Group by dropdown (list view)
  document.querySelectorAll('[data-action="toggle-group-by"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showGroupByDropdown(btn, slug);
    }, { signal });
  });

  // Swimlane dropdown (board view)
  document.querySelectorAll('[data-action="toggle-swimlane"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showSwimlaneDropdown(btn, slug);
    }, { signal });
  });

  // Show archived toggle
  document.querySelectorAll('[data-action="toggle-archived"]').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const project = getProjectBySlug(slug);
      if (project) {
        state.showArchivedTasks[project.id] = e.target.checked;
        renderProjectDetail(slug);
      }
    }, { signal });
  });

  // Assigned to me toggle
  document.querySelectorAll('[data-action="toggle-assigned-to-me"]').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const project = getProjectBySlug(slug);
      if (project) {
        state.assignedToMe[project.id] = e.target.checked;
        renderProjectDetail(slug);
      }
    }, { signal });
  });

  // Search toggle
  document.querySelectorAll('[data-action="toggle-search"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const searchContainer = btn.closest('.toolbar-search');
      if (searchContainer) {
        searchContainer.classList.add('expanded');
        const input = searchContainer.querySelector('.toolbar-search-input');
        if (input) {
          input.focus();
        }
      }
    }, { signal });
  });

  // Search input
  document.querySelectorAll('[data-action="search-tasks"]').forEach(input => {
    let debounceTimer;
    input.addEventListener('input', (e) => {
      const project = getProjectBySlug(slug);
      if (project) {
        clearTimeout(debounceTimer);
        const cursorPosition = e.target.selectionStart;
        debounceTimer = setTimeout(() => {
          state.taskSearch[project.id] = e.target.value;
          renderProjectDetail(slug);
          // Restore focus to search input after re-render
          const newInput = document.querySelector('.toolbar-search-input');
          if (newInput) {
            newInput.focus();
            // Restore cursor position
            newInput.setSelectionRange(cursorPosition, cursorPosition);
          }
        }, 200);
      }
    }, { signal });

    // Handle escape key to clear and close search
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const project = getProjectBySlug(slug);
        if (project) {
          state.taskSearch[project.id] = '';
          const searchContainer = input.closest('.toolbar-search');
          if (searchContainer) {
            searchContainer.classList.remove('expanded');
          }
          renderProjectDetail(slug);
        }
      }
    }, { signal });

    // Close search on blur if empty - only if not actively typing
    input.addEventListener('blur', (e) => {
      const searchContainer = input.closest('.toolbar-search');
      // Use setTimeout to allow click on clear button to register and re-focus after render
      setTimeout(() => {
        const activeElement = document.activeElement;
        const isSearchInputFocused = activeElement && activeElement.classList.contains('toolbar-search-input');
        if (searchContainer && !input.value && !searchContainer.contains(document.activeElement) && !isSearchInputFocused) {
          searchContainer.classList.remove('expanded');
        }
      }, 250);
    }, { signal });
  });

  // Clear search
  document.querySelectorAll('[data-action="clear-search"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const project = getProjectBySlug(slug);
      if (project) {
        state.taskSearch[project.id] = '';
        const searchContainer = btn.closest('.toolbar-search');
        if (searchContainer) {
          searchContainer.classList.remove('expanded');
        }
        renderProjectDetail(slug);
      }
    }, { signal });
  });

  // Fields dropdown
  document.querySelectorAll('[data-action="toggle-fields"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showFieldsDropdown(btn, slug);
    }, { signal });
  });

  // Assignee filter dropdown
  document.querySelectorAll('[data-action="toggle-assignee-filter"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showAssigneeFilterDropdown(btn, slug);
    }, { signal });
  });

  // Create Task button
  document.querySelectorAll('[data-action="create-task"]').forEach(btn => {
    btn.addEventListener('click', () => {
      showCreateTaskModal(slug);
    }, { signal });
  });

  // Invite Member button
  document.querySelectorAll('[data-action="invite-member"]').forEach(btn => {
    btn.addEventListener('click', () => {
      showInviteMemberModal(slug);
    }, { signal });
  });

  // Manage Workflow button
  document.querySelectorAll('.btn-manage-workflow').forEach(btn => {
    btn.addEventListener('click', () => {
      showManageWorkflowModal(slug);
    }, { signal });
  });

  // Group toggle (for task list view)
  document.querySelectorAll('[data-toggle-group]').forEach(header => {
    header.addEventListener('click', () => {
      const statusId = header.dataset.toggleGroup;
      if (state.collapsedGroups.has(statusId)) {
        state.collapsedGroups.delete(statusId);
      } else {
        state.collapsedGroups.add(statusId);
      }
      renderProjectDetail(slug);
    }, { signal });
  });

  // Add Task rows (inline quick add)
  document.querySelectorAll('.add-task-row').forEach(row => {
    row.addEventListener('click', () => {
      const taskGroup = row.closest('.task-group');
      const groupId = taskGroup?.dataset.groupId;
      const groupType = taskGroup?.dataset.groupType;
      if (groupId) {
        showQuickAddTask(groupId, groupType, slug);
      }
    }, { signal });
  });

  // Board add task buttons
  document.querySelectorAll('.board-add-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const column = btn.closest('.board-column');
      const groupId = column?.dataset.groupId;
      const groupType = column?.dataset.groupType;
      if (groupId) {
        showQuickAddTask(groupId, groupType, slug);
      }
    }, { signal });
  });

  // Board column add buttons (+)
  document.querySelectorAll('.board-column-btn[title="Add task"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const column = btn.closest('.board-column');
      const groupId = column?.dataset.groupId;
      const groupType = column?.dataset.groupType;
      if (groupId) {
        showCreateTaskModal(slug, groupId, groupType);
      }
    }, { signal });
  });

  // Task status badges - clickable to change status
  document.querySelectorAll('.task-status.clickable').forEach(badge => {
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = badge.closest('.task-row')?.dataset.taskId;
      if (taskId) {
        showStatusDropdown(taskId, badge, slug);
      }
    }, { signal });
  });

  // Task priority badges - clickable to change priority
  document.querySelectorAll('.task-priority.clickable').forEach(badge => {
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = badge.closest('.task-row')?.dataset.taskId;
      if (taskId) {
        showPriorityDropdown(taskId, badge, slug);
      }
    }, { signal });
  });

  // Task due date - clickable to change date
  document.querySelectorAll('.task-due-date.clickable').forEach(dateEl => {
    dateEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = dateEl.closest('.task-row')?.dataset.taskId;
      if (taskId) {
        showDueDatePicker(taskId, dateEl, slug);
      }
    }, { signal });
  });

  // Task labels - clickable to manage labels
  document.querySelectorAll('.task-labels.clickable').forEach(labelsEl => {
    labelsEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = labelsEl.closest('.task-row')?.dataset.taskId;
      if (taskId) {
        showLabelPicker(taskId, labelsEl, slug);
      }
    }, { signal });
  });

  // Quick add input handlers
  document.querySelectorAll('.quick-add-input input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const container = input.closest('.task-group') || input.closest('.board-column');
        const groupId = container?.dataset.groupId;
        const groupType = container?.dataset.groupType;
        if (groupId) {
          handleQuickAddTask(groupId, groupType, slug);
        }
      } else if (e.key === 'Escape') {
        hideQuickAddTask(slug);
      }
    }, { signal });
  });

  document.querySelectorAll('.quick-add-btn.save').forEach(btn => {
    btn.addEventListener('click', () => {
      const container = btn.closest('.task-group') || btn.closest('.board-column');
      const groupId = container?.dataset.groupId;
      const groupType = container?.dataset.groupType;
      if (groupId) {
        handleQuickAddTask(groupId, groupType, slug);
      }
    }, { signal });
  });

  document.querySelectorAll('.quick-add-btn.cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      hideQuickAddTask(slug);
    }, { signal });
  });

  // Task row clicks - open detail panel
  document.querySelectorAll('.task-row').forEach(row => {
    row.addEventListener('click', (e) => {
      // Don't open panel if clicking on interactive elements
      if (e.target.closest('.task-status') ||
          e.target.closest('.task-priority') ||
          e.target.closest('.task-due-date') ||
          e.target.closest('.task-labels') ||
          e.target.closest('.add-icon-btn')) {
        return;
      }
      const taskId = row.dataset.taskId;
      if (taskId) {
        openTaskPanel(taskId, slug);
      }
    }, { signal });
  });

  // Board card clicks - open detail panel
  document.querySelectorAll('.board-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't open panel if clicking on interactive elements
      if (e.target.closest('.add-icon-btn') ||
          e.target.closest('.board-card-priority-btn')) {
        return;
      }
      const taskId = card.dataset.taskId;
      if (taskId) {
        openTaskPanel(taskId, slug);
      }
    }, { signal });
  });

  // Task row "+" assignee button - opens searchable dropdown
  document.querySelectorAll('.task-row .add-icon-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = btn.closest('.task-row')?.dataset.taskId;
      if (taskId) {
        const task = getTaskById(taskId);
        showSearchableUserDropdown(btn, task?.assignee_id, (newAssigneeId) => {
          updateTaskField(taskId, 'assignee_id', newAssigneeId, slug);
          showToast('Assignee updated', 'success');
        });
      }
    }, { signal });
  });

  // Board card priority button - opens priority dropdown
  document.querySelectorAll('.board-card-priority-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = btn.closest('.board-card')?.dataset.taskId;
      if (taskId) {
        showPriorityDropdown(taskId, btn, slug);
      }
    }, { signal });
  });

  // Board card assignee button - opens searchable dropdown
  document.querySelectorAll('.board-card .add-icon-btn[title="Assign"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = btn.closest('.board-card')?.dataset.taskId;
      if (taskId) {
        const task = getTaskById(taskId);
        showSearchableUserDropdown(btn, task?.assignee_id, (newAssigneeId) => {
          updateTaskField(taskId, 'assignee_id', newAssigneeId, slug);
          showToast('Assignee updated', 'success');
        });
      }
    }, { signal });
  });

  // Files view event listeners
  attachFilesEventListeners(slug);

  // Members view event listeners
  attachMembersEventListeners(slug);

  // Settings view event listeners
  attachSettingsEventListeners(slug);

  // Insights view event listeners
  attachInsightsEventListeners(slug);

  // Roadmap view event listeners
  attachRoadmapEventListeners(slug);

  // Initialize drag and drop for tasks
  initDragAndDrop(slug);
}

function attachFilesEventListeners(slug) {
  const project = getProjectBySlug(slug);
  if (!project) return;

  const signal = getViewSignal();
  const files = getFilesForProject(project.id);

  // Select all checkbox
  document.querySelectorAll('[data-action="select-all"]').forEach(el => {
    el.addEventListener('click', () => {
      if (state.selectedFiles.size === files.length) {
        // Deselect all
        state.selectedFiles.clear();
      } else {
        // Select all
        files.forEach(f => state.selectedFiles.add(f.id));
      }
      renderProjectDetail(slug);
    }, { signal });
  });

  // Individual file checkbox
  document.querySelectorAll('[data-action="toggle-file"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const fileId = el.dataset.fileId;
      if (state.selectedFiles.has(fileId)) {
        state.selectedFiles.delete(fileId);
      } else {
        state.selectedFiles.add(fileId);
      }
      renderProjectDetail(slug);
    }, { signal });
  });

  // Bulk actions
  document.querySelectorAll('[data-action="download-selected"]').forEach(btn => {
    btn.addEventListener('click', () => {
      alert(`Downloading ${state.selectedFiles.size} files (demo only)`);
    }, { signal });
  });

  document.querySelectorAll('[data-action="delete-selected"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm(`Delete ${state.selectedFiles.size} selected files?`)) {
        state.selectedFiles.clear();
        renderProjectDetail(slug);
      }
    }, { signal });
  });

  // Upload Files button - opens modal
  document.querySelectorAll('[data-action="open-upload-modal"]').forEach(btn => {
    btn.addEventListener('click', () => {
      showUploadFilesModal(slug);
    }, { signal });
  });

  // Pagination controls
  const pagination = document.querySelector('[data-pagination-type="files"]');
  if (pagination) {
    pagination.querySelector('[data-action="prev-page"]')?.addEventListener('click', () => {
      if (state.filesPagination.page > 1) {
        state.filesPagination.page--;
        renderProjectDetail(slug);
      }
    }, { signal });

    pagination.querySelector('[data-action="next-page"]')?.addEventListener('click', () => {
      state.filesPagination.page++;
      renderProjectDetail(slug);
    }, { signal });

    pagination.querySelector('[data-action="change-page-size"]')?.addEventListener('change', (e) => {
      state.filesPagination.pageSize = parseInt(e.target.value);
      state.filesPagination.page = 1; // Reset to first page
      renderProjectDetail(slug);
    }, { signal });
  }

  // File preview - clicking on file name opens preview panel
  document.querySelectorAll('[data-action="preview-file"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const fileId = el.dataset.fileId;
      openFilePreview(fileId, slug);
    }, { signal });
  });
}

function attachMembersEventListeners(slug) {
  const project = getProjectBySlug(slug);
  if (!project) return;

  const signal = getViewSignal();
  const tasks = getTasksForProject(project.id);
  const memberIds = [...new Set(tasks.map(t => t.assignee_id).filter(Boolean))];
  const members = memberIds.map(id => getUserById(id)).filter(Boolean);

  // Select all members checkbox
  document.querySelectorAll('[data-action="select-all-members"]').forEach(el => {
    el.addEventListener('click', () => {
      if (state.selectedMembers.size === members.length) {
        // Deselect all
        state.selectedMembers.clear();
      } else {
        // Select all
        members.forEach(m => state.selectedMembers.add(m.id));
      }
      renderProjectDetail(slug);
    }, { signal });
  });

  // Individual member checkbox
  document.querySelectorAll('[data-action="toggle-member"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const memberId = el.dataset.memberId;
      if (state.selectedMembers.has(memberId)) {
        state.selectedMembers.delete(memberId);
      } else {
        state.selectedMembers.add(memberId);
      }
      renderProjectDetail(slug);
    }, { signal });
  });

  // Delete members action
  document.querySelectorAll('[data-action="delete-members"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm(`Remove ${state.selectedMembers.size} selected members from project?`)) {
        state.selectedMembers.clear();
        renderProjectDetail(slug);
      }
    }, { signal });
  });

  // Pagination controls
  const pagination = document.querySelector('[data-pagination-type="members"]');
  if (pagination) {
    pagination.querySelector('[data-action="prev-page"]')?.addEventListener('click', () => {
      if (state.membersPagination.page > 1) {
        state.membersPagination.page--;
        renderProjectDetail(slug);
      }
    }, { signal });

    pagination.querySelector('[data-action="next-page"]')?.addEventListener('click', () => {
      state.membersPagination.page++;
      renderProjectDetail(slug);
    }, { signal });

    pagination.querySelector('[data-action="change-page-size"]')?.addEventListener('change', (e) => {
      state.membersPagination.pageSize = parseInt(e.target.value);
      state.membersPagination.page = 1; // Reset to first page
      renderProjectDetail(slug);
    }, { signal });
  }

  // Add User button - opens invite modal
  document.querySelectorAll('[data-action="add-member"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const projectSlug = btn.dataset.projectSlug;
      showInviteMemberModal(projectSlug);
    }, { signal });
  });

  // Edit User button - opens edit modal for selected member
  document.querySelectorAll('[data-action="edit-member"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.selectedMembers.size !== 1) return;
      const memberId = [...state.selectedMembers][0];
      const projectSlug = btn.dataset.projectSlug;
      showEditMemberModal(memberId, projectSlug);
    }, { signal });
  });
}

function attachSettingsEventListeners(slug) {
  const project = getProjectBySlug(slug);
  if (!project) return;

  const signal = getViewSignal();

  // Color picker
  document.querySelectorAll('.color-swatch--lg').forEach(btn => {
    btn.addEventListener('click', () => {
      // Update visual selection
      document.querySelectorAll('.color-swatch--lg').forEach(b => {
        b.classList.remove('active');
        b.innerHTML = '';
      });
      btn.classList.add('active');
      btn.innerHTML = icons.check;
    }, { signal });
  });

  // Default view toggle
  document.querySelectorAll('[data-default-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-default-view]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }, { signal });
  });

  // Save settings button
  const saveBtn = document.getElementById('save-settings');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const name = document.getElementById('project-name')?.value?.trim();
      const description = document.getElementById('project-description')?.value?.trim();
      const identifier = document.getElementById('project-identifier')?.value?.trim().toUpperCase();
      const selectedColor = document.querySelector('.color-swatch--lg.active')?.dataset.color;
      const defaultView = document.querySelector('[data-default-view].active')?.dataset.defaultView;

      // Validation
      if (!name) {
        showToast('Project name is required', 'error');
        return;
      }
      if (!identifier) {
        showToast('Project identifier is required', 'error');
        return;
      }
      if (identifier.length > 5) {
        showToast('Identifier must be 5 characters or less', 'error');
        return;
      }

      // Update project
      project.name = name;
      project.description = description;
      project.identifier = identifier;
      if (selectedColor) project.color = selectedColor;
      if (defaultView) project.default_view = defaultView;
      project.updated_at = new Date().toISOString();

      // Update slug if name changed
      const newSlug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      if (newSlug !== project.slug) {
        project.slug = newSlug;
        // Navigate to new slug
        window.location.hash = `#/projects/${newSlug}`;
      }

      showToast('Project settings saved', 'success');
      renderProjectDetail(project.slug);
    }, { signal });
  }

  // Archive/Restore toggle
  const archiveBtn = document.getElementById('toggle-archive');
  if (archiveBtn) {
    archiveBtn.addEventListener('click', () => {
      project.is_archived = !project.is_archived;
      project.updated_at = new Date().toISOString();

      if (project.is_archived) {
        showToast('Project archived', 'success');
      } else {
        showToast('Project restored', 'success');
      }
      renderProjectDetail(slug);
    }, { signal });
  }

  // Delete project button
  const deleteBtn = document.getElementById('delete-project');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      showDeleteProjectModal(project, slug);
    }, { signal });
  }
}

function showDeleteProjectModal(project, slug) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'delete-project-modal';
  modal.innerHTML = `
    <div class="modal delete-modal">
      <div class="modal-header">
        <h2 class="modal-title">Delete Project</h2>
        <button class="modal-close" data-action="close-modal">
          ${icons.close}
        </button>
      </div>
      <div class="modal-body">
        <div class="delete-warning">
          <div class="delete-warning-icon">
            ${icons.warning || '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'}
          </div>
          <p class="delete-warning-text">
            Are you sure you want to delete <strong>${escapeHtml(project.name)}</strong>?
          </p>
          <p class="delete-warning-details">
            This will permanently delete:
          </p>
          <ul class="delete-warning-list">
            <li>All tasks in this project</li>
            <li>All files and attachments</li>
            <li>All comments and activity</li>
          </ul>
          <p class="delete-warning-confirm">
            This action cannot be undone.
          </p>
        </div>
        <div class="delete-confirm-input">
          <label>Type <strong>${escapeHtml(project.name)}</strong> to confirm:</label>
          <input type="text" id="delete-confirm-text" placeholder="Project name">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" data-action="close-modal">Cancel</button>
        <button class="btn-danger" id="confirm-delete" disabled>Delete Project</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Enable delete button only when project name matches
  const confirmInput = document.getElementById('delete-confirm-text');
  const confirmBtn = document.getElementById('confirm-delete');

  confirmInput.addEventListener('input', () => {
    confirmBtn.disabled = confirmInput.value !== project.name;
  });

  // Close modal handlers
  modal.querySelectorAll('[data-action="close-modal"]').forEach(el => {
    el.addEventListener('click', () => {
      modal.remove();
    });
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Delete confirm handler
  confirmBtn.addEventListener('click', () => {
    if (confirmInput.value === project.name) {
      // Remove project from state
      const index = state.projects.findIndex(p => p.id === project.id);
      if (index !== -1) {
        state.projects.splice(index, 1);
      }

      // Remove related tasks
      state.tasks = state.tasks.filter(t => t.project_id !== project.id);

      // Remove related files
      state.files = state.files.filter(f => f.project_id !== project.id);

      modal.remove();
      showToast('Project deleted successfully', 'success');

      // Navigate to projects list
      window.location.hash = '#/projects';
    }
  });

  // Focus the input
  confirmInput.focus();
}

function attachInsightsEventListeners(slug) {
  const project = getProjectBySlug(slug);
  if (!project) return;

  const signal = getViewSignal();

  // Insights tab switching
  document.querySelectorAll('.insights-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.insightsTab;
      state.currentInsightsTab = tabName;
      renderProjectDetail(slug);
    }, { signal });
  });

  // Export button
  const exportBtn = document.getElementById('export-insights');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportInsightsData(project);
    }, { signal });
  }
}

function attachRoadmapEventListeners(slug) {
  const signal = getViewSignal();

  // Scale toggle buttons
  document.querySelectorAll('.roadmap-zoom-btn[data-scale]').forEach(btn => {
    btn.addEventListener('click', () => {
      const newScale = btn.dataset.scale;
      if (state.roadmapScale !== newScale) {
        state.roadmapScale = newScale;
        state.roadmapOffset = 0; // Reset offset when changing scale
        renderProjectDetail(slug);
      }
    }, { signal });
  });

  // Navigation - Previous
  document.querySelectorAll('[data-action="roadmap-prev"]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.roadmapOffset--;
      renderProjectDetail(slug);
    }, { signal });
  });

  // Navigation - Next
  document.querySelectorAll('[data-action="roadmap-next"]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.roadmapOffset++;
      renderProjectDetail(slug);
    }, { signal });
  });

  // Navigation - Today
  document.querySelectorAll('[data-action="roadmap-today"]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.roadmapOffset = 0;
      renderProjectDetail(slug);
    }, { signal });
  });

  // Gantt bar drag and resize
  initGanttBarDragResize(slug, signal);
}

function initGanttBarDragResize(slug, signal) {
  const ganttRows = document.querySelector('.gantt-rows');
  if (!ganttRows) return;

  const timelineStart = new Date(ganttRows.dataset.timelineStart);
  const totalDays = parseInt(ganttRows.dataset.totalDays, 10);

  let dragState = null;

  // Helper: Convert pixel position to date
  function pixelToDate(pixelX, containerWidth) {
    const dayOffset = (pixelX / containerWidth) * totalDays;
    const date = new Date(timelineStart);
    date.setDate(date.getDate() + Math.round(dayOffset));
    return date;
  }

  // Helper: Format date as YYYY-MM-DD
  function formatDateISO(date) {
    return date.toISOString().split('T')[0];
  }

  // Mouse down on bar or handle
  document.querySelectorAll('.gantt-bar:not(.no-dates)').forEach(bar => {
    bar.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const taskId = bar.dataset.taskId;
      const task = getTaskById(taskId);
      if (!task) return;

      const row = bar.closest('.gantt-row');
      const rowRect = row.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();

      // Determine drag type
      let dragType = 'move';
      if (e.target.classList.contains('gantt-bar-handle-left')) {
        dragType = 'resize-left';
      } else if (e.target.classList.contains('gantt-bar-handle-right')) {
        dragType = 'resize-right';
      }

      dragState = {
        taskId,
        task,
        bar,
        row,
        rowRect,
        dragType,
        startX: e.clientX,
        initialLeft: parseFloat(bar.style.left) || 0,
        initialWidth: parseFloat(bar.style.width) || 10,
        containerWidth: rowRect.width
      };

      bar.classList.add('dragging');
      document.body.style.cursor = dragType === 'move' ? 'grabbing' : 'ew-resize';
    }, { signal });
  });

  // Mouse move - update bar position/size
  document.addEventListener('mousemove', (e) => {
    if (!dragState) return;

    const deltaX = e.clientX - dragState.startX;
    const deltaPercent = (deltaX / dragState.containerWidth) * 100;

    if (dragState.dragType === 'move') {
      // Move the entire bar
      const newLeft = Math.max(0, Math.min(100 - dragState.initialWidth, dragState.initialLeft + deltaPercent));
      dragState.bar.style.left = `${newLeft}%`;
    } else if (dragState.dragType === 'resize-left') {
      // Resize from left edge (changes start date)
      const newLeft = Math.max(0, dragState.initialLeft + deltaPercent);
      const newWidth = dragState.initialWidth - deltaPercent;
      if (newWidth >= 2) { // Minimum width
        dragState.bar.style.left = `${newLeft}%`;
        dragState.bar.style.width = `${newWidth}%`;
      }
    } else if (dragState.dragType === 'resize-right') {
      // Resize from right edge (changes end date)
      const newWidth = Math.max(2, dragState.initialWidth + deltaPercent);
      const maxWidth = 100 - dragState.initialLeft;
      dragState.bar.style.width = `${Math.min(newWidth, maxWidth)}%`;
    }
  }, { signal });

  // Mouse up - save changes
  document.addEventListener('mouseup', (e) => {
    if (!dragState) return;

    const { taskId, bar, containerWidth, rowRect } = dragState;

    // Calculate new dates from final bar position
    const finalLeft = parseFloat(bar.style.left);
    const finalWidth = parseFloat(bar.style.width);

    const startPixel = (finalLeft / 100) * containerWidth;
    const endPixel = ((finalLeft + finalWidth) / 100) * containerWidth;

    const newStartDate = pixelToDate(startPixel, containerWidth);
    const newEndDate = pixelToDate(endPixel, containerWidth);

    // Update task
    updateTaskField(taskId, 'start_date', formatDateISO(newStartDate), slug);
    updateTaskField(taskId, 'due_date', formatDateISO(newEndDate), slug);

    // Clean up
    bar.classList.remove('dragging');
    document.body.style.cursor = '';
    dragState = null;

    // Show feedback
    showToast('Task dates updated', 'success');

    // Re-render to ensure consistency
    renderProjectDetail(slug);
  }, { signal });
}

function exportInsightsData(project) {
  const tasks = getTasksForProject(project.id);
  const members = getProjectMembers(project.id);

  // Calculate all KPIs
  const completedTasks = tasks.filter(t => {
    const status = getStatusById(t.status_id);
    return status?.name === 'Done';
  });
  const incompleteTasks = tasks.filter(t => {
    const status = getStatusById(t.status_id);
    return status?.name !== 'Done';
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueTasks = tasks.filter(t => {
    if (!t.due_date) return false;
    const status = getStatusById(t.status_id);
    if (status?.name === 'Done') return false;
    return new Date(t.due_date) < today;
  });

  // Status breakdown - include color from workflow settings
  const statusCounts = {};
  tasks.forEach(t => {
    const status = getStatusById(t.status_id);
    const statusName = status?.name || 'Unknown';
    const statusColor = status?.color || FALLBACK_COLOR;
    if (!statusCounts[statusName]) {
      statusCounts[statusName] = { count: 0, color: statusColor };
    }
    statusCounts[statusName].count++;
  });

  // Priority breakdown
  const priorityCounts = { 'High': 0, 'Medium': 0, 'Low': 0, 'None': 0 };
  tasks.forEach(t => {
    const priority = t.priority_id ? getPriorityById(t.priority_id) : null;
    const priorityName = priority?.name || 'None';
    priorityCounts[priorityName] = (priorityCounts[priorityName] || 0) + 1;
  });

  // Build CSV data
  const csvData = [
    ['Project Insights Report'],
    ['Project:', project.name],
    ['Generated:', new Date().toLocaleString()],
    [''],
    ['Summary'],
    ['Total Tasks', tasks.length],
    ['Completed Tasks', completedTasks.length],
    ['Incomplete Tasks', incompleteTasks.length],
    ['Overdue Tasks', overdueTasks.length],
    [''],
    ['Status Breakdown'],
    ...Object.entries(statusCounts).map(([status, data]) => [status, data.count]),
    [''],
    ['Priority Breakdown'],
    ...Object.entries(priorityCounts).map(([priority, count]) => [priority, count]),
    [''],
    ['Team Members'],
    ['Name', 'Tasks Assigned', 'Completed', 'Incomplete'],
    ...members.map(m => {
      const memberTasks = tasks.filter(t => t.assignee_id === m.id);
      const memberCompleted = memberTasks.filter(t => {
        const status = getStatusById(t.status_id);
        return status?.name === 'Done';
      });
      return [m.name, memberTasks.length, memberCompleted.length, memberTasks.length - memberCompleted.length];
    }),
    [''],
    ['Task List'],
    ['ID', 'Title', 'Status', 'Priority', 'Due Date', 'Assignee'],
    ...tasks.map(t => {
      const status = getStatusById(t.status_id);
      const priority = t.priority_id ? getPriorityById(t.priority_id) : null;
      const assignee = t.assignee_id ? getUserById(t.assignee_id) : null;
      return [
        `${project.identifier}-${t.sequence_id}`,
        t.title,
        status?.name || 'Unknown',
        priority?.name || 'None',
        t.due_date || 'N/A',
        assignee?.name || 'Unassigned'
      ];
    })
  ];

  // Convert to CSV string
  const csvContent = csvData.map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${project.slug}-insights-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);

  showToast('Insights exported successfully', 'success');
}

function renderTaskGroup(group, tasks, project, groupBy) {
  const isCollapsed = state.collapsedGroups.has(group.id);
  const isQuickAdding = state.quickAddStatus === group.id;
  const isFlat = group.type === 'none';

  return `
    <div class="card card--task-group task-group ${isFlat ? 'flat' : ''}" data-group-id="${group.id}" data-group-type="${group.type}">
      <div class="task-group-header ${isFlat ? 'flat' : ''}" ${!isFlat ? `data-toggle-group="${group.id}"` : ''}>
        ${!isFlat ? `
          <span class="task-group-toggle ${isCollapsed ? 'collapsed' : ''}">
            ${icons.chevronDown}
          </span>
          <div class="task-group-color" style="background: ${group.color}"></div>
        ` : ''}
        <span class="task-group-name">${escapeHtml(group.name)}</span>
        <span class="count-badge">${tasks.length}</span>
      </div>
      ${!isCollapsed || isFlat ? `
        <div class="task-list">
          ${tasks.map(task => renderTaskRow(task, project, group, groupBy)).join('')}
          ${isQuickAdding ? `
            <div class="quick-add-input">
              <input type="text" placeholder="Task title..." autofocus>
              <div class="quick-add-actions">
                <button class="quick-add-btn save">Save</button>
                <button class="quick-add-btn cancel">Cancel</button>
              </div>
            </div>
          ` : `
            <div class="add-task-row">
              ${icons.plus} Add Task
            </div>
          `}
        </div>
      ` : ''}
    </div>
  `;
}

function renderTaskRow(task, project, group, groupBy) {
  const fields = getProjectFields(project.id);
  const assignee = task.assignee_id ? getUserById(task.assignee_id) : null;
  const priority = task.priority_id ? getPriorityById(task.priority_id) : null;
  const taskLabels = (task.label_ids || []).map(id => getLabelById(id)).filter(Boolean);
  const taskKey = `${project.identifier}-${task.sequence_id}`;
  const isSelected = state.selectedTasks.has(task.id);
  const isArchived = task.is_archived;

  // Always get the task's actual status for display
  const status = getStatusById(task.status_id);
  const statusBg = status ? hexToRgba(status.color, 0.15) : '';

  // Priority colors
  const priorityBg = priority ? hexToRgba(priority.color, 0.15) : '';

  return `
    <div class="task-row ${isSelected ? 'selected' : ''} ${isArchived ? 'archived' : ''}" data-task-id="${task.id}" draggable="true">
      <div class="task-row-start">
        <span class="task-drag-handle">${icons.grip}</span>
        ${fields.taskKey ? `<span class="task-key">${escapeHtml(taskKey)}</span>` : ''}
      </div>
      <span class="task-title">${escapeHtml(task.title)}</span>
      ${fields.progress ? `<span class="task-progress">0%</span>` : ''}
      ${fields.status ? `
        <span class="task-status clickable" style="background: ${statusBg}; color: var(--color-text-secondary)">
          ${status ? escapeHtml(status.name) : 'No Status'}
        </span>
      ` : ''}
      ${fields.assignee ? `
        <div class="task-assignees">
          ${assignee
            ? `<div class="task-assignee" style="background: ${stringToColor(assignee.name)}" title="${escapeHtml(assignee.name)}">
                ${getInitials(assignee.name)}
              </div>`
            : `<button class="add-icon-btn" title="Add assignee">+</button>`
          }
        </div>
      ` : ''}
      ${fields.labels ? `
        <div class="task-labels clickable" title="Manage labels">
          ${taskLabels.length > 0 ? `
            <span class="task-label">${escapeHtml(taskLabels[0].name)}</span>
            ${taskLabels.length > 1 ? `<span class="task-label more">+${taskLabels.length - 1}</span>` : ''}
          ` : `
            <span class="task-add-label">+ Label</span>
          `}
        </div>
      ` : ''}
      ${fields.priority ? `
        <span class="task-priority clickable ${priority ? '' : 'empty'}" style="background: ${priorityBg}; color: var(--color-text-secondary)">
          ${priority ? `${getPriorityIcon(priority.name)} ${escapeHtml(priority.name)}` : '+ Priority'}
        </span>
      ` : ''}
      ${fields.dueDate ? `
        <span class="task-due-date clickable ${isOverdue(task.due_date) ? 'overdue' : ''} ${!task.due_date ? 'empty' : ''}">
          ${task.due_date ? formatDate(task.due_date) : 'Set due date'}
        </span>
      ` : ''}
    </div>
  `;
}


// ==========================================================================
// Render Functions - Members View
// ==========================================================================

function renderMembersView(tasks, project) {
  // Get unique members who have tasks in this project
  const memberIds = [...new Set(tasks.map(t => t.assignee_id).filter(Boolean))];
  const members = memberIds.map(id => getUserById(id)).filter(Boolean);
  const selectedCount = state.selectedMembers.size;

  // Calculate stats for each member
  const memberStats = members.map(member => {
    const memberTasks = tasks.filter(t => t.assignee_id === member.id);
    const statuses = getStatusesForProject(project.id);
    const doneStatusIds = statuses.filter(s => s.category === 'done').map(s => s.id);
    const doneTasks = memberTasks.filter(t => doneStatusIds.includes(t.status_id));
    const progress = memberTasks.length > 0 ? Math.round((doneTasks.length / memberTasks.length) * 100) : 0;

    return {
      ...member,
      taskCount: memberTasks.length,
      doneCount: doneTasks.length,
      progress
    };
  });

  // Pagination
  const { page, pageSize } = state.membersPagination;
  const paginatedMembers = getPaginatedItems(memberStats, page, pageSize);

  return `
    <div class="card members-container">
      <div class="view-toolbar view-toolbar--card">
        <div class="toolbar-filters">
          <span class="toolbar-count">${selectedCount > 0 ? `${selectedCount} selected` : `${members.length} Members`}</span>
        </div>
        <div class="toolbar-actions">
          <button class="btn-bulk danger ${selectedCount === 0 ? 'disabled' : ''}" data-action="delete-members" ${selectedCount === 0 ? 'disabled' : ''}>
            ${icons.trash} Delete
          </button>
          <button class="btn-secondary ${selectedCount !== 1 ? 'disabled' : ''}" data-action="edit-member" data-project-slug="${project.slug}" ${selectedCount !== 1 ? 'disabled' : ''}>
            ${icons.edit} Edit
          </button>
          <button class="btn-secondary" data-action="add-member" data-project-slug="${project.slug}">
            ${icons.userPlus} Add User
          </button>
        </div>
      </div>
      <table class="members-table">
        <thead>
          <tr>
            <th class="checkbox-col">
              <div class="table-checkbox ${getMemberSelectAllState(members)}" data-action="select-all-members">
                ${selectedCount > 0 && selectedCount === members.length ? icons.check : ''}
              </div>
            </th>
            <th class="sortable">Name <span class="sort-icon">${icons.chevronDown}</span></th>
            <th class="sortable">Job Title <span class="sort-icon">${icons.chevronDown}</span></th>
            <th class="sortable">Email <span class="sort-icon">${icons.chevronDown}</span></th>
            <th class="sortable">Tasks <span class="sort-icon">${icons.chevronDown}</span></th>
            <th>Task Progress</th>
            <th class="sortable">Access <span class="sort-icon">${icons.chevronDown}</span></th>
          </tr>
        </thead>
        <tbody>
          ${paginatedMembers.map(member => renderMemberRow(member)).join('')}
        </tbody>
      </table>
      ${renderPagination({
        totalItems: memberStats.length,
        currentPage: page,
        pageSize: pageSize,
        itemLabel: 'members',
        paginationType: 'members'
      })}
    </div>
  `;
}

function getMemberSelectAllState(members) {
  if (state.selectedMembers.size === 0) return '';
  if (state.selectedMembers.size === members.length) return 'checked';
  return 'indeterminate';
}

function renderMemberRow(member) {
  const isSelected = state.selectedMembers.has(member.id);

  return `
    <tr class="${isSelected ? 'selected' : ''}" data-member-id="${member.id}">
      <td>
        <div class="table-checkbox ${isSelected ? 'checked' : ''}" data-action="toggle-member" data-member-id="${member.id}">
          ${isSelected ? icons.check : ''}
        </div>
      </td>
      <td>
        <div class="member-name-cell">
          <div class="table-avatar member-avatar" style="background: ${stringToColor(member.name)}">
            ${getInitials(member.name)}
          </div>
          <span class="member-name">${escapeHtml(member.name)}</span>
        </div>
      </td>
      <td>${member.job_title || '-'}</td>
      <td><span class="member-email">${escapeHtml(member.email)}</span></td>
      <td><span class="member-tasks">${member.doneCount}/${member.taskCount}</span></td>
      <td>
        <div class="member-progress">
          <div class="progress-bar member-progress-bar">
            <div class="progress-fill member-progress-fill" style="width: ${member.progress}%"></div>
          </div>
          <span class="member-progress-text">${member.progress}%</span>
        </div>
      </td>
      <td><span class="member-role ${member.role}">${member.role}</span></td>
    </tr>
  `;
}

// ==========================================================================
// Render Functions - Settings View
// ==========================================================================

function renderSettingsView(project) {
  // Use centralized COLOR_PALETTE for settings color options
  const colorOptions = [
    { value: COLOR_PALETTE.blue.hex, name: COLOR_PALETTE.blue.name },
    { value: COLOR_PALETTE.purple.hex, name: COLOR_PALETTE.purple.name },
    { value: COLOR_PALETTE.emerald.hex, name: COLOR_PALETTE.emerald.name },
    { value: COLOR_PALETTE.amber.hex, name: COLOR_PALETTE.amber.name },
    { value: COLOR_PALETTE.red.hex, name: COLOR_PALETTE.red.name },
    { value: COLOR_PALETTE.pink.hex, name: COLOR_PALETTE.pink.name },
    { value: COLOR_PALETTE.cyan.hex, name: COLOR_PALETTE.cyan.name },
    { value: COLOR_PALETTE.lime.hex, name: COLOR_PALETTE.lime.name },
  ];

  return `
    <div class="settings-container">
      <div class="card card--settings settings-card">
        <div class="settings-card-header">
          <span class="settings-card-title">General</span>
        </div>
        <div class="settings-card-content">
          <div class="settings-field">
            <label class="settings-label" for="project-name">Project Name</label>
            <input type="text" id="project-name" class="settings-input" value="${escapeHtml(project.name)}" data-field="name">
          </div>

          <div class="settings-field">
            <label class="settings-label" for="project-description">Description</label>
            <textarea id="project-description" class="settings-textarea" rows="3" data-field="description">${escapeHtml(project.description || '')}</textarea>
          </div>

          <div class="settings-row-3">
            <div class="settings-field">
              <label class="settings-label" for="project-identifier">Identifier</label>
              <input type="text" id="project-identifier" class="settings-input" value="${escapeHtml(project.identifier)}" data-field="identifier" maxlength="5">
              <span class="settings-hint">Prefix: ${project.identifier}-1</span>
            </div>

            <div class="settings-field">
              <label class="settings-label">Color</label>
              <div class="settings-color-picker">
                ${colorOptions.map(color => `
                  <button class="color-swatch color-swatch--lg ${project.color === color.value ? 'active' : ''}"
                          style="background: ${color.value}"
                          data-color="${color.value}"
                          title="${color.name}">
                    ${project.color === color.value ? icons.check : ''}
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="settings-field">
              <label class="settings-label">Default View</label>
              <div class="settings-view-toggle">
                <button class="view-toggle-btn ${project.default_view === 'list' ? 'active' : ''}" data-default-view="list">
                  ${icons.list} List
                </button>
                <button class="view-toggle-btn ${project.default_view === 'board' ? 'active' : ''}" data-default-view="board">
                  ${icons.grid} Board
                </button>
              </div>
            </div>
          </div>

          <div class="settings-actions">
            <button class="btn-primary" id="save-settings">${icons.check} Save Changes</button>
          </div>
        </div>
      </div>

      <div class="card card--settings settings-card">
        <div class="settings-card-header">
          <span class="settings-card-title">Project Status</span>
        </div>
        <div class="settings-card-content">
          <div class="settings-status-row">
            <div class="settings-status-info">
              <span class="settings-status-indicator ${project.is_archived ? 'archived' : 'active'}"></span>
              <div class="settings-status-text">
                <span class="settings-status-label">${project.is_archived ? 'Archived' : 'Active'}</span>
                <span class="settings-status-description">
                  ${project.is_archived
                    ? 'This project is archived and won\'t appear in the main list.'
                    : 'This project is active and visible to all members.'}
                </span>
              </div>
            </div>
            <button class="btn-secondary" id="toggle-archive">
              ${project.is_archived ? 'Restore Project' : 'Archive Project'}
            </button>
          </div>
        </div>
      </div>

      <div class="card card--settings settings-card settings-card-danger">
        <div class="settings-card-header">
          <span class="settings-card-title">Danger Zone</span>
        </div>
        <div class="settings-card-content">
          <div class="settings-status-row">
            <div class="settings-status-info">
              <div class="settings-status-text">
                <span class="settings-status-label">Delete Project</span>
                <span class="settings-status-description">
                  Permanently delete this project and all of its tasks, files, and data.
                </span>
              </div>
            </div>
            <button class="btn-danger" id="delete-project">${icons.trash} Delete Project</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==========================================================================
// Render Functions - Files View
// ==========================================================================

function renderFilesView(project) {
  const files = getFilesForProject(project.id);
  const selectedCount = state.selectedFiles.size;

  if (files.length === 0) {
    return renderFilesEmptyState();
  }

  // Pagination
  const { page, pageSize } = state.filesPagination;
  const paginatedFiles = getPaginatedItems(files, page, pageSize);

  return `
    <div class="card files-container">
      <div class="view-toolbar view-toolbar--card">
        <div class="toolbar-filters">
          <span class="toolbar-count">${selectedCount > 0 ? `${selectedCount} selected` : `${files.length} Files`}</span>
        </div>
        <div class="toolbar-actions">
          <button class="btn-bulk ${selectedCount === 0 ? 'disabled' : ''}" data-action="download-selected" ${selectedCount === 0 ? 'disabled' : ''}>
            ${icons.download} Download
          </button>
          <button class="btn-bulk danger ${selectedCount === 0 ? 'disabled' : ''}" data-action="delete-selected" ${selectedCount === 0 ? 'disabled' : ''}>
            ${icons.trash} Delete
          </button>
          <button class="btn-secondary" data-action="open-upload-modal">
            ${icons.upload} Upload Files
          </button>
        </div>
      </div>
      <table class="files-table">
        <thead>
          <tr>
            <th class="checkbox-col">
              <div class="table-checkbox ${getSelectAllState(files)}" data-action="select-all">
                ${selectedCount > 0 && selectedCount === files.length ? icons.check : ''}
              </div>
            </th>
            <th class="sortable">Name <span class="sort-icon">${icons.chevronDown}</span></th>
            <th class="sortable">Attached Task <span class="sort-icon">${icons.chevronDown}</span></th>
            <th class="sortable">Size <span class="sort-icon">${icons.chevronDown}</span></th>
            <th class="sortable">Uploaded By <span class="sort-icon">${icons.chevronDown}</span></th>
            <th class="sortable">Uploaded At <span class="sort-icon">${icons.chevronDown}</span></th>
          </tr>
        </thead>
        <tbody>
          ${paginatedFiles.map(file => renderFileRow(file, project)).join('')}
        </tbody>
      </table>
      ${renderPagination({
        totalItems: files.length,
        currentPage: page,
        pageSize: pageSize,
        itemLabel: 'files',
        paginationType: 'files'
      })}
    </div>
  `;
}

function getSelectAllState(files) {
  if (state.selectedFiles.size === 0) return '';
  if (state.selectedFiles.size === files.length) return 'checked';
  return 'indeterminate';
}

function renderFileRow(file, project) {
  const uploader = file.uploaded_by ? getUserById(file.uploaded_by) : null;
  const task = file.task_id ? getTaskById(file.task_id) : null;
  const isSelected = state.selectedFiles.has(file.id);
  const taskKey = task ? `${project.identifier}-${task.sequence_id}` : null;

  return `
    <tr class="${isSelected ? 'selected' : ''}" data-file-id="${file.id}">
      <td>
        <div class="table-checkbox ${isSelected ? 'checked' : ''}" data-action="toggle-file" data-file-id="${file.id}">
          ${isSelected ? icons.check : ''}
        </div>
      </td>
      <td>
        <div class="file-name-cell">
          <div class="file-icon ${file.file_type}">
            ${getFileIcon(file.file_type)}
          </div>
          <span class="file-name" data-action="preview-file" data-file-id="${file.id}">
            ${escapeHtml(file.name)}
          </span>
        </div>
      </td>
      <td>
        ${task
          ? `<a href="#" class="file-task-link" title="${escapeHtml(task.title)}">
              ${icons.link} ${escapeHtml(taskKey)}
            </a>`
          : `<span class="file-task-link unlinked">
              ${icons.plus} Link task
            </span>`
        }
      </td>
      <td>
        <span class="file-size">${formatFileSize(file.size_bytes)}</span>
      </td>
      <td>
        ${uploader
          ? `<div class="file-uploader">
              <div class="table-avatar file-uploader-avatar" style="background: ${stringToColor(uploader.name)}">
                ${getInitials(uploader.name)}
              </div>
              <span class="file-uploader-name">${escapeHtml(uploader.name)}</span>
            </div>`
          : '-'
        }
      </td>
      <td>
        <span class="file-date">${formatDateTime(file.uploaded_at)}</span>
      </td>
    </tr>
  `;
}

function getFileIcon(fileType) {
  switch (fileType) {
    case 'pdf':
      return icons.filePdf;
    case 'image':
      return icons.fileImage;
    case 'archive':
      return icons.fileArchive;
    case 'spreadsheet':
      return icons.fileSpreadsheet;
    case 'document':
    case 'cad':
    default:
      return icons.file;
  }
}

function renderFilesEmptyState() {
  return `
    <div class="card files-container">
      <div class="files-empty">
        <div class="files-empty-icon">${icons.file}</div>
        <h3 class="files-empty-title">No files yet</h3>
        <p class="files-empty-description">
          Upload files to share documents, images, and other attachments with your team.
        </p>
        <button class="btn-primary" data-action="open-upload-modal">
          ${icons.upload} Upload Files
        </button>
      </div>
    </div>
  `;
}

// ==========================================================================
// Render Functions - Insights View (Dashboard)
// ==========================================================================

function renderInsightsView(tasks, project) {
  const currentTab = state.currentInsightsTab || 'overview';
  const showArchived = state.showArchivedTasks[project.id] || false;
  const assignedToMe = state.assignedToMe[project.id] || false;
  const selectedAssignees = state.assigneeFilter[project.id] || [];
  const assigneeFilterCount = selectedAssignees.length;

  // Calculate KPIs
  const completedTasks = tasks.filter(t => {
    const status = getStatusById(t.status_id);
    return status?.name === 'Done';
  });
  const incompleteTasks = tasks.filter(t => {
    const status = getStatusById(t.status_id);
    return status?.name !== 'Done';
  });

  // Tasks with due dates that are overdue
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueTasks = tasks.filter(t => {
    if (!t.due_date) return false;
    const status = getStatusById(t.status_id);
    if (status?.name === 'Done') return false;
    const dueDate = new Date(t.due_date);
    return dueDate < today;
  });

  // Status breakdown - include color from workflow settings
  const statusCounts = {};
  tasks.forEach(t => {
    const status = getStatusById(t.status_id);
    const statusName = status?.name || 'Unknown';
    const statusColor = status?.color || FALLBACK_COLOR;
    if (!statusCounts[statusName]) {
      statusCounts[statusName] = { count: 0, color: statusColor };
    }
    statusCounts[statusName].count++;
  });

  // Priority breakdown
  const priorityCounts = { 'High': 0, 'Medium': 0, 'Low': 0, 'None': 0 };
  tasks.forEach(t => {
    const priority = t.priority_id ? getPriorityById(t.priority_id) : null;
    const priorityName = priority?.name || 'None';
    priorityCounts[priorityName] = (priorityCounts[priorityName] || 0) + 1;
  });

  // Members stats
  const memberStats = {};
  const projectMembers = getProjectMembers(project.id);
  projectMembers.forEach(member => {
    memberStats[member.id] = {
      user: member,
      taskCount: 0,
      completed: 0,
      incomplete: 0,
      overdue: 0
    };
  });

  tasks.forEach(t => {
    if (t.assignee_id && memberStats[t.assignee_id]) {
      memberStats[t.assignee_id].taskCount++;
      const status = getStatusById(t.status_id);
      if (status?.name === 'Done') {
        memberStats[t.assignee_id].completed++;
      } else {
        memberStats[t.assignee_id].incomplete++;
        // Check overdue
        if (t.due_date) {
          const dueDate = new Date(t.due_date);
          if (dueDate < today) {
            memberStats[t.assignee_id].overdue++;
          }
        }
      }
    }
  });

  // Last updated tasks (sorted by updated_at)
  const lastUpdatedTasks = [...tasks]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 10);

  return `
    <div class="insights-container">
      <div class="view-toolbar">
        <div class="toolbar-filters">
          <nav class="insights-tabs">
            <button class="insights-tab ${currentTab === 'overview' ? 'active' : ''}" data-insights-tab="overview">Overview</button>
            <button class="insights-tab ${currentTab === 'members' ? 'active' : ''}" data-insights-tab="members">Members</button>
            <button class="insights-tab ${currentTab === 'tasks' ? 'active' : ''}" data-insights-tab="tasks">Tasks</button>
          </nav>
          <button class="filter-btn ${assigneeFilterCount > 0 ? 'active' : ''}" data-action="toggle-assignee-filter">
            ${icons.user} Assignee${assigneeFilterCount > 0 ? ` (${assigneeFilterCount})` : ''}
            ${icons.chevronDown}
          </button>
          <label class="checkbox-label">
            <input type="checkbox" class="checkbox-input" data-action="toggle-assigned-to-me" ${assignedToMe ? 'checked' : ''}>
            <span class="checkbox-custom"></span>
            <span class="checkbox-text">Assigned to me</span>
          </label>
        </div>
        <div class="toolbar-actions">
          <label class="checkbox-label">
            <input type="checkbox" class="checkbox-input" data-action="toggle-archived" ${showArchived ? 'checked' : ''}>
            <span class="checkbox-custom"></span>
            <span class="checkbox-text">Show archived</span>
          </label>
          <button class="btn-primary" id="export-insights">
            ${icons.download} Export
          </button>
        </div>
      </div>

      ${currentTab === 'overview' ? renderInsightsOverview(tasks, completedTasks, incompleteTasks, overdueTasks, statusCounts, priorityCounts, lastUpdatedTasks, project) : ''}
      ${currentTab === 'members' ? renderInsightsMembers(memberStats, overdueTasks, projectMembers) : ''}
      ${currentTab === 'tasks' ? renderInsightsTasks(tasks, completedTasks, incompleteTasks, overdueTasks) : ''}
    </div>
  `;
}

function renderInsightsOverview(tasks, completedTasks, incompleteTasks, overdueTasks, statusCounts, priorityCounts, lastUpdatedTasks, project) {
  // Calculate donut chart segments using colors from workflow settings
  const total = tasks.length || 1;
  let currentAngle = 0;
  const segments = Object.entries(statusCounts).map(([name, data]) => {
    const count = data.count;
    const color = data.color; // Use color from workflow settings
    const percentage = (count / total) * 100;
    const startAngle = currentAngle;
    currentAngle += (percentage / 100) * 360;
    return { name, count, percentage, startAngle, endAngle: currentAngle, color };
  });

  return `
    <div class="insights-content">
      <!-- KPI Cards Row -->
      <div class="insights-kpi-row">
        <div class="card card--kpi insights-kpi-card">
          <div class="insights-kpi-icon success">
            ${icons.checkCircle}
          </div>
          <div class="insights-kpi-data">
            <span class="insights-kpi-label">Completed tasks</span>
            <span class="insights-kpi-value">${completedTasks.length}</span>
          </div>
        </div>
        <div class="card card--kpi insights-kpi-card">
          <div class="insights-kpi-icon warning">
            ${icons.tasks || '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>'}
          </div>
          <div class="insights-kpi-data">
            <span class="insights-kpi-label">Incomplete tasks</span>
            <span class="insights-kpi-value">${incompleteTasks.length}</span>
          </div>
        </div>
        <div class="card card--kpi insights-kpi-card">
          <div class="insights-kpi-icon danger">
            ${icons.warning || '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'}
          </div>
          <div class="insights-kpi-data">
            <span class="insights-kpi-label">Overdue tasks</span>
            <span class="insights-kpi-value">${overdueTasks.length}</span>
          </div>
        </div>
        <div class="card card--kpi insights-kpi-card">
          <div class="insights-kpi-icon info">
            ${icons.clock || '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'}
          </div>
          <div class="insights-kpi-data">
            <span class="insights-kpi-label">Total tasks</span>
            <span class="insights-kpi-value">${tasks.length}</span>
          </div>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="insights-charts-row">
        <div class="card card--insights insights-chart-card">
          <div class="insights-card-header">
            <span class="insights-card-title">Status Overview</span>
          </div>
          <div class="insights-chart-content">
            <div class="donut-chart">
              <svg viewBox="0 0 100 100" class="donut-svg">
                ${renderDonutSegments(segments, total)}
                <circle cx="50" cy="50" r="30" fill="white"/>
              </svg>
            </div>
            <div class="donut-legend">
              ${segments.map(s => `
                <div class="donut-legend-item">
                  <span class="donut-legend-color" style="background: ${s.color}"></span>
                  <span class="donut-legend-label">${s.name} (${s.count})</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="card card--insights insights-chart-card">
          <div class="insights-card-header">
            <span class="insights-card-title">Priority Overview</span>
          </div>
          <div class="insights-chart-content">
            <div class="bar-chart">
              ${renderPriorityBars(priorityCounts, tasks.length)}
            </div>
          </div>
        </div>
      </div>

      <!-- Last Updated Tasks -->
      <div class="card card--insights insights-table-card">
        <div class="insights-card-header">
          <span class="insights-card-title">Last Updated Tasks</span>
          <a href="#" class="insights-see-all">See all</a>
        </div>
        <table class="insights-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            ${lastUpdatedTasks.map(task => {
              const status = getStatusById(task.status_id);
              return `
                <tr>
                  <td>${escapeHtml(task.title)}</td>
                  <td><span class="insights-status-badge" style="background: ${status?.color || FALLBACK_COLOR}">${status?.name || 'Unknown'}</span></td>
                  <td>${task.due_date ? formatDate(task.due_date) : 'N/A'}</td>
                  <td>${formatRelativeTime(task.updated_at)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderDonutSegments(segments, total) {
  if (total === 0) {
    return '<circle cx="50" cy="50" r="40" fill="#e5e7eb"/>';
  }

  let svgPaths = '';
  segments.forEach(segment => {
    if (segment.count === 0) return;

    const startAngle = (segment.startAngle - 90) * (Math.PI / 180);
    const endAngle = (segment.endAngle - 90) * (Math.PI / 180);

    const x1 = 50 + 40 * Math.cos(startAngle);
    const y1 = 50 + 40 * Math.sin(startAngle);
    const x2 = 50 + 40 * Math.cos(endAngle);
    const y2 = 50 + 40 * Math.sin(endAngle);

    const largeArc = segment.percentage > 50 ? 1 : 0;

    svgPaths += `<path d="M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${segment.color}"/>`;
  });

  return svgPaths;
}

function renderPriorityBars(priorityCounts, total) {
  const priorities = [
    { name: 'Low', color: COLOR_PALETTE.emerald.hex, count: priorityCounts['Low'] || 0 },
    { name: 'Medium', color: COLOR_PALETTE.amber.hex, count: priorityCounts['Medium'] || 0 },
    { name: 'High', color: COLOR_PALETTE.red.hex, count: priorityCounts['High'] || 0 }
  ];

  const maxCount = Math.max(...priorities.map(p => p.count), 1);

  return `
    <div class="bar-chart-container">
      <div class="bar-chart-y-axis">
        ${[...Array(6)].map((_, i) => `<span>${Math.round(maxCount - (maxCount / 5) * i)}</span>`).join('')}
      </div>
      <div class="bar-chart-bars">
        ${priorities.map(p => `
          <div class="bar-chart-bar-group">
            <div class="bar-chart-bar" style="height: ${(p.count / maxCount) * 100}%; background: ${p.color}">
              <span class="bar-chart-value">${p.count}</span>
            </div>
            <span class="bar-chart-label">${p.name}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderInsightsMembers(memberStats, overdueTasks, projectMembers) {
  const membersWithOverdue = Object.values(memberStats).filter(m => m.overdue > 0).length;
  const unassignedMembers = projectMembers.filter(m => memberStats[m.id]?.taskCount === 0).length;

  return `
    <div class="insights-content">
      <!-- Member KPI Cards -->
      <div class="insights-kpi-row">
        <div class="card card--kpi insights-kpi-card">
          <div class="insights-kpi-icon info">
            ${icons.users}
          </div>
          <div class="insights-kpi-data">
            <span class="insights-kpi-label">Project Members</span>
            <span class="insights-kpi-value">${projectMembers.length}</span>
          </div>
        </div>
        <div class="card card--kpi insights-kpi-card">
          <div class="insights-kpi-icon danger">
            ${icons.warning || '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'}
          </div>
          <div class="insights-kpi-data">
            <span class="insights-kpi-label">Assignees with overdue tasks</span>
            <span class="insights-kpi-value">${membersWithOverdue}</span>
          </div>
        </div>
        <div class="card card--kpi insights-kpi-card">
          <div class="insights-kpi-icon warning">
            ${icons.user}
          </div>
          <div class="insights-kpi-data">
            <span class="insights-kpi-label">Unassigned Members</span>
            <span class="insights-kpi-value">${unassignedMembers}</span>
          </div>
        </div>
      </div>

      <!-- Members Table -->
      <div class="card card--insights insights-table-card">
        <div class="insights-card-header">
          <span class="insights-card-title">Tasks by members</span>
        </div>
        <table class="insights-table insights-members-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Task Count</th>
              <th>Contribution</th>
              <th>Completed</th>
              <th>Incomplete</th>
              <th>Overdue</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            ${Object.values(memberStats).map(m => {
              const totalTasks = Object.values(memberStats).reduce((sum, ms) => sum + ms.taskCount, 0) || 1;
              const contribution = ((m.taskCount / totalTasks) * 100).toFixed(0);
              const progress = m.taskCount > 0 ? ((m.completed / m.taskCount) * 100).toFixed(0) : 0;
              return `
                <tr>
                  <td>
                    <button class="insights-expand-btn">${icons.chevronRight}</button>
                  </td>
                  <td>
                    <div class="insights-member-cell">
                      <div class="insights-member-avatar" style="background: ${stringToColor(m.user.name)}">${getInitials(m.user.name)}</div>
                      <span>${escapeHtml(m.user.name)}</span>
                    </div>
                  </td>
                  <td class="text-center text-primary">${m.taskCount}</td>
                  <td class="text-center">${contribution}%</td>
                  <td class="text-center">${m.completed}</td>
                  <td class="text-center text-primary">${m.incomplete}</td>
                  <td class="text-center text-danger">${m.overdue}</td>
                  <td>
                    <div class="insights-progress-cell">
                      <div class="progress-bar insights-progress-bar">
                        <div class="progress-fill insights-progress-fill" style="width: ${progress}%"></div>
                      </div>
                      <span class="insights-progress-text">${progress}%</span>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderInsightsTasks(tasks, completedTasks, incompleteTasks, overdueTasks) {
  // Tasks completed early (completed before due date)
  const tasksCompletedEarly = completedTasks.filter(t => {
    if (!t.due_date || !t.completed_at) return false;
    return new Date(t.completed_at) < new Date(t.due_date);
  });

  // Tasks completed late (completed after due date)
  const tasksCompletedLate = completedTasks.filter(t => {
    if (!t.due_date || !t.completed_at) return false;
    return new Date(t.completed_at) > new Date(t.due_date);
  });

  return `
    <div class="insights-content">
      <!-- Task KPI Cards -->
      <div class="insights-kpi-row">
        <div class="card card--kpi insights-kpi-card">
          <div class="insights-kpi-icon success">
            ${icons.checkCircle}
          </div>
          <div class="insights-kpi-data">
            <span class="insights-kpi-label">Completed tasks</span>
            <span class="insights-kpi-value">${completedTasks.length}</span>
          </div>
        </div>
        <div class="card card--kpi insights-kpi-card">
          <div class="insights-kpi-icon warning">
            ${icons.tasks || '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>'}
          </div>
          <div class="insights-kpi-data">
            <span class="insights-kpi-label">Incomplete tasks</span>
            <span class="insights-kpi-value">${incompleteTasks.length}</span>
          </div>
        </div>
        <div class="card card--kpi insights-kpi-card">
          <div class="insights-kpi-icon danger">
            ${icons.warning || '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'}
          </div>
          <div class="insights-kpi-data">
            <span class="insights-kpi-label">Overdue tasks</span>
            <span class="insights-kpi-value">${overdueTasks.length}</span>
          </div>
        </div>
        <div class="card card--kpi insights-kpi-card">
          <div class="insights-kpi-icon info">
            ${icons.clock || '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'}
          </div>
          <div class="insights-kpi-data">
            <span class="insights-kpi-label">Total tasks</span>
            <span class="insights-kpi-value">${tasks.length}</span>
          </div>
        </div>
      </div>

      <!-- Task Tables Row -->
      <div class="insights-tables-row">
        <div class="card card--insights insights-table-card insights-table-half">
          <div class="insights-card-header">
            <span class="insights-card-title">Overdue Tasks</span>
            <a href="#" class="insights-see-all">See all</a>
          </div>
          ${overdueTasks.length > 0 ? `
            <table class="insights-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>End Date</th>
                  <th>Days overdue</th>
                </tr>
              </thead>
              <tbody>
                ${overdueTasks.slice(0, 5).map(task => {
                  const status = getStatusById(task.status_id);
                  const daysOverdue = Math.ceil((new Date() - new Date(task.due_date)) / (1000 * 60 * 60 * 24));
                  return `
                    <tr>
                      <td>${escapeHtml(task.title)}</td>
                      <td><span class="insights-status-badge" style="background: ${status?.color || FALLBACK_COLOR}">${status?.name || 'Unknown'}</span></td>
                      <td>${formatDate(task.due_date)}</td>
                      <td class="text-danger">${daysOverdue} days</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          ` : renderEmptyTableState('No overdue tasks')}
        </div>

        <div class="card card--insights insights-table-card insights-table-half">
          <div class="insights-card-header">
            <span class="insights-card-title">Tasks completed early</span>
            <a href="#" class="insights-see-all">See all</a>
          </div>
          ${tasksCompletedEarly.length > 0 ? `
            <table class="insights-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>End Date</th>
                  <th>Completed At</th>
                </tr>
              </thead>
              <tbody>
                ${tasksCompletedEarly.slice(0, 5).map(task => {
                  const status = getStatusById(task.status_id);
                  return `
                    <tr>
                      <td>${escapeHtml(task.title)}</td>
                      <td><span class="insights-status-badge" style="background: ${status?.color || FALLBACK_COLOR}">${status?.name || 'Unknown'}</span></td>
                      <td>${formatDate(task.due_date)}</td>
                      <td>${formatDate(task.completed_at)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          ` : renderEmptyTableState('No data')}
        </div>
      </div>

      <div class="insights-tables-row">
        <div class="card card--insights insights-table-card insights-table-half">
          <div class="insights-card-header">
            <span class="insights-card-title">Tasks completed late</span>
            <a href="#" class="insights-see-all">See all</a>
          </div>
          ${tasksCompletedLate.length > 0 ? `
            <table class="insights-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>End Date</th>
                  <th>Completed At</th>
                </tr>
              </thead>
              <tbody>
                ${tasksCompletedLate.slice(0, 5).map(task => {
                  const status = getStatusById(task.status_id);
                  return `
                    <tr>
                      <td>${escapeHtml(task.title)}</td>
                      <td><span class="insights-status-badge" style="background: ${status?.color || FALLBACK_COLOR}">${status?.name || 'Unknown'}</span></td>
                      <td>${formatDate(task.due_date)}</td>
                      <td>${formatDate(task.completed_at)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          ` : renderEmptyTableState('No data')}
        </div>
      </div>
    </div>
  `;
}

function renderEmptyTableState(message) {
  return `
    <div class="insights-empty-state">
      <div class="insights-empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
      </div>
      <p class="insights-empty-text">${message}</p>
    </div>
  `;
}

function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `about ${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(dateString);
}

// ==========================================================================
// Render Functions - Roadmap View (Gantt)
// ==========================================================================

function renderRoadmapView(tasks, project) {
  const scale = state.roadmapScale;
  const offset = state.roadmapOffset;
  const today = new Date();

  // Generate timeline data based on scale
  const timeline = generateTimeline(scale, offset, today);
  const { units, timelineStart, timelineEnd, totalDays } = timeline;

  return `
    <div class="roadmap-view">
      <div class="view-toolbar view-toolbar--wrap">
        <div class="toolbar-filters">
          <div class="roadmap-zoom">
            <button class="roadmap-zoom-btn${scale === 'week' ? ' active' : ''}" data-scale="week">Week</button>
            <button class="roadmap-zoom-btn${scale === 'month' ? ' active' : ''}" data-scale="month">Month</button>
            <button class="roadmap-zoom-btn${scale === 'quarter' ? ' active' : ''}" data-scale="quarter">Quarter</button>
            <button class="roadmap-zoom-btn${scale === 'year' ? ' active' : ''}" data-scale="year">Year</button>
          </div>
        </div>
        <div class="toolbar-actions">
          <div class="roadmap-nav">
            <button class="roadmap-nav-btn" data-action="roadmap-prev">${icons.chevronLeft}</button>
            <button class="roadmap-today-btn" data-action="roadmap-today">Today</button>
            <button class="roadmap-nav-btn" data-action="roadmap-next">${icons.chevronRight}</button>
          </div>
        </div>
      </div>
      <div class="card roadmap-content">
        <div class="gantt-wrapper">
        <div class="gantt-sidebar">
          <div class="gantt-sidebar-header">Task Name</div>
          <div class="gantt-task-list">
            ${tasks.map(task => {
              const assignee = task.assignee_id ? getUserById(task.assignee_id) : null;
              const status = getStatusById(task.status_id);
              return `
                <div class="gantt-task-item">
                  <div class="gantt-task-color" style="background: ${status?.color || FALLBACK_COLOR}"></div>
                  <span class="gantt-task-name">${escapeHtml(task.title)}</span>
                  ${assignee ? `
                    <div class="table-avatar" style="background: ${stringToColor(assignee.name)}">
                      ${getInitials(assignee.name)}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
        <div class="gantt-timeline" style="--gantt-columns: ${units.reduce((sum, u) => sum + u.subdivisions.length, 0)}">
          <div class="gantt-header-units">
            ${units.map((unit, unitIndex) => `
              <div class="gantt-unit-name${unitIndex > 0 ? ' unit-start' : ''}" style="grid-column: span ${unit.subdivisions.length}">${unit.name}</div>
            `).join('')}
          </div>
          <div class="gantt-header-subs">
            ${units.map((unit, unitIndex) => `
              ${unit.subdivisions.map((sub, subIndex) => `
                <div class="gantt-subdivision${subIndex === 0 && unitIndex > 0 ? ' unit-start' : ''}">${sub.label}</div>
              `).join('')}
            `).join('')}
          </div>
          <div class="gantt-rows" data-timeline-start="${timelineStart.toISOString()}" data-total-days="${totalDays}">
            ${tasks.map(task => {
              const status = getStatusById(task.status_id);
              const barStyle = getGanttBarStyle(task, timelineStart, totalDays, status?.color || FALLBACK_COLOR);
              return `
                <div class="gantt-row">
                  ${units.map((unit, unitIndex) => `
                    ${unit.subdivisions.map((_, subIndex) => `<div class="gantt-cell${subIndex === 0 && unitIndex > 0 ? ' unit-start' : ''}"></div>`).join('')}
                  `).join('')}
                  ${barStyle ? `
                    <div class="gantt-bar" data-task-id="${task.id}" style="${barStyle}">
                      <div class="gantt-bar-handle gantt-bar-handle-left"></div>
                      <span class="gantt-bar-label">${escapeHtml(task.title)}</span>
                      <div class="gantt-bar-handle gantt-bar-handle-right"></div>
                    </div>
                  ` : `
                    <div class="gantt-bar no-dates" data-task-id="${task.id}" style="left: 10px; width: 100px;">No dates</div>
                  `}
                </div>
              `;
            }).join('')}
            ${renderTodayLine(today, timelineStart, totalDays)}
          </div>
        </div>
        </div>
      </div>
    </div>
  `;
}

// Generate timeline data based on scale
function generateTimeline(scale, offset, today) {
  switch (scale) {
    case 'week':
      return generateWeekTimeline(offset, today);
    case 'month':
      return generateMonthTimeline(offset, today);
    case 'quarter':
      return generateQuarterTimeline(offset, today);
    case 'year':
      return generateYearTimeline(offset, today);
    default:
      return generateMonthTimeline(offset, today);
  }
}

// Week view: Shows ~4 weeks with days as subdivisions
function generateWeekTimeline(offset, today) {
  const units = [];
  const startOfWeek = getStartOfWeek(today);
  startOfWeek.setDate(startOfWeek.getDate() + (offset * 7)); // Each offset unit = 1 week

  // Show 4 weeks
  for (let w = -1; w < 3; w++) {
    const weekStart = new Date(startOfWeek);
    weekStart.setDate(weekStart.getDate() + (w * 7));

    const subdivisions = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + d);
      subdivisions.push({
        label: day.getDate().toString(),
        date: new Date(day)
      });
    }

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    units.push({
      name: `${weekStart.toLocaleDateString('en-US', { month: 'short' })} ${weekStart.getDate()}-${weekEnd.getDate()}`,
      start: new Date(weekStart),
      end: weekEnd,
      subdivisions
    });
  }

  const timelineStart = units[0].start;
  const timelineEnd = units[units.length - 1].end;
  const totalDays = Math.ceil((timelineEnd - timelineStart) / (1000 * 60 * 60 * 24)) + 1;

  return { units, timelineStart, timelineEnd, totalDays };
}

// Month view: Shows ~4 months with weeks as subdivisions
function generateMonthTimeline(offset, today) {
  const units = [];

  for (let i = -1 + offset; i < 3 + offset; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const weeks = getWeeksInMonth(date);

    units.push({
      name: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      start: new Date(date.getFullYear(), date.getMonth(), 1),
      end: new Date(date.getFullYear(), date.getMonth() + 1, 0),
      subdivisions: weeks.map(week => ({ label: week.toString(), date: null }))
    });
  }

  const timelineStart = units[0].start;
  const timelineEnd = units[units.length - 1].end;
  const totalDays = Math.ceil((timelineEnd - timelineStart) / (1000 * 60 * 60 * 24));

  return { units, timelineStart, timelineEnd, totalDays };
}

// Quarter view: Shows ~4 quarters with months as subdivisions
function generateQuarterTimeline(offset, today) {
  const units = [];
  const currentQuarter = Math.floor(today.getMonth() / 3);
  const currentYear = today.getFullYear();

  for (let i = -1 + offset; i < 3 + offset; i++) {
    const quarterIndex = currentQuarter + i;
    const year = currentYear + Math.floor(quarterIndex / 4);
    const quarter = ((quarterIndex % 4) + 4) % 4; // Handle negative modulo

    const quarterStart = new Date(year, quarter * 3, 1);
    const quarterEnd = new Date(year, quarter * 3 + 3, 0);

    const subdivisions = [];
    for (let m = 0; m < 3; m++) {
      const monthDate = new Date(year, quarter * 3 + m, 1);
      subdivisions.push({
        label: monthDate.toLocaleDateString('en-US', { month: 'short' }),
        date: monthDate
      });
    }

    units.push({
      name: `Q${quarter + 1} ${year}`,
      start: quarterStart,
      end: quarterEnd,
      subdivisions
    });
  }

  const timelineStart = units[0].start;
  const timelineEnd = units[units.length - 1].end;
  const totalDays = Math.ceil((timelineEnd - timelineStart) / (1000 * 60 * 60 * 24));

  return { units, timelineStart, timelineEnd, totalDays };
}

// Year view: Shows ~3 years with quarters as subdivisions
function generateYearTimeline(offset, today) {
  const units = [];
  const currentYear = today.getFullYear();

  for (let i = -1 + offset; i < 2 + offset; i++) {
    const year = currentYear + i;

    const subdivisions = [];
    for (let q = 0; q < 4; q++) {
      subdivisions.push({
        label: `Q${q + 1}`,
        date: new Date(year, q * 3, 1)
      });
    }

    units.push({
      name: year.toString(),
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31),
      subdivisions
    });
  }

  const timelineStart = units[0].start;
  const timelineEnd = units[units.length - 1].end;
  const totalDays = Math.ceil((timelineEnd - timelineStart) / (1000 * 60 * 60 * 24));

  return { units, timelineStart, timelineEnd, totalDays };
}

// Helper: Get start of week (Monday)
function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  return new Date(d.setDate(diff));
}

function getWeeksInMonth(date) {
  const weeks = [];
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  let current = new Date(firstDay);
  while (current <= lastDay) {
    weeks.push(current.getDate());
    current.setDate(current.getDate() + 7);
  }
  return weeks;
}

function getGanttBarStyle(task, timelineStart, totalDays, color) {
  if (!task.start_date && !task.due_date) return null;

  const startDate = task.start_date ? new Date(task.start_date) : new Date(task.due_date);
  const endDate = task.due_date ? new Date(task.due_date) : new Date(task.start_date);

  // Ensure end is after start
  const actualStart = startDate < endDate ? startDate : endDate;
  const actualEnd = startDate < endDate ? endDate : startDate;

  // Add at least 1 day duration if same day
  if (actualStart.getTime() === actualEnd.getTime()) {
    actualEnd.setDate(actualEnd.getDate() + 7);
  }

  const startOffset = Math.max(0, (actualStart - timelineStart) / (1000 * 60 * 60 * 24));
  const duration = Math.max(7, (actualEnd - actualStart) / (1000 * 60 * 60 * 24));

  const leftPercent = (startOffset / totalDays) * 100;
  const widthPercent = (duration / totalDays) * 100;

  return `left: ${leftPercent}%; width: ${Math.min(widthPercent, 100 - leftPercent)}%; background: ${color};`;
}

function renderTodayLine(today, timelineStart, totalDays) {
  const dayOffset = (today - timelineStart) / (1000 * 60 * 60 * 24);
  const leftPercent = (dayOffset / totalDays) * 100;

  if (leftPercent < 0 || leftPercent > 100) return '';

  return `
    <div class="gantt-today-line" style="left: ${leftPercent}%;">
      <div class="gantt-today-marker">Today</div>
    </div>
  `;
}

// ==========================================================================
// Render Functions - Placeholders
// ==========================================================================

function renderPlaceholderPage(title, description) {
  updateBreadcrumb([{ label: title, href: `#/${title.toLowerCase()}` }]);

  const mainContent = document.getElementById('main-content');
  mainContent.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">${icons.folder}</div>
      <h2 class="empty-state-title">${escapeHtml(title)}</h2>
      <p class="empty-state-description">${escapeHtml(description)}</p>
      <span class="placeholder-badge">Coming Soon</span>
    </div>
  `;
}

function renderNotFound() {
  const mainContent = document.getElementById('main-content');
  mainContent.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">${icons.folder}</div>
      <h2 class="empty-state-title">Page Not Found</h2>
      <p class="empty-state-description">The page you're looking for doesn't exist.</p>
      <a href="#/projects" class="btn-primary">Back to Projects</a>
    </div>
  `;
}

// ==========================================================================
// Breadcrumb
// ==========================================================================

function updateBreadcrumb(items) {
  const breadcrumb = document.getElementById('breadcrumb');

  breadcrumb.innerHTML = items.map((item, index) => {
    const isLast = index === items.length - 1;
    if (isLast) {
      return `<span class="breadcrumb-current">${escapeHtml(item.label)}</span>`;
    }
    return `<a href="${item.href}">${escapeHtml(item.label)}</a><span class="breadcrumb-separator">/</span>`;
  }).join('');
}

// ==========================================================================
// Utility Functions
// ==========================================================================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function stringToColor(str) {
  if (!str) return FALLBACK_COLOR;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function hexToRgba(hex, alpha) {
  if (!hex) return 'transparent';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darkenColor(hex, factor = 0.3) {
  if (!hex) return hex;
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * (1 - factor));
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * (1 - factor));
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * (1 - factor));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((date - now) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return date < now;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// ==========================================================================
// Dropdown Factory
// ==========================================================================

/**
 * Creates and positions a dropdown menu
 * @param {Object} options - Dropdown configuration
 * @param {string} options.id - Unique dropdown ID
 * @param {HTMLElement} options.anchor - Element to position dropdown below
 * @param {string} options.content - HTML content for the dropdown
 * @param {string} [options.className] - Additional CSS classes
 * @param {boolean} [options.toggle=true] - If true, close dropdown when already open
 * @returns {HTMLElement|null} The dropdown element, or null if toggled closed
 */
function createDropdown({ id, anchor, content, className = '', toggle = true }) {
  // Toggle behavior: if this dropdown is already open, close it
  if (toggle && state.activeDropdown === id) {
    closeDropdown();
    return null;
  }

  // Close any existing dropdown
  closeDropdown();

  // Create dropdown element
  const dropdown = document.createElement('div');
  dropdown.className = `dropdown-menu open ${className}`.trim();
  dropdown.id = id;
  dropdown.innerHTML = content;

  // Position below anchor element
  const rect = anchor.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.top = `${rect.bottom + 4}px`;
  dropdown.style.left = `${rect.left}px`;

  // Add to DOM and track state
  document.body.appendChild(dropdown);
  state.activeDropdown = id;

  // Setup outside click handler
  setTimeout(() => {
    document.addEventListener('click', handleDropdownOutsideClick);
  }, 10);

  return dropdown;
}

/**
 * Attaches event listeners to multiple elements matching a selector
 * @param {HTMLElement|Document} container - Container to search within
 * @param {string} selector - CSS selector for target elements
 * @param {string} event - Event type (e.g., 'click', 'change')
 * @param {Function} handler - Event handler function, receives (element, event)
 * @param {Object} [options] - addEventListener options
 */
function addListeners(container, selector, event, handler, options = {}) {
  container.querySelectorAll(selector).forEach(el => {
    el.addEventListener(event, (e) => handler(el, e), options);
  });
}

// ==========================================================================
// Pagination Component
// ==========================================================================

/**
 * Renders a pagination component
 * @param {Object} options - Pagination configuration
 * @param {number} options.totalItems - Total number of items
 * @param {number} options.currentPage - Current page (1-indexed)
 * @param {number} options.pageSize - Items per page
 * @param {string} options.itemLabel - Label for items (e.g., 'members', 'files')
 * @param {string} options.paginationType - Type identifier for data attributes
 * @returns {string} HTML string for pagination component
 */
function renderPagination({ totalItems, currentPage, pageSize, itemLabel, paginationType }) {
  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Don't show pagination if no items
  if (totalItems === 0) {
    return '';
  }

  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;

  return `
    <div class="pagination" data-pagination-type="${paginationType}">
      <span class="pagination-info">
        Showing ${startItem}-${endItem} of ${totalItems} ${itemLabel}
      </span>
      <div class="pagination-controls">
        <div class="pagination-page-size">
          <span class="pagination-label">Rows per page</span>
          <select class="pagination-select" data-action="change-page-size">
            <option value="10" ${pageSize === 10 ? 'selected' : ''}>10</option>
            <option value="20" ${pageSize === 20 ? 'selected' : ''}>20</option>
            <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
          </select>
        </div>
        ${totalPages > 1 ? `
          <div class="pagination-nav">
            <button class="pagination-btn ${prevDisabled ? 'disabled' : ''}"
                    data-action="prev-page"
                    ${prevDisabled ? 'disabled' : ''}>
              ${icons.chevronLeft}
            </button>
            <span class="pagination-pages">${currentPage}/${totalPages}</span>
            <button class="pagination-btn ${nextDisabled ? 'disabled' : ''}"
                    data-action="next-page"
                    ${nextDisabled ? 'disabled' : ''}>
              ${icons.chevronRight}
            </button>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Gets paginated items from an array
 * @param {Array} items - Full array of items
 * @param {number} page - Current page (1-indexed)
 * @param {number} pageSize - Items per page
 * @returns {Array} Paginated subset of items
 */
function getPaginatedItems(items, page, pageSize) {
  const startIndex = (page - 1) * pageSize;
  return items.slice(startIndex, startIndex + pageSize);
}

// ==========================================================================
// Modal System
// ==========================================================================

function openModal(modalId) {
  state.activeModal = modalId;
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.add('open');
  }
}

function closeModal() {
  state.activeModal = null;
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.remove('open');
  }
}

function renderModalContainer() {
  // Only create if doesn't exist
  if (document.getElementById('modal-overlay')) return;

  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'modal-overlay';
  modalOverlay.className = 'modal-overlay';
  modalOverlay.innerHTML = '<div class="modal" id="modal-content"></div>';
  document.body.appendChild(modalOverlay);

  // Close on overlay click
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.activeModal) {
      closeModal();
    }
  });
}

function showModal(title, bodyHtml, footerHtml) {
  renderModalContainer();
  const modalContent = document.getElementById('modal-content');

  modalContent.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">${escapeHtml(title)}</h2>
      <button class="modal-close" data-action="close-modal">${icons.x}</button>
    </div>
    <div class="modal-body">
      ${bodyHtml}
    </div>
    ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
  `;

  openModal(title);

  // Focus first input
  setTimeout(() => {
    const firstInput = modalContent.querySelector('input, textarea, select');
    if (firstInput) firstInput.focus();
  }, 100);
}

// ==========================================================================
// Toast Notifications
// ==========================================================================

function renderToastContainer() {
  if (document.getElementById('toast-container')) return;

  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'toast-container';
  document.body.appendChild(container);
}

function showToast(message, type = 'default') {
  renderToastContainer();
  const container = document.getElementById('toast-container');

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button class="toast-close">${icons.x}</button>
  `;

  container.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);

  // Auto dismiss
  const timeout = setTimeout(() => dismissToast(toast), 4000);

  // Manual dismiss
  toast.querySelector('.toast-close').addEventListener('click', () => {
    clearTimeout(timeout);
    dismissToast(toast);
  });
}

function dismissToast(toast) {
  toast.classList.remove('show');
  setTimeout(() => toast.remove(), 300);
}

// ==========================================================================
// Create Task Modal
// ==========================================================================

function showCreateTaskModal(projectSlug, preselectedGroupId = null, groupType = 'status') {
  const project = getProjectBySlug(projectSlug);
  if (!project) return;

  const statuses = getStatusesForProject(project.id);
  const priorities = state.priorities;
  const labels = getLabelsForProject(project.id);
  const users = state.users;

  // Determine default values based on group type
  let defaultStatus = statuses[0]?.id || '';
  let defaultPriority = '';
  let defaultAssignee = '';

  if (groupType === 'status' && preselectedGroupId) {
    defaultStatus = preselectedGroupId;
  } else if (groupType === 'priority' && preselectedGroupId) {
    defaultPriority = preselectedGroupId === 'priority-none' ? '' : preselectedGroupId;
  } else if (groupType === 'assignee' && preselectedGroupId) {
    defaultAssignee = preselectedGroupId === 'unassigned' ? '' : preselectedGroupId.replace('assignee-', '');
  }

  const bodyHtml = `
    <form id="create-task-form">
      <div class="form-group">
        <label class="form-label required">Task Title</label>
        <input type="text" class="form-input" name="title" placeholder="Enter task title" required>
      </div>

      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" name="description" placeholder="Add a description..."></textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-select" name="status_id">
            ${statuses.map(s => `
              <option value="${s.id}" ${s.id === defaultStatus ? 'selected' : ''}>${escapeHtml(s.name)}</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Priority</label>
          <select class="form-select" name="priority_id">
            <option value="" ${!defaultPriority ? 'selected' : ''}>None</option>
            ${priorities.map(p => `
              <option value="${p.id}" ${p.id === defaultPriority ? 'selected' : ''}>${escapeHtml(p.name)}</option>
            `).join('')}
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Assignee</label>
          <select class="form-select" name="assignee_id">
            <option value="" ${!defaultAssignee ? 'selected' : ''}>Unassigned</option>
            ${users.map(u => `
              <option value="${u.id}" ${u.id === defaultAssignee ? 'selected' : ''}>${escapeHtml(u.name)}</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Due Date</label>
          <input type="date" class="form-input" name="due_date">
        </div>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn-secondary" data-action="close-modal">Cancel</button>
    <button class="btn-primary" data-action="submit-task" data-project-slug="${projectSlug}">
      ${icons.plus} Create Task
    </button>
  `;

  showModal('Create Task', bodyHtml, footerHtml);
  attachCreateTaskListeners(projectSlug);
}

function attachCreateTaskListeners(projectSlug) {
  // Close button
  document.querySelectorAll('[data-action="close-modal"]').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  // Submit button
  document.querySelectorAll('[data-action="submit-task"]').forEach(btn => {
    btn.addEventListener('click', () => handleCreateTask(projectSlug));
  });

  // Form submit on Enter
  const form = document.getElementById('create-task-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleCreateTask(projectSlug);
    });
  }
}

function handleCreateTask(projectSlug) {
  const project = getProjectBySlug(projectSlug);
  if (!project) return;

  const form = document.getElementById('create-task-form');
  const formData = new FormData(form);

  const title = formData.get('title')?.trim();
  if (!title) {
    showToast('Task title is required', 'error');
    return;
  }

  // Get max sequence_id for this project
  const projectTasks = getTasksForProject(project.id);
  const maxSeq = projectTasks.reduce((max, t) => Math.max(max, t.sequence_id || 0), 0);

  const newTask = {
    id: generateId('task'),
    project_id: project.id,
    sequence_id: maxSeq + 1,
    title: title,
    description: formData.get('description') || '',
    status_id: formData.get('status_id') || null,
    priority_id: formData.get('priority_id') || null,
    assignee_id: formData.get('assignee_id') || null,
    due_date: formData.get('due_date') || null,
    start_date: null,
    label_ids: [],
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  state.tasks.push(newTask);
  closeModal();
  showToast(`Task "${title}" created successfully`, 'success');
  renderProjectDetail(projectSlug);
}

// ==========================================================================
// Create Project Modal
// ==========================================================================

// Use centralized PROJECT_COLORS from the color system
const projectColors = PROJECT_COLORS;

function showCreateProjectModal() {
  const bodyHtml = `
    <form id="create-project-form">
      <div class="form-group">
        <label class="form-label required">Project Name</label>
        <input type="text" class="form-input" name="name" placeholder="Enter project name" required>
      </div>

      <div class="form-group">
        <label class="form-label required">Project Identifier</label>
        <input type="text" class="form-input" name="identifier" placeholder="e.g., PROJ" maxlength="6" style="text-transform: uppercase;">
        <span class="form-hint">Short code used for task IDs (e.g., PROJ-1)</span>
      </div>

      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" name="description" placeholder="Describe your project..."></textarea>
      </div>

      <div class="form-group">
        <label class="form-label">Color</label>
        <div class="color-picker">
          ${projectColors.map((color, i) => `
            <div class="color-swatch ${i === 0 ? 'selected' : ''}"
                 style="background: ${color}"
                 data-color="${color}"></div>
          `).join('')}
        </div>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn-secondary" data-action="close-modal">Cancel</button>
    <button class="btn-primary" data-action="submit-project">
      ${icons.plus} Create Project
    </button>
  `;

  showModal('Create Project', bodyHtml, footerHtml);
  attachCreateProjectListeners();
}

function attachCreateProjectListeners() {
  // Close button
  document.querySelectorAll('[data-action="close-modal"]').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  // Color picker
  document.querySelectorAll('.color-swatch').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
    });
  });

  // Auto-generate identifier from name
  const nameInput = document.querySelector('[name="name"]');
  const identifierInput = document.querySelector('[name="identifier"]');
  if (nameInput && identifierInput) {
    nameInput.addEventListener('input', () => {
      if (!identifierInput.dataset.manual) {
        const words = nameInput.value.trim().split(/\s+/);
        const identifier = words.map(w => w[0]?.toUpperCase() || '').join('').slice(0, 4);
        identifierInput.value = identifier;
      }
    });
    identifierInput.addEventListener('input', () => {
      identifierInput.dataset.manual = 'true';
      identifierInput.value = identifierInput.value.toUpperCase();
    });
  }

  // Submit button
  document.querySelectorAll('[data-action="submit-project"]').forEach(btn => {
    btn.addEventListener('click', handleCreateProject);
  });
}

function handleCreateProject() {
  const form = document.getElementById('create-project-form');
  const formData = new FormData(form);

  const name = formData.get('name')?.trim();
  const identifier = formData.get('identifier')?.trim().toUpperCase();

  if (!name) {
    showToast('Project name is required', 'error');
    return;
  }

  if (!identifier) {
    showToast('Project identifier is required', 'error');
    return;
  }

  // Check for duplicate identifier
  if (state.projects.some(p => p.identifier === identifier)) {
    showToast('Project identifier already exists', 'error');
    return;
  }

  const selectedColor = document.querySelector('.color-swatch.selected');
  const color = selectedColor?.dataset.color || projectColors[0];

  // Generate slug from name
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const newProject = {
    id: generateId('proj'),
    workspace_id: state.workspace?.id || 'ws-001',
    name: name,
    identifier: identifier,
    slug: slug,
    description: formData.get('description') || '',
    color: color,
    is_favorite: false,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Create default statuses for the project (using centralized COLOR_PALETTE)
  const defaultStatuses = [
    { name: 'Backlog', color: COLOR_PALETTE.gray.hex, category: 'todo', sort_order: 1 },
    { name: 'To Do', color: COLOR_PALETTE.blue.hex, category: 'todo', sort_order: 2 },
    { name: 'In Progress', color: COLOR_PALETTE.amber.hex, category: 'in_progress', sort_order: 3 },
    { name: 'Done', color: COLOR_PALETTE.green.hex, category: 'done', sort_order: 4 }
  ];

  defaultStatuses.forEach(status => {
    state.statuses.push({
      id: generateId('status'),
      project_id: newProject.id,
      ...status
    });
  });

  state.projects.push(newProject);
  closeModal();
  showToast(`Project "${name}" created successfully`, 'success');
  renderProjectsLanding();
}

// ==========================================================================
// Upload Files Modal
// ==========================================================================

// Temporary storage for files pending upload
let pendingUploadFiles = [];

function showUploadFilesModal(projectSlug, taskId = null) {
  const project = getProjectBySlug(projectSlug);
  if (!project) return;

  pendingUploadFiles = [];

  const bodyHtml = `
    <div class="upload-modal-content">
      <div class="upload-drop-zone" id="upload-drop-zone">
        <input type="file" id="upload-file-input" multiple hidden>
        <div class="upload-drop-icon">
          ${icons.upload}
        </div>
        <div class="upload-drop-text">
          <span class="upload-drop-title">Drop files here or click to browse</span>
          <span class="upload-drop-hint">PNG, JPG, PDF, DOCX, XLS • Max 10MB per file</span>
        </div>
      </div>
      <div class="upload-file-list" id="upload-file-list">
        <!-- Selected files will appear here -->
      </div>
    </div>
  `;

  const footerHtml = `
    <button class="btn-secondary" data-action="close-modal">Cancel</button>
    <button class="btn-primary" id="upload-submit-btn" data-action="submit-upload" data-project-id="${project.id}" ${taskId ? `data-task-id="${taskId}"` : ''} disabled>
      ${icons.upload} Upload Files
    </button>
  `;

  showModal('Upload Files', bodyHtml, footerHtml);
  attachUploadModalListeners(project.id, taskId, projectSlug);
}

function attachUploadModalListeners(projectId, taskId, projectSlug) {
  const dropZone = document.getElementById('upload-drop-zone');
  const fileInput = document.getElementById('upload-file-input');
  const fileList = document.getElementById('upload-file-list');
  const submitBtn = document.getElementById('upload-submit-btn');

  // Click to browse
  dropZone.addEventListener('click', () => fileInput.click());

  // File input change
  fileInput.addEventListener('change', (e) => {
    addFilesToPendingList(e.target.files);
    updateUploadFileList();
  });

  // Drag and drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    addFilesToPendingList(e.dataTransfer.files);
    updateUploadFileList();
  });

  // Close button
  document.querySelectorAll('[data-action="close-modal"]').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingUploadFiles = [];
      closeModal();
    });
  });

  // Submit button
  submitBtn.addEventListener('click', () => {
    if (pendingUploadFiles.length > 0) {
      handleFileUpload(pendingUploadFiles, projectId, taskId);
      pendingUploadFiles = [];
      closeModal();

      // Re-render current view
      if (projectSlug) {
        renderProjectDetail(projectSlug);
      }
    }
  });
}

function addFilesToPendingList(fileList) {
  const maxSize = 10 * 1024 * 1024; // 10MB

  for (const file of fileList) {
    // Check for duplicates
    if (pendingUploadFiles.some(f => f.name === file.name && f.size === file.size)) {
      continue;
    }

    // Check file size
    if (file.size > maxSize) {
      showToast(`"${file.name}" exceeds 10MB limit`, 'error');
      continue;
    }

    pendingUploadFiles.push(file);
  }
}

function updateUploadFileList() {
  const fileList = document.getElementById('upload-file-list');
  const submitBtn = document.getElementById('upload-submit-btn');

  if (pendingUploadFiles.length === 0) {
    fileList.innerHTML = '';
    submitBtn.disabled = true;
    submitBtn.innerHTML = `${icons.upload} Upload Files`;
    return;
  }

  fileList.innerHTML = pendingUploadFiles.map((file, index) => `
    <div class="upload-file-item" data-index="${index}">
      <div class="upload-file-icon">
        ${getFileIcon(getFileTypeFromName(file.name))}
      </div>
      <div class="upload-file-info">
        <span class="upload-file-name">${escapeHtml(file.name)}</span>
        <span class="upload-file-size">${formatFileSize(file.size)}</span>
      </div>
      <button class="upload-file-remove" data-action="remove-file" data-index="${index}">
        ${icons.x}
      </button>
    </div>
  `).join('');

  // Attach remove listeners
  fileList.querySelectorAll('[data-action="remove-file"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      pendingUploadFiles.splice(index, 1);
      updateUploadFileList();
    });
  });

  submitBtn.disabled = false;
  const fileCount = pendingUploadFiles.length;
  submitBtn.innerHTML = `${icons.upload} Upload ${fileCount} ${fileCount === 1 ? 'File' : 'Files'}`;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ==========================================================================
// Invite Member Modal
// ==========================================================================

function showInviteMemberModal(projectSlug) {
  const project = getProjectBySlug(projectSlug);
  if (!project) return;

  const bodyHtml = `
    <form id="invite-member-form">
      <div class="form-group">
        <label class="form-label required">Email Address</label>
        <input type="email" class="form-input" name="email" placeholder="colleague@company.com" required>
      </div>

      <div class="form-group">
        <label class="form-label">Role</label>
        <select class="form-select" name="role">
          <option value="member">Member - Can view and edit tasks</option>
          <option value="admin">Admin - Can manage project settings</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Personal Message (optional)</label>
        <textarea class="form-textarea" name="message" placeholder="Add a personal message to the invitation..."></textarea>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn-secondary" data-action="close-modal">Cancel</button>
    <button class="btn-primary" data-action="submit-invite" data-project-slug="${projectSlug}">
      ${icons.mail} Send Invite
    </button>
  `;

  showModal('Invite Team Member', bodyHtml, footerHtml);
  attachInviteMemberListeners(projectSlug);
}

function attachInviteMemberListeners(projectSlug) {
  document.querySelectorAll('[data-action="close-modal"]').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  document.querySelectorAll('[data-action="submit-invite"]').forEach(btn => {
    btn.addEventListener('click', () => handleInviteMember(projectSlug));
  });
}

function handleInviteMember(projectSlug) {
  const form = document.getElementById('invite-member-form');
  const formData = new FormData(form);

  const email = formData.get('email')?.trim();
  if (!email) {
    showToast('Email address is required', 'error');
    return;
  }

  // In a real app, this would send an API request
  closeModal();
  showToast(`Invitation sent to ${email}`, 'success');
}

// ==========================================================================
// Edit Member Modal
// ==========================================================================

function showEditMemberModal(memberId, projectSlug) {
  const project = getProjectBySlug(projectSlug);
  if (!project) return;

  const members = getMembersForProject(project.id);
  const member = members.find(m => m.id === memberId);
  if (!member) return;

  const bodyHtml = `
    <form id="edit-member-form">
      <div class="form-group">
        <label class="form-label required">Name</label>
        <input type="text" class="form-input" name="name" value="${escapeHtml(member.name)}" required>
      </div>

      <div class="form-group">
        <label class="form-label required">Email Address</label>
        <input type="email" class="form-input" name="email" value="${escapeHtml(member.email)}" required>
      </div>

      <div class="form-group">
        <label class="form-label">Job Title</label>
        <input type="text" class="form-input" name="job_title" value="${escapeHtml(member.job_title || '')}" placeholder="e.g., Project Manager">
      </div>

      <div class="form-group">
        <label class="form-label">Role</label>
        <select class="form-select" name="role">
          <option value="member" ${member.role === 'member' ? 'selected' : ''}>Member - Can view and edit tasks</option>
          <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Admin - Can manage project settings</option>
          <option value="owner" ${member.role === 'owner' ? 'selected' : ''}>Owner - Full access</option>
        </select>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn-secondary" data-action="close-modal">Cancel</button>
    <button class="btn-primary" data-action="submit-edit-member" data-member-id="${memberId}" data-project-slug="${projectSlug}">
      ${icons.check} Save Changes
    </button>
  `;

  showModal('Edit Member', bodyHtml, footerHtml);
  attachEditMemberListeners(memberId, projectSlug);
}

function attachEditMemberListeners(memberId, projectSlug) {
  document.querySelectorAll('[data-action="close-modal"]').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  document.querySelectorAll('[data-action="submit-edit-member"]').forEach(btn => {
    btn.addEventListener('click', () => handleEditMember(memberId, projectSlug));
  });
}

function handleEditMember(memberId, projectSlug) {
  const form = document.getElementById('edit-member-form');
  const formData = new FormData(form);

  const name = formData.get('name')?.trim();
  const email = formData.get('email')?.trim();

  if (!name) {
    showToast('Name is required', 'error');
    return;
  }

  if (!email) {
    showToast('Email address is required', 'error');
    return;
  }

  // In a real app, this would send an API request to update the member
  // For demo purposes, update the local data
  const memberIndex = data.users.findIndex(u => u.id === memberId);
  if (memberIndex !== -1) {
    data.users[memberIndex].name = name;
    data.users[memberIndex].email = email;
    data.users[memberIndex].job_title = formData.get('job_title')?.trim() || '';
    data.users[memberIndex].role = formData.get('role');
  }

  closeModal();
  state.selectedMembers.clear();
  showToast('Member updated successfully', 'success');
  renderProjectDetail(projectSlug);
}

// ==========================================================================
// Manage Workflow Modal
// ==========================================================================

// Use centralized WORKFLOW_COLORS from the color system
const workflowColors = WORKFLOW_COLORS;

function showManageWorkflowModal(projectSlug) {
  const project = getProjectBySlug(projectSlug);
  if (!project) return;

  const statuses = getStatusesForProject(project.id);

  const bodyHtml = `
    <p style="color: var(--color-gray-600); font-size: var(--font-size-sm); margin-bottom: var(--spacing-4);">
      Customize your workflow stages. Tasks will move through these statuses from left to right.
    </p>
    <div class="workflow-list" id="workflow-list">
      ${statuses.map(status => renderWorkflowItem(status)).join('')}
    </div>
    <button class="workflow-add-status" data-action="add-status">
      ${icons.plus} Add Status
    </button>
  `;

  const footerHtml = `
    <button class="btn-secondary" data-action="close-modal">Cancel</button>
    <button class="btn-primary" data-action="save-workflow" data-project-slug="${projectSlug}">
      Save Changes
    </button>
  `;

  showModal('Manage Workflow', bodyHtml, footerHtml);
  attachWorkflowModalListeners(projectSlug);
}

function renderWorkflowItem(status) {
  const categoryLabel = status.category === 'done' ? 'Done' :
                        status.category === 'in_progress' ? 'Active' : 'Not Started';

  return `
    <div class="workflow-item" data-status-id="${status.id}">
      <span class="workflow-item-drag" title="Drag to reorder">
        ${icons.grip}
      </span>
      <div class="workflow-item-color"
           style="background: ${status.color}"
           data-action="change-color"
           data-status-id="${status.id}"
           title="Change color"></div>
      <input type="text"
             class="workflow-item-input"
             value="${escapeHtml(status.name)}"
             data-status-id="${status.id}"
             data-field="name">
      <select class="workflow-item-category"
              data-status-id="${status.id}"
              data-field="category"
              style="cursor: pointer;">
        <option value="todo" ${status.category === 'todo' ? 'selected' : ''}>Not Started</option>
        <option value="in_progress" ${status.category === 'in_progress' ? 'selected' : ''}>Active</option>
        <option value="done" ${status.category === 'done' ? 'selected' : ''}>Done</option>
      </select>
      <button class="workflow-item-delete"
              data-action="delete-status"
              data-status-id="${status.id}"
              title="Delete status">
        ${icons.trash}
      </button>
    </div>
  `;
}

function attachWorkflowModalListeners(projectSlug) {
  const project = getProjectBySlug(projectSlug);
  if (!project) return;

  // Close button
  document.querySelectorAll('[data-action="close-modal"]').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  // Save button
  document.querySelectorAll('[data-action="save-workflow"]').forEach(btn => {
    btn.addEventListener('click', () => saveWorkflowChanges(projectSlug));
  });

  // Add status button
  document.querySelectorAll('[data-action="add-status"]').forEach(btn => {
    btn.addEventListener('click', () => addNewStatus(projectSlug));
  });

  // Color change
  document.querySelectorAll('[data-action="change-color"]').forEach(el => {
    el.addEventListener('click', (e) => {
      const statusId = el.dataset.statusId;
      showWorkflowColorPicker(el, statusId, projectSlug);
    });
  });

  // Delete status
  document.querySelectorAll('[data-action="delete-status"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const statusId = btn.dataset.statusId;
      deleteWorkflowStatus(statusId, projectSlug);
    });
  });

  // Name change (live update on blur)
  document.querySelectorAll('.workflow-item-input').forEach(input => {
    input.addEventListener('blur', () => {
      const statusId = input.dataset.statusId;
      const status = getStatusById(statusId);
      if (status) {
        status.name = input.value.trim() || 'Untitled';
      }
    });
  });

  // Category change
  document.querySelectorAll('.workflow-item-category').forEach(select => {
    select.addEventListener('change', () => {
      const statusId = select.dataset.statusId;
      const status = getStatusById(statusId);
      if (status) {
        status.category = select.value;
      }
    });
  });
}

function addNewStatus(projectSlug) {
  const project = getProjectBySlug(projectSlug);
  if (!project) return;

  const statuses = getStatusesForProject(project.id);
  const maxOrder = statuses.reduce((max, s) => Math.max(max, s.sort_order || 0), 0);

  const newStatus = {
    id: generateId('status'),
    project_id: project.id,
    name: 'New Status',
    color: workflowColors[statuses.length % workflowColors.length],
    category: 'todo',
    sort_order: maxOrder + 1
  };

  state.statuses.push(newStatus);

  // Re-render the workflow list
  const list = document.getElementById('workflow-list');
  if (list) {
    const statusesUpdated = getStatusesForProject(project.id);
    list.innerHTML = statusesUpdated.map(status => renderWorkflowItem(status)).join('');
    attachWorkflowModalListeners(projectSlug);
  }

  showToast('Status added', 'success');
}

function deleteWorkflowStatus(statusId, projectSlug) {
  const project = getProjectBySlug(projectSlug);
  if (!project) return;

  const statuses = getStatusesForProject(project.id);

  // Don't allow deleting if only 1 status remains
  if (statuses.length <= 1) {
    showToast('Cannot delete the last status', 'error');
    return;
  }

  // Check if any tasks use this status
  const tasksWithStatus = state.tasks.filter(t => t.status_id === statusId);
  if (tasksWithStatus.length > 0) {
    if (!confirm(`${tasksWithStatus.length} task(s) use this status. They will be moved to the first status. Continue?`)) {
      return;
    }
    // Move tasks to first available status
    const firstStatus = statuses.find(s => s.id !== statusId);
    if (firstStatus) {
      tasksWithStatus.forEach(t => {
        t.status_id = firstStatus.id;
      });
    }
  }

  // Remove status
  const index = state.statuses.findIndex(s => s.id === statusId);
  if (index !== -1) {
    state.statuses.splice(index, 1);
  }

  // Re-render the workflow list
  const list = document.getElementById('workflow-list');
  if (list) {
    const statusesUpdated = getStatusesForProject(project.id);
    list.innerHTML = statusesUpdated.map(status => renderWorkflowItem(status)).join('');
    attachWorkflowModalListeners(projectSlug);
  }

  showToast('Status deleted', 'success');
}

function showWorkflowColorPicker(targetElement, statusId, projectSlug) {
  // Remove existing picker
  const existingPicker = document.getElementById('workflow-color-picker');
  if (existingPicker) existingPicker.remove();

  const status = getStatusById(statusId);
  if (!status) return;

  const picker = document.createElement('div');
  picker.id = 'workflow-color-picker';
  picker.className = 'workflow-color-picker';
  picker.innerHTML = workflowColors.map(color => `
    <div class="color-swatch color-swatch--sm ${color === status.color ? 'selected' : ''}"
         style="background: ${color}"
         data-color="${color}"></div>
  `).join('');

  // Position picker
  const rect = targetElement.getBoundingClientRect();
  picker.style.top = `${rect.bottom + 4}px`;
  picker.style.left = `${rect.left}px`;

  document.body.appendChild(picker);

  // Handle color selection
  picker.querySelectorAll('.color-swatch--sm').forEach(option => {
    option.addEventListener('click', () => {
      const newColor = option.dataset.color;
      status.color = newColor;
      targetElement.style.background = newColor;
      picker.remove();
    });
  });

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closePicker(e) {
      if (!picker.contains(e.target) && e.target !== targetElement) {
        picker.remove();
        document.removeEventListener('click', closePicker);
      }
    });
  }, 10);
}

function saveWorkflowChanges(projectSlug) {
  // Collect all changes from the form
  const items = document.querySelectorAll('.workflow-item');
  items.forEach((item, index) => {
    const statusId = item.dataset.statusId;
    const status = getStatusById(statusId);
    if (status) {
      const input = item.querySelector('.workflow-item-input');
      const select = item.querySelector('.workflow-item-category');
      if (input) status.name = input.value.trim() || 'Untitled';
      if (select) status.category = select.value;
      status.sort_order = index + 1;
    }
  });

  closeModal();
  showToast('Workflow updated successfully', 'success');
  renderProjectDetail(projectSlug);
}

// ==========================================================================
// Status Change Dropdown
// ==========================================================================

function showStatusDropdown(taskId, buttonElement, projectSlug) {
  const project = getProjectBySlug(projectSlug);
  if (!project) return;

  const task = getTaskById(taskId);
  if (!task) return;

  const statuses = getStatusesForProject(project.id);

  const dropdown = createDropdown({
    id: 'status-dropdown',
    anchor: buttonElement,
    toggle: false,
    content: statuses.map(status => `
      <button class="dropdown-item ${status.id === task.status_id ? 'active' : ''}"
              data-status-id="${status.id}">
        <span class="dropdown-item-dot" style="background: ${status.color}"></span>
        ${escapeHtml(status.name)}
      </button>
    `).join('')
  });

  if (!dropdown) return;

  addListeners(dropdown, '[data-status-id]', 'click', (item) => {
    updateTaskStatus(taskId, item.dataset.statusId, projectSlug);
  });
}

function showGroupByDropdown(buttonElement, projectSlug) {
  const project = getProjectBySlug(projectSlug);
  if (!project) return;

  const currentGroupBy = state.projectGroupBy[project.id] || 'none';
  const groupByOptions = [
    { value: 'none', label: 'None' },
    { value: 'status', label: 'Status' },
    { value: 'priority', label: 'Priority' },
    { value: 'assignee', label: 'Assignee' }
  ];

  const dropdown = createDropdown({
    id: 'group-by-dropdown',
    anchor: buttonElement,
    content: groupByOptions.map(option => `
      <button class="dropdown-item ${option.value === currentGroupBy ? 'active' : ''}"
              data-group-by="${option.value}">
        ${option.label}
        ${option.value === currentGroupBy ? `<span class="dropdown-item-check">${icons.check}</span>` : ''}
      </button>
    `).join('')
  });

  if (!dropdown) return;

  addListeners(dropdown, '[data-group-by]', 'click', (item) => {
    const newGroupBy = item.dataset.groupBy;
    state.projectGroupBy[project.id] = newGroupBy;
    state.collapsedGroups.clear();
    closeDropdown();
    renderProjectDetail(projectSlug);
    showToast(`Grouped by ${newGroupBy}`, 'success');
  });
}

function showSortDropdown(buttonElement, projectSlug) {
  const project = getProjectBySlug(projectSlug);
  if (!project) return;

  const currentSort = getProjectSort(project.id);
  const sortOptions = [
    { field: 'manual', label: 'Manual' },
    { field: 'title', label: 'Title' },
    { field: 'priority', label: 'Priority' },
    { field: 'dueDate', label: 'Due Date' },
    { field: 'created', label: 'Created' },
    { field: 'updated', label: 'Updated' }
  ];

  const dropdown = createDropdown({
    id: 'sort-dropdown',
    anchor: buttonElement,
    content: sortOptions.map(option => {
      const isActive = option.field === currentSort.field;
      const directionIcon = isActive && option.field !== 'manual'
        ? (currentSort.direction === 'asc' ? icons.arrowUp : icons.arrowDown)
        : '';
      return `
        <button class="dropdown-item ${isActive ? 'active' : ''}"
                data-sort-field="${option.field}">
          ${option.label}
          ${directionIcon ? `<span class="dropdown-item-direction">${directionIcon}</span>` : ''}
          ${isActive ? `<span class="dropdown-item-check">${icons.check}</span>` : ''}
        </button>
      `;
    }).join('')
  });

  if (!dropdown) return;

  const sortLabels = { manual: 'Manual', title: 'Title', priority: 'Priority', dueDate: 'Due Date', created: 'Created', updated: 'Updated' };

  addListeners(dropdown, '[data-sort-field]', 'click', (item) => {
    const field = item.dataset.sortField;
    const current = getProjectSort(project.id);

    if (field === current.field && field !== 'manual') {
      state.projectSort[project.id] = { field, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    } else {
      state.projectSort[project.id] = { field, direction: 'asc' };
    }

    closeDropdown();
    renderProjectDetail(projectSlug);
    showToast(`Sorted by ${sortLabels[field]}`, 'success');
  });
}

function showSwimlaneDropdown(buttonElement, projectSlug) {
  const project = getProjectBySlug(projectSlug);
  if (!project) return;

  const currentSwimlane = state.boardSwimlane[project.id] || 'none';
  const swimlaneOptions = [
    { value: 'none', label: 'None' },
    { value: 'priority', label: 'Priority' },
    { value: 'assignee', label: 'Assignee' }
  ];

  const dropdown = createDropdown({
    id: 'swimlane-dropdown',
    anchor: buttonElement,
    content: swimlaneOptions.map(option => `
      <button class="dropdown-item ${option.value === currentSwimlane ? 'active' : ''}"
              data-swimlane="${option.value}">
        ${option.label}
        ${option.value === currentSwimlane ? `<span class="dropdown-item-check">${icons.check}</span>` : ''}
      </button>
    `).join('')
  });

  if (!dropdown) return;

  addListeners(dropdown, '[data-swimlane]', 'click', (item) => {
    const newSwimlane = item.dataset.swimlane;
    state.boardSwimlane[project.id] = newSwimlane;
    closeDropdown();
    renderProjectDetail(projectSlug);
    showToast(`Group by ${newSwimlane === 'none' ? 'None' : newSwimlane}`, 'success');
  });
}

function showFieldsDropdown(buttonElement, projectSlug) {
  const project = getProjectBySlug(projectSlug);
  if (!project) return;

  const currentFields = getProjectFields(project.id);
  const fieldOptions = [
    { key: 'taskKey', label: 'Task Key' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'assignee', label: 'Assignee' },
    { key: 'dueDate', label: 'Due Date' },
    { key: 'labels', label: 'Labels' },
    { key: 'progress', label: 'Progress' }
  ];

  const dropdown = createDropdown({
    id: 'fields-dropdown',
    anchor: buttonElement,
    className: 'fields-dropdown',
    content: `
      <div class="dropdown-header label-uppercase">Show Fields</div>
      ${fieldOptions.map(option => `
        <label class="dropdown-checkbox-item">
          <input type="checkbox" data-field="${option.key}" ${currentFields[option.key] ? 'checked' : ''}>
          <span class="dropdown-checkbox-label">${option.label}</span>
        </label>
      `).join('')}
    `
  });

  if (!dropdown) return;

  addListeners(dropdown, 'input[data-field]', 'change', (checkbox, e) => {
    const fieldKey = e.target.dataset.field;
    const isChecked = e.target.checked;

    if (!state.projectFields[project.id]) {
      state.projectFields[project.id] = getDefaultFields();
    }
    state.projectFields[project.id][fieldKey] = isChecked;
    renderProjectDetail(projectSlug);
  });
}

function showAssigneeFilterDropdown(buttonElement, projectSlug) {
  const project = getProjectBySlug(projectSlug);
  if (!project) return;

  const allTasks = state.tasks.filter(t => t.project_id === project.id);
  const assigneeIds = [...new Set(allTasks.map(t => t.assignee_id).filter(Boolean))];
  const projectMembers = assigneeIds.map(id => getUserById(id)).filter(Boolean);
  projectMembers.sort((a, b) => a.name.localeCompare(b.name));

  const selectedAssignees = state.assigneeFilter[project.id] || [];
  const hasUnassignedTasks = allTasks.some(t => !t.assignee_id);

  const dropdown = createDropdown({
    id: 'assignee-filter-dropdown',
    anchor: buttonElement,
    className: 'assignee-filter-dropdown',
    content: `
      <div class="dropdown-header label-uppercase">Filter by Assignee</div>
      <div class="dropdown-search">
        <input type="text" class="dropdown-search-input" placeholder="Search members...">
      </div>
      <div class="dropdown-checkbox-list">
        ${hasUnassignedTasks ? `
          <label class="dropdown-checkbox-item" data-assignee-id="unassigned">
            <input type="checkbox" data-assignee="unassigned" ${selectedAssignees.includes('unassigned') ? 'checked' : ''}>
            <div class="dropdown-checkbox-avatar unassigned">${icons.x}</div>
            <span class="dropdown-checkbox-label">Unassigned</span>
          </label>
        ` : ''}
        ${projectMembers.map(member => `
          <label class="dropdown-checkbox-item" data-assignee-id="${member.id}">
            <input type="checkbox" data-assignee="${member.id}" ${selectedAssignees.includes(member.id) ? 'checked' : ''}>
            <div class="dropdown-checkbox-avatar" style="background: ${stringToColor(member.name)}">${getInitials(member.name)}</div>
            <span class="dropdown-checkbox-label">${escapeHtml(member.name)}</span>
          </label>
        `).join('')}
      </div>
      <div class="dropdown-footer" ${selectedAssignees.length === 0 ? 'style="display: none;"' : ''}>
        <button class="dropdown-clear-btn" data-action="clear-assignee-filter">Clear filter</button>
      </div>
    `
  });

  if (!dropdown) return;

  const dropdownFooter = dropdown.querySelector('.dropdown-footer');

  // Handle search
  const searchInput = dropdown.querySelector('.dropdown-search-input');
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    dropdown.querySelectorAll('.dropdown-checkbox-item').forEach(item => {
      const label = item.querySelector('.dropdown-checkbox-label').textContent.toLowerCase();
      item.style.display = label.includes(query) ? '' : 'none';
    });
  });

  // Handle checkbox changes
  addListeners(dropdown, 'input[data-assignee]', 'change', (checkbox, e) => {
    const assigneeId = e.target.dataset.assignee;
    const isChecked = e.target.checked;

    if (!state.assigneeFilter[project.id]) {
      state.assigneeFilter[project.id] = [];
    }

    if (isChecked) {
      if (!state.assigneeFilter[project.id].includes(assigneeId)) {
        state.assigneeFilter[project.id].push(assigneeId);
      }
    } else {
      state.assigneeFilter[project.id] = state.assigneeFilter[project.id].filter(id => id !== assigneeId);
    }

    // Show/hide clear filter button based on selection count
    dropdownFooter.style.display = state.assigneeFilter[project.id].length > 0 ? '' : 'none';

    renderProjectDetail(projectSlug);
  });

  // Handle clear filter button
  const clearBtn = dropdown.querySelector('[data-action="clear-assignee-filter"]');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      state.assigneeFilter[project.id] = [];
      closeDropdown();
      renderProjectDetail(projectSlug);
    });
  }

  searchInput.focus();
}

function showPriorityDropdown(taskId, buttonElement, projectSlug) {
  const task = getTaskById(taskId);
  if (!task) return;

  const priorities = state.priorities;

  const dropdown = createDropdown({
    id: 'priority-dropdown',
    anchor: buttonElement,
    toggle: false,
    content: `
      <button class="dropdown-item ${!task.priority_id ? 'active' : ''}" data-priority-id="">
        <span class="dropdown-item-dot" style="background: #9ca3af"></span>
        None
      </button>
      ${priorities.map(p => `
        <button class="dropdown-item ${p.id === task.priority_id ? 'active' : ''}"
                data-priority-id="${p.id}">
          <span class="dropdown-item-dot" style="background: ${p.color}"></span>
          ${escapeHtml(p.name)}
        </button>
      `).join('')}
    `
  });

  if (!dropdown) return;

  addListeners(dropdown, '[data-priority-id]', 'click', (item) => {
    const newPriorityId = item.dataset.priorityId || null;
    updateTaskPriority(taskId, newPriorityId, projectSlug);
  });
}

function updateTaskPriority(taskId, newPriorityId, projectSlug) {
  const task = getTaskById(taskId);
  if (!task) return;

  const oldPriority = task.priority_id ? getPriorityById(task.priority_id) : null;
  const newPriority = newPriorityId ? getPriorityById(newPriorityId) : null;

  task.priority_id = newPriorityId;
  task.updated_at = new Date().toISOString();

  closeDropdown();
  renderProjectDetail(projectSlug);

  const message = newPriority
    ? `Priority set to ${newPriority.name}`
    : 'Priority removed';
  showToast(message, 'success');
}

function showDueDatePicker(taskId, buttonElement, projectSlug) {
  const task = getTaskById(taskId);
  if (!task) return;

  closeDropdown();

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextMonth = new Date(today);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const formatDateValue = (date) => date.toISOString().split('T')[0];

  const picker = document.createElement('div');
  picker.className = 'dropdown-menu date-picker open';
  picker.id = 'date-picker';
  picker.innerHTML = `
    <div class="date-picker-presets">
      <button class="dropdown-item" data-date="${formatDateValue(today)}">
        ${icons.calendar} Today
      </button>
      <button class="dropdown-item" data-date="${formatDateValue(tomorrow)}">
        ${icons.calendar} Tomorrow
      </button>
      <button class="dropdown-item" data-date="${formatDateValue(nextWeek)}">
        ${icons.calendar} Next week
      </button>
      <button class="dropdown-item" data-date="${formatDateValue(nextMonth)}">
        ${icons.calendar} Next month
      </button>
      ${task.due_date ? `
        <button class="dropdown-item text-error" data-date="">
          ${icons.x} Remove date
        </button>
      ` : ''}
    </div>
    <div class="date-picker-divider"></div>
    <div class="date-picker-custom">
      <label class="date-picker-label">Custom date</label>
      <input type="date" class="date-picker-input" value="${task.due_date || ''}">
    </div>
  `;

  const rect = buttonElement.getBoundingClientRect();
  picker.style.position = 'fixed';
  picker.style.top = `${rect.bottom + 4}px`;
  picker.style.left = `${rect.left}px`;

  document.body.appendChild(picker);
  state.activeDropdown = 'date-picker';

  // Handle preset clicks
  picker.querySelectorAll('[data-date]').forEach(item => {
    item.addEventListener('click', () => {
      const newDate = item.dataset.date || null;
      updateTaskDueDate(taskId, newDate, projectSlug);
    });
  });

  // Handle custom date input
  const dateInput = picker.querySelector('.date-picker-input');
  dateInput.addEventListener('change', () => {
    updateTaskDueDate(taskId, dateInput.value || null, projectSlug);
  });

  setTimeout(() => {
    document.addEventListener('click', handleDropdownOutsideClick);
  }, 10);
}

function updateTaskDueDate(taskId, newDate, projectSlug) {
  const task = getTaskById(taskId);
  if (!task) return;

  task.due_date = newDate;
  task.updated_at = new Date().toISOString();

  closeDropdown();
  renderProjectDetail(projectSlug);

  const message = newDate
    ? `Due date set to ${formatDate(newDate)}`
    : 'Due date removed';
  showToast(message, 'success');
}

function showLabelPicker(taskId, buttonElement, projectSlug) {
  const task = getTaskById(taskId);
  if (!task) return;

  const labels = state.labels;
  const taskLabelIds = task.label_ids || [];

  closeDropdown();

  const picker = document.createElement('div');
  picker.className = 'dropdown-menu label-picker open';
  picker.id = 'label-picker';
  picker.innerHTML = `
    <div class="label-picker-header">
      <span class="label-uppercase">Labels</span>
    </div>
    <div class="label-picker-list">
      ${labels.map(label => `
        <label class="label-picker-item">
          <input type="checkbox" ${taskLabelIds.includes(label.id) ? 'checked' : ''} data-label-id="${label.id}">
          <span class="label-picker-name">${escapeHtml(label.name)}</span>
        </label>
      `).join('')}
    </div>
  `;

  const rect = buttonElement.getBoundingClientRect();
  picker.style.position = 'fixed';
  picker.style.top = `${rect.bottom + 4}px`;
  picker.style.left = `${rect.left}px`;

  document.body.appendChild(picker);
  state.activeDropdown = 'label-picker';

  // Handle checkbox changes
  picker.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const labelId = checkbox.dataset.labelId;
      toggleTaskLabel(taskId, labelId, projectSlug);
    });
  });

  setTimeout(() => {
    document.addEventListener('click', handleDropdownOutsideClick);
  }, 10);
}

function toggleTaskLabel(taskId, labelId, projectSlug) {
  const task = getTaskById(taskId);
  if (!task) return;

  if (!task.label_ids) {
    task.label_ids = [];
  }

  const index = task.label_ids.indexOf(labelId);
  const label = getLabelById(labelId);

  if (index === -1) {
    task.label_ids.push(labelId);
    showToast(`Added "${label?.name}" label`, 'success');
  } else {
    task.label_ids.splice(index, 1);
    showToast(`Removed "${label?.name}" label`, 'success');
  }

  task.updated_at = new Date().toISOString();
  renderProjectDetail(projectSlug);

  // Re-render panel if open and re-open the label picker
  const panelAddLabel = document.querySelector('.task-panel [data-action="add-label"]');
  if (panelAddLabel && state.openTaskId === taskId) {
    const updatedTask = getTaskById(taskId);
    renderTaskPanel(updatedTask, projectSlug);
    attachTaskPanelEventListeners(taskId, projectSlug);
    const newAddLabelBtn = document.querySelector('.task-panel [data-action="add-label"]');
    if (newAddLabelBtn) {
      setTimeout(() => showLabelPicker(taskId, newAddLabelBtn, projectSlug), 50);
    }
    return;
  }

  // Re-open the label picker for task row to continue editing
  const labelsEl = document.querySelector(`.task-row[data-task-id="${taskId}"] .task-labels`);
  if (labelsEl) {
    setTimeout(() => showLabelPicker(taskId, labelsEl, projectSlug), 50);
  }
}

function handleDropdownOutsideClick(e) {
  if (!state.activeDropdown) return;

  const dropdown = document.getElementById(state.activeDropdown);
  if (dropdown && dropdown.contains(e.target)) {
    return; // Click is inside dropdown, don't close
  }

  closeDropdown();
}

function closeDropdown() {
  if (state.activeDropdown) {
    const dropdown = document.getElementById(state.activeDropdown);
    if (dropdown) {
      dropdown.remove();
    }
  }

  state.activeDropdown = null;
  document.removeEventListener('click', handleDropdownOutsideClick);
}

function updateTaskStatus(taskId, newStatusId, projectSlug) {
  const task = getTaskById(taskId);
  if (!task) return;

  const oldStatus = getStatusById(task.status_id);
  const newStatus = getStatusById(newStatusId);

  task.status_id = newStatusId;
  task.updated_at = new Date().toISOString();

  closeDropdown();
  showToast(`Task moved to "${newStatus?.name || 'Unknown'}"`, 'success');
  renderProjectDetail(projectSlug);
}

// ==========================================================================
// Quick Add Task (Inline)
// ==========================================================================

function showQuickAddTask(groupId, groupType, projectSlug) {
  state.quickAddStatus = groupId;
  state.quickAddGroupType = groupType;
  renderProjectDetail(projectSlug);

  // Focus the input after render
  setTimeout(() => {
    const input = document.querySelector('.quick-add-input input');
    if (input) input.focus();
  }, 50);
}

function hideQuickAddTask(projectSlug) {
  state.quickAddStatus = null;
  state.quickAddGroupType = null;
  renderProjectDetail(projectSlug);
}

function handleQuickAddTask(groupId, groupType, projectSlug) {
  const input = document.querySelector('.quick-add-input input');
  const title = input?.value?.trim();

  if (!title) {
    hideQuickAddTask(projectSlug);
    return;
  }

  const project = getProjectBySlug(projectSlug);
  if (!project) return;

  const projectTasks = getTasksForProject(project.id);
  const maxSeq = projectTasks.reduce((max, t) => Math.max(max, t.sequence_id || 0), 0);

  // Determine task fields based on group type
  let statusId = null;
  let priorityId = null;
  let assigneeId = null;

  const statuses = getStatusesForProject(project.id);
  const defaultStatus = statuses.find(s => s.category === 'todo') || statuses[0];

  if (groupType === 'status') {
    statusId = groupId;
  } else if (groupType === 'priority') {
    statusId = defaultStatus?.id;
    priorityId = groupId === 'priority-none' ? null : groupId;
  } else if (groupType === 'assignee') {
    statusId = defaultStatus?.id;
    assigneeId = groupId === 'unassigned' ? null : groupId.replace('assignee-', '');
  } else {
    statusId = defaultStatus?.id;
  }

  const newTask = {
    id: generateId('task'),
    project_id: project.id,
    sequence_id: maxSeq + 1,
    title: title,
    description: '',
    status_id: statusId,
    priority_id: priorityId,
    assignee_id: assigneeId,
    due_date: null,
    start_date: null,
    label_ids: [],
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  state.tasks.push(newTask);
  state.quickAddStatus = null;
  state.quickAddGroupType = null;
  showToast(`Task "${title}" created`, 'success');
  renderProjectDetail(projectSlug);
}

// ==========================================================================
// Task Selection
// ==========================================================================

function toggleTaskSelection(taskId, projectSlug) {
  if (state.selectedTasks.has(taskId)) {
    state.selectedTasks.delete(taskId);
  } else {
    state.selectedTasks.add(taskId);
  }
  renderProjectDetail(projectSlug);
}

// ==========================================================================
// Task Detail Side Panel
// ==========================================================================

function renderTaskPanelContainer() {
  // Only create if doesn't exist
  if (document.getElementById('task-panel-overlay')) return;

  const panelOverlay = document.createElement('div');
  panelOverlay.id = 'task-panel-overlay';
  panelOverlay.className = 'panel-overlay';
  panelOverlay.innerHTML = '<div class="side-panel task-panel" id="task-panel-content"></div>';
  document.body.appendChild(panelOverlay);

  // Close on overlay click (but not panel click)
  panelOverlay.addEventListener('click', (e) => {
    if (e.target === panelOverlay) {
      closeTaskPanel();
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.openTaskId) {
      closeTaskPanel();
    }
  });
}

function openTaskPanel(taskId, projectSlug) {
  const task = getTaskById(taskId);
  if (!task) return;

  state.openTaskId = taskId;
  state.openTaskProjectSlug = projectSlug;

  renderTaskPanelContainer();
  renderTaskPanel(task, projectSlug);
  attachTaskPanelEventListeners(taskId, projectSlug);

  const overlay = document.getElementById('task-panel-overlay');
  if (overlay) {
    // Force reflow before adding class for animation
    overlay.offsetHeight;
    overlay.classList.add('open');
  }
}

function closeTaskPanel() {
  state.openTaskId = null;
  state.openTaskProjectSlug = null;

  const overlay = document.getElementById('task-panel-overlay');
  if (overlay) {
    overlay.classList.remove('open');
  }
}

// ==========================================================================
// File Preview Panel
// ==========================================================================

function renderFilePreviewPanelContainer() {
  // Only create if doesn't exist
  if (document.getElementById('file-preview-overlay')) return;

  const panelOverlay = document.createElement('div');
  panelOverlay.id = 'file-preview-overlay';
  panelOverlay.className = 'panel-overlay';
  panelOverlay.innerHTML = '<div class="side-panel file-preview-panel" id="file-preview-content"></div>';
  document.body.appendChild(panelOverlay);

  // Close on overlay click (but not panel click)
  panelOverlay.addEventListener('click', (e) => {
    if (e.target === panelOverlay) {
      closeFilePreview();
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.openFileId) {
      closeFilePreview();
    }
  });
}

function openFilePreview(fileId, projectSlug) {
  const file = getFileById(fileId);
  if (!file) return;

  state.openFileId = fileId;
  state.openFileProjectSlug = projectSlug;

  renderFilePreviewPanelContainer();
  renderFilePreviewPanel(file, projectSlug);

  const overlay = document.getElementById('file-preview-overlay');
  if (overlay) {
    // Force reflow before adding class for animation
    overlay.offsetHeight;
    overlay.classList.add('open');
  }
}

function closeFilePreview() {
  state.openFileId = null;
  state.openFileProjectSlug = null;

  const overlay = document.getElementById('file-preview-overlay');
  if (overlay) {
    overlay.classList.remove('open');
  }
}

function renderFilePreviewPanel(file, projectSlug) {
  const project = getProjectBySlug(projectSlug);
  if (!project || !file) return;

  const uploader = file.uploaded_by ? getUserById(file.uploaded_by) : null;
  const linkedTask = file.task_id ? getTaskById(file.task_id) : null;
  const taskKey = linkedTask ? `${project.identifier}-${linkedTask.sequence_id}` : null;

  const fileTypeIcons = {
    pdf: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    image: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    document: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    spreadsheet: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
    archive: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
    cad: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>'
  };

  const placeholderIcon = '<svg class="file-preview-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><circle cx="9" cy="6" r="1"/><circle cx="12" cy="6" r="1"/></svg>';

  const panelContent = document.getElementById('file-preview-content');
  if (!panelContent) return;

  panelContent.innerHTML = `
    <div class="file-preview-header">
      <div class="file-preview-header-left">
        <div class="file-preview-icon ${file.file_type}">
          ${fileTypeIcons[file.file_type] || fileTypeIcons.document}
        </div>
        <div class="file-preview-title">
          <div class="file-preview-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
          <div class="file-preview-meta">${formatFileSize(file.size_bytes)}</div>
        </div>
      </div>
      <div class="file-preview-actions">
        <button class="file-preview-action-btn" data-action="download-file" data-file-id="${file.id}" title="Download">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        <button class="file-preview-action-btn" data-action="close-file-preview" title="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="file-preview-body">
      <!-- Preview Section -->
      <div class="panel-section">
        <div class="panel-section-header label-uppercase">Preview</div>
        <div class="file-preview-content">
          ${placeholderIcon}
          <div class="file-preview-placeholder-text">Preview not available</div>
          <div class="file-preview-placeholder-hint">Download the file to view its contents</div>
        </div>
      </div>

      <!-- Details Section -->
      <div class="panel-section">
        <div class="panel-section-header label-uppercase">Details</div>
        <div class="file-preview-details-grid">
          <span class="file-preview-details-label">Name</span>
          <span class="file-preview-details-value">${escapeHtml(file.name)}</span>

          <span class="file-preview-details-label">Type</span>
          <span class="file-preview-details-value">${file.file_type.charAt(0).toUpperCase() + file.file_type.slice(1)}</span>

          <span class="file-preview-details-label">Size</span>
          <span class="file-preview-details-value">${formatFileSize(file.size_bytes)}</span>

          <span class="file-preview-details-label">Uploaded</span>
          <span class="file-preview-details-value">${formatDateTime(file.uploaded_at)}</span>

          <span class="file-preview-details-label">Uploaded by</span>
          <span class="file-preview-details-value">
            ${uploader ? `
              <div class="file-preview-uploader">
                <div class="file-preview-uploader-avatar" style="background: ${stringToColor(uploader.name)}">${getInitials(uploader.name)}</div>
                <span>${escapeHtml(uploader.name)}</span>
              </div>
            ` : '<span style="color: var(--color-text-muted)">Unknown</span>'}
          </span>

          <span class="file-preview-details-label">Linked task</span>
          <span class="file-preview-details-value">
            ${linkedTask ? `<a href="#/projects/${projectSlug}/tasks?task=${taskKey}" data-action="open-linked-task" data-task-id="${linkedTask.id}">${escapeHtml(taskKey)}: ${escapeHtml(linkedTask.title)}</a>` : '<span style="color: var(--color-text-muted)">None</span>'}
          </span>
        </div>
      </div>
    </div>

    <div class="file-preview-footer">
      <button class="btn-secondary" data-action="close-file-preview">Close</button>
      <button class="btn-primary" data-action="download-file" data-file-id="${file.id}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Download
      </button>
    </div>
  `;

  // Attach event listeners
  attachFilePreviewEventListeners(projectSlug);
}

function attachFilePreviewEventListeners(projectSlug) {
  // Close button
  document.querySelectorAll('[data-action="close-file-preview"]').forEach(btn => {
    btn.addEventListener('click', closeFilePreview);
  });

  // Download button
  document.querySelectorAll('[data-action="download-file"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const fileId = btn.dataset.fileId;
      const file = getFileById(fileId);
      if (file) {
        showToast(`Downloading "${file.name}" (demo only)`, 'info');
      }
    });
  });

  // Open linked task
  document.querySelectorAll('[data-action="open-linked-task"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const taskId = link.dataset.taskId;
      closeFilePreview();
      openTaskPanel(taskId, projectSlug);
    });
  });
}

function renderTaskPanel(task, projectSlug) {
  const project = getProjectBySlug(projectSlug);
  if (!project || !task) return;

  const status = getStatusById(task.status_id);
  const priority = task.priority_id ? getPriorityById(task.priority_id) : null;
  const assignee = task.assignee_id ? getUserById(task.assignee_id) : null;
  const taskLabels = (task.label_ids || []).map(id => getLabelById(id)).filter(Boolean);
  const taskKey = `${project.identifier}-${task.sequence_id}`;

  // Get files attached to this task
  const taskFiles = state.files.filter(f => f.task_id === task.id);

  const statusBg = status ? hexToRgba(status.color, 0.15) : '';
  const statusDot = status?.color || FALLBACK_COLOR;
  const priorityBg = priority ? hexToRgba(priority.color, 0.15) : '';

  const panelContent = document.getElementById('task-panel-content');
  if (!panelContent) return;

  panelContent.innerHTML = `
    <div class="task-panel-header">
      <div class="task-panel-header-left">
        <span class="task-panel-key">${escapeHtml(taskKey)}</span>
      </div>
      <div class="task-panel-actions">
        <button class="task-panel-action-btn" data-action="copy-link" data-task-key="${escapeHtml(taskKey)}" title="Copy link">
          ${icons.link}
        </button>
        <button class="task-panel-action-btn" title="More options">
          ${icons.moreHorizontal}
        </button>
        <button class="task-panel-action-btn close" data-action="close-panel" title="Close">
          ${icons.x}
        </button>
      </div>
    </div>

    <div class="task-panel-body">
      <input type="text"
             class="task-panel-title-input"
             value="${escapeHtml(task.title)}"
             data-field="title"
             placeholder="Task title...">

      <div class="task-panel-meta">
        <div class="panel-section-header label-uppercase">Details</div>
        <!-- Status -->
        <div class="task-panel-field">
          <span class="task-panel-field-label">Status</span>
          <div class="task-panel-field-value">
            <span class="task-panel-status-badge"
                  style="background: ${statusBg}; color: var(--color-text-secondary)"
                  data-action="change-status">
              <span class="task-panel-status-dot" style="background: ${statusDot}"></span>
              ${escapeHtml(status?.name || 'No status')}
            </span>
          </div>
        </div>

        <!-- Priority -->
        <div class="task-panel-field">
          <span class="task-panel-field-label">Priority</span>
          <div class="task-panel-field-value">
            <span class="task-panel-priority-badge ${priority ? '' : 'empty'}"
                  style="background: ${priorityBg}; color: var(--color-text-secondary)"
                  data-action="change-priority">
              ${priority ? `${getPriorityIcon(priority.name)} ${escapeHtml(priority.name)}` : 'Set priority'}
            </span>
          </div>
        </div>

        <!-- Assignee -->
        <div class="task-panel-field">
          <span class="task-panel-field-label">Assignee</span>
          <div class="task-panel-field-value">
            <div class="task-panel-assignee ${assignee ? '' : 'empty'}" data-action="change-assignee">
              ${assignee
                ? `<div class="task-panel-assignee-avatar" style="background: ${stringToColor(assignee.name)}">
                    ${getInitials(assignee.name)}
                  </div>
                  <span class="task-panel-assignee-name">${escapeHtml(assignee.name)}</span>`
                : `<div class="task-panel-assignee-avatar">+</div>
                  <span class="task-panel-assignee-name">Assign someone</span>`
              }
            </div>
          </div>
        </div>

        <!-- Due Date -->
        <div class="task-panel-field">
          <span class="task-panel-field-label">Due Date</span>
          <div class="task-panel-field-value">
            <input type="date"
                   class="task-panel-date-input"
                   value="${task.due_date || ''}"
                   data-field="due_date">
          </div>
        </div>

        <!-- Start Date -->
        <div class="task-panel-field">
          <span class="task-panel-field-label">Start Date</span>
          <div class="task-panel-field-value">
            <input type="date"
                   class="task-panel-date-input"
                   value="${task.start_date || ''}"
                   data-field="start_date">
          </div>
        </div>

        <!-- Labels -->
        <div class="task-panel-field">
          <span class="task-panel-field-label">Labels</span>
          <div class="task-panel-field-value">
            <div class="task-panel-labels">
              ${taskLabels.map(label => `
                <span class="task-label">${escapeHtml(label.name)}</span>
              `).join('')}
              <button class="task-panel-add-label" data-action="add-label">
                ${icons.plus} Add
              </button>
            </div>
          </div>
        </div>

        <!-- Description -->
        <div class="task-panel-field task-panel-field--description">
          <span class="task-panel-field-label">Description</span>
          <div class="task-panel-field-value">
            <textarea class="task-panel-description-input"
                      data-field="description"
                      placeholder="Add a description...">${escapeHtml(task.description || '')}</textarea>
          </div>
        </div>
      </div>

      <!-- Attachments Section -->
      <div class="panel-section task-panel-section">
        <div class="panel-section-header label-uppercase">
          Attachments
          <span class="task-panel-section-count">${taskFiles.length}</span>
        </div>
        <div class="task-panel-attachments">
          ${taskFiles.length > 0 ? taskFiles.map(file => `
            <div class="task-panel-attachment" data-file-id="${file.id}">
              <div class="task-panel-attachment-icon">
                ${getFileIcon(file.file_type)}
              </div>
              <div class="task-panel-attachment-info">
                <span class="task-panel-attachment-name">${escapeHtml(file.name)}</span>
                <span class="task-panel-attachment-meta">${formatFileSize(file.size_bytes)}</span>
              </div>
              <button class="task-panel-attachment-action" title="Download">
                ${icons.download}
              </button>
            </div>
          `).join('') : `
            <div class="task-panel-empty-state">
              <span>No attachments yet</span>
            </div>
          `}
          <button class="task-panel-add-btn" data-action="add-attachment">
            ${icons.plus} Add attachment
          </button>
          <input type="file" id="task-panel-file-input" class="files-input" multiple hidden>
        </div>
      </div>

      <!-- Activity Section -->
      <div class="panel-section task-panel-section">
        <div class="panel-section-header label-uppercase">
          Activity
        </div>
        <div class="task-panel-activity">
          <div class="task-panel-activity-item">
            <div class="task-panel-activity-icon">
              ${icons.plus}
            </div>
            <div class="task-panel-activity-content">
              <span class="task-panel-activity-text">
                <strong>${escapeHtml(getCurrentUser()?.name || 'Someone')}</strong> created this task
              </span>
              <span class="task-panel-activity-time">${formatDateTime(task.created_at)}</span>
            </div>
          </div>
          ${task.updated_at !== task.created_at ? `
            <div class="task-panel-activity-item">
              <div class="task-panel-activity-icon">
                ${icons.edit || icons.file}
              </div>
              <div class="task-panel-activity-content">
                <span class="task-panel-activity-text">Task was updated</span>
                <span class="task-panel-activity-time">${formatDateTime(task.updated_at)}</span>
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Comments Section -->
      <div class="panel-section task-panel-section">
        <div class="panel-section-header label-uppercase">
          Comments
          <span class="task-panel-section-count">0</span>
        </div>
        <div class="task-panel-comments">
          <div class="task-panel-comment-input-wrapper">
            <div class="task-panel-comment-avatar" style="background: ${stringToColor(getCurrentUser()?.name || 'User')}">
              ${getInitials(getCurrentUser()?.name || 'U')}
            </div>
            <input type="text"
                   class="task-panel-comment-input"
                   placeholder="Add a comment..."
                   disabled>
          </div>
          <div class="task-panel-empty-state">
            <span>No comments yet. Be the first to comment!</span>
          </div>
        </div>
      </div>
    </div>

    <div class="task-panel-footer">
      <div class="task-panel-footer-left">
        <span class="task-panel-footer-info">
          ${task.estimate_hours ? `${icons.clock} ${task.estimate_hours}h estimated` : ''}
        </span>
      </div>
      <div class="task-panel-footer-right">
        <button class="btn-danger-ghost" data-action="archive-task">
          ${icons.archive || icons.trash} Archive
        </button>
      </div>
    </div>
  `;

  // Attach event listeners
  attachTaskPanelEventListeners(task.id, projectSlug);
}

function attachTaskPanelEventListeners(taskId, projectSlug) {
  const panel = document.getElementById('task-panel-content');
  if (!panel) return;

  const project = getProjectBySlug(projectSlug);
  if (!project) return;

  // Close button
  panel.querySelectorAll('[data-action="close-panel"]').forEach(btn => {
    btn.addEventListener('click', closeTaskPanel);
  });

  // Copy link button
  panel.querySelectorAll('[data-action="copy-link"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const taskKey = btn.dataset.taskKey;
      const url = `${window.location.origin}${window.location.pathname}#/projects/${projectSlug}/task/${taskKey}`;
      try {
        await navigator.clipboard.writeText(url);
        showToast('Link copied to clipboard', 'success');
      } catch (err) {
        showToast('Failed to copy link', 'error');
      }
    });
  });

  // Title input - auto-save on blur
  const titleInput = panel.querySelector('[data-field="title"]');
  if (titleInput) {
    titleInput.addEventListener('blur', () => {
      const newTitle = titleInput.value.trim();
      if (newTitle) {
        updateTaskField(taskId, 'title', newTitle, projectSlug);
      }
    });
    titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        titleInput.blur();
      }
    });
  }

  // Description input - auto-save on blur
  const descInput = panel.querySelector('[data-field="description"]');
  if (descInput) {
    descInput.addEventListener('blur', () => {
      updateTaskField(taskId, 'description', descInput.value, projectSlug);
    });
  }

  // Date inputs
  panel.querySelectorAll('[data-field="due_date"], [data-field="start_date"]').forEach(input => {
    input.addEventListener('change', () => {
      const field = input.dataset.field;
      updateTaskField(taskId, field, input.value || null, projectSlug);
    });
  });

  // Status change
  panel.querySelectorAll('[data-action="change-status"]').forEach(btn => {
    btn.addEventListener('click', () => {
      showPanelStatusDropdown(taskId, btn, projectSlug);
    });
  });

  // Priority change
  panel.querySelectorAll('[data-action="change-priority"]').forEach(btn => {
    btn.addEventListener('click', () => {
      showPanelPriorityDropdown(taskId, btn, projectSlug);
    });
  });

  // Assignee change
  panel.querySelectorAll('[data-action="change-assignee"]').forEach(btn => {
    btn.addEventListener('click', () => {
      showPanelAssigneeDropdown(taskId, btn, projectSlug);
    });
  });

  // Archive task
  panel.querySelectorAll('[data-action="archive-task"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Archive this task?')) {
        archiveTask(taskId, projectSlug);
      }
    });
  });

  // Add label - reuse existing label picker
  panel.querySelectorAll('[data-action="add-label"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showLabelPicker(taskId, btn, projectSlug);
    });
  });

  // Add attachment
  const addAttachmentBtn = panel.querySelector('[data-action="add-attachment"]');
  const taskFileInput = panel.querySelector('#task-panel-file-input');

  if (addAttachmentBtn && taskFileInput) {
    addAttachmentBtn.addEventListener('click', () => {
      taskFileInput.click();
    });

    taskFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        const task = getTaskById(taskId);
        if (task) {
          handleFileUpload(e.target.files, task.project_id, taskId);
        }
        e.target.value = '';
      }
    });
  }
}

function updateTaskField(taskId, field, value, projectSlug) {
  const task = getTaskById(taskId);
  if (!task) return;

  const oldValue = task[field];
  if (oldValue === value) return; // No change

  task[field] = value;
  task.updated_at = new Date().toISOString();

  // Re-render the main view to reflect changes
  renderProjectDetail(projectSlug);
}

function archiveTask(taskId, projectSlug) {
  const task = getTaskById(taskId);
  if (!task) return;

  task.is_archived = true;
  task.updated_at = new Date().toISOString();

  closeTaskPanel();
  showToast('Task archived', 'success');
  renderProjectDetail(projectSlug);
}

function showPanelStatusDropdown(taskId, buttonElement, projectSlug) {
  const project = getProjectBySlug(projectSlug);
  if (!project) return;

  const task = getTaskById(taskId);
  if (!task) return;

  const statuses = getStatusesForProject(project.id);

  // Remove any existing dropdown
  closePanelDropdown();

  const dropdown = document.createElement('div');
  dropdown.className = 'dropdown-menu open';
  dropdown.id = 'panel-dropdown';
  dropdown.innerHTML = statuses.map(status => `
    <button class="dropdown-item ${status.id === task.status_id ? 'active' : ''}"
            data-value="${status.id}">
      <span class="dropdown-item-dot" style="background: ${status.color}"></span>
      ${escapeHtml(status.name)}
    </button>
  `).join('');

  positionDropdown(dropdown, buttonElement);
  document.body.appendChild(dropdown);

  dropdown.querySelectorAll('[data-value]').forEach(item => {
    item.addEventListener('click', () => {
      const newStatusId = item.dataset.value;
      updateTaskField(taskId, 'status_id', newStatusId, projectSlug);
      closePanelDropdown();
      // Re-render panel to show updated status
      const updatedTask = getTaskById(taskId);
      renderTaskPanel(updatedTask, projectSlug);
      showToast('Status updated', 'success');
    });
  });

  setTimeout(() => {
    document.addEventListener('click', handlePanelDropdownOutsideClick);
  }, 10);
}

function showPanelPriorityDropdown(taskId, buttonElement, projectSlug) {
  const task = getTaskById(taskId);
  if (!task) return;

  const priorities = state.priorities;

  closePanelDropdown();

  const dropdown = document.createElement('div');
  dropdown.className = 'dropdown-menu open';
  dropdown.id = 'panel-dropdown';
  dropdown.innerHTML = `
    <button class="dropdown-item ${!task.priority_id ? 'active' : ''}" data-value="">
      <span class="dropdown-item-dot" style="background: #9ca3af"></span>
      None
    </button>
    ${priorities.map(p => `
      <button class="dropdown-item ${p.id === task.priority_id ? 'active' : ''}"
              data-value="${p.id}">
        <span class="dropdown-item-dot" style="background: ${p.color}"></span>
        ${escapeHtml(p.name)}
      </button>
    `).join('')}
  `;

  positionDropdown(dropdown, buttonElement);
  document.body.appendChild(dropdown);

  dropdown.querySelectorAll('[data-value]').forEach(item => {
    item.addEventListener('click', () => {
      const newPriorityId = item.dataset.value || null;
      updateTaskField(taskId, 'priority_id', newPriorityId, projectSlug);
      closePanelDropdown();
      const updatedTask = getTaskById(taskId);
      renderTaskPanel(updatedTask, projectSlug);
      showToast('Priority updated', 'success');
    });
  });

  setTimeout(() => {
    document.addEventListener('click', handlePanelDropdownOutsideClick);
  }, 10);
}

function showPanelAssigneeDropdown(taskId, buttonElement, projectSlug) {
  const task = getTaskById(taskId);
  if (!task) return;

  showSearchableUserDropdown(buttonElement, task.assignee_id, (newAssigneeId) => {
    updateTaskField(taskId, 'assignee_id', newAssigneeId, projectSlug);
    const updatedTask = getTaskById(taskId);
    renderTaskPanel(updatedTask, projectSlug);
    showToast('Assignee updated', 'success');
  });
}

function positionDropdown(dropdown, buttonElement) {
  const rect = buttonElement.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.top = `${rect.bottom + 4}px`;
  dropdown.style.left = `${rect.left}px`;
  dropdown.style.minWidth = '200px';
}

function handlePanelDropdownOutsideClick(e) {
  const dropdown = document.getElementById('panel-dropdown');
  if (dropdown && !dropdown.contains(e.target)) {
    closePanelDropdown();
  }
}

function closePanelDropdown() {
  const dropdown = document.getElementById('panel-dropdown');
  if (dropdown) {
    dropdown.remove();
  }
  document.removeEventListener('click', handlePanelDropdownOutsideClick);
}

// ==========================================================================
// Searchable User Dropdown
// ==========================================================================

let searchableDropdownState = {
  focusedIndex: -1,
  filteredUsers: [],
  onSelect: null
};

function showSearchableUserDropdown(buttonElement, currentUserId, onSelect) {
  closeSearchableDropdown();

  const users = state.users;
  searchableDropdownState.filteredUsers = users;
  searchableDropdownState.focusedIndex = -1;
  searchableDropdownState.onSelect = onSelect;

  const dropdown = document.createElement('div');
  dropdown.className = 'searchable-dropdown';
  dropdown.id = 'searchable-dropdown';

  dropdown.innerHTML = `
    <div class="searchable-dropdown-search">
      <div class="searchable-dropdown-search-wrapper">
        <span class="searchable-dropdown-search-icon">${icons.search}</span>
        <input type="text"
               class="searchable-dropdown-input"
               placeholder="Search team members..."
               autocomplete="off">
      </div>
    </div>
    <div class="searchable-dropdown-list" id="searchable-dropdown-list">
      ${renderUserDropdownItems(users, currentUserId)}
    </div>
  `;

  // Position dropdown
  const rect = buttonElement.getBoundingClientRect();
  dropdown.style.top = `${rect.bottom + 4}px`;
  dropdown.style.left = `${rect.left}px`;

  // Ensure dropdown doesn't go off screen
  document.body.appendChild(dropdown);

  // Check if dropdown goes off right edge
  const dropdownRect = dropdown.getBoundingClientRect();
  if (dropdownRect.right > window.innerWidth - 16) {
    dropdown.style.left = 'auto';
    dropdown.style.right = '16px';
  }

  // Check if dropdown goes off bottom edge
  if (dropdownRect.bottom > window.innerHeight - 16) {
    dropdown.style.top = 'auto';
    dropdown.style.bottom = `${window.innerHeight - rect.top + 4}px`;
  }

  // Show dropdown with animation
  requestAnimationFrame(() => {
    dropdown.classList.add('open');
  });

  // Focus search input
  const searchInput = dropdown.querySelector('.searchable-dropdown-input');
  setTimeout(() => searchInput?.focus(), 50);

  // Attach event listeners
  attachSearchableDropdownListeners(dropdown, currentUserId);
}

function renderUserDropdownItems(users, currentUserId) {
  if (users.length === 0) {
    return `
      <div class="searchable-dropdown-empty">
        <div class="searchable-dropdown-empty-icon">${icons.users}</div>
        No users found
      </div>
    `;
  }

  return `
    <button class="searchable-dropdown-item unassigned ${!currentUserId ? 'active' : ''}"
            data-user-id="">
      <div class="searchable-dropdown-item-avatar">
        ${icons.x}
      </div>
      <div class="searchable-dropdown-item-info">
        <div class="searchable-dropdown-item-name">Unassigned</div>
        <div class="searchable-dropdown-item-meta">Remove assignee</div>
      </div>
      <span class="searchable-dropdown-item-check">${icons.check}</span>
    </button>
    <div class="searchable-dropdown-divider"></div>
    ${users.map(user => `
      <button class="searchable-dropdown-item ${user.id === currentUserId ? 'active' : ''}"
              data-user-id="${user.id}">
        <div class="searchable-dropdown-item-avatar" style="background: ${stringToColor(user.name)}">
          ${getInitials(user.name)}
        </div>
        <div class="searchable-dropdown-item-info">
          <div class="searchable-dropdown-item-name">${escapeHtml(user.name)}</div>
          <div class="searchable-dropdown-item-meta">${escapeHtml(user.job_title || user.email)}</div>
        </div>
        <span class="searchable-dropdown-item-check">${icons.check}</span>
      </button>
    `).join('')}
  `;
}

function attachSearchableDropdownListeners(dropdown, currentUserId) {
  const searchInput = dropdown.querySelector('.searchable-dropdown-input');
  const list = dropdown.querySelector('#searchable-dropdown-list');

  // Search input handler
  searchInput?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    filterUserDropdown(query, currentUserId);
  });

  // Keyboard navigation
  searchInput?.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.searchable-dropdown-item');
    const itemCount = items.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        searchableDropdownState.focusedIndex = Math.min(
          searchableDropdownState.focusedIndex + 1,
          itemCount - 1
        );
        updateFocusedItem(dropdown);
        break;

      case 'ArrowUp':
        e.preventDefault();
        searchableDropdownState.focusedIndex = Math.max(
          searchableDropdownState.focusedIndex - 1,
          0
        );
        updateFocusedItem(dropdown);
        break;

      case 'Enter':
        e.preventDefault();
        if (searchableDropdownState.focusedIndex >= 0) {
          const focusedItem = items[searchableDropdownState.focusedIndex];
          if (focusedItem) {
            selectUserFromDropdown(focusedItem.dataset.userId);
          }
        }
        break;

      case 'Escape':
        e.preventDefault();
        closeSearchableDropdown();
        break;
    }
  });

  // Click handlers for items
  list?.addEventListener('click', (e) => {
    const item = e.target.closest('.searchable-dropdown-item');
    if (item) {
      selectUserFromDropdown(item.dataset.userId);
    }
  });

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', handleSearchableDropdownOutsideClick);
  }, 10);
}

function filterUserDropdown(query, currentUserId) {
  const users = state.users;

  if (!query) {
    searchableDropdownState.filteredUsers = users;
  } else {
    searchableDropdownState.filteredUsers = users.filter(user => {
      const nameMatch = user.name.toLowerCase().includes(query);
      const emailMatch = user.email.toLowerCase().includes(query);
      const titleMatch = user.job_title?.toLowerCase().includes(query);
      return nameMatch || emailMatch || titleMatch;
    });
  }

  searchableDropdownState.focusedIndex = -1;

  const list = document.getElementById('searchable-dropdown-list');
  if (list) {
    list.innerHTML = renderUserDropdownItems(searchableDropdownState.filteredUsers, currentUserId);
  }
}

function updateFocusedItem(dropdown) {
  const items = dropdown.querySelectorAll('.searchable-dropdown-item');
  items.forEach((item, index) => {
    item.classList.toggle('focused', index === searchableDropdownState.focusedIndex);
  });

  // Scroll focused item into view
  const focusedItem = items[searchableDropdownState.focusedIndex];
  if (focusedItem) {
    focusedItem.scrollIntoView({ block: 'nearest' });
  }
}

function selectUserFromDropdown(userId) {
  const newAssigneeId = userId || null;
  closeSearchableDropdown();

  if (searchableDropdownState.onSelect) {
    searchableDropdownState.onSelect(newAssigneeId);
  }
}

function handleSearchableDropdownOutsideClick(e) {
  const dropdown = document.getElementById('searchable-dropdown');
  if (dropdown && !dropdown.contains(e.target)) {
    closeSearchableDropdown();
  }
}

function closeSearchableDropdown() {
  const dropdown = document.getElementById('searchable-dropdown');
  if (dropdown) {
    dropdown.classList.remove('open');
    setTimeout(() => dropdown.remove(), 150);
  }
  document.removeEventListener('click', handleSearchableDropdownOutsideClick);
  searchableDropdownState.focusedIndex = -1;
  searchableDropdownState.filteredUsers = [];
  searchableDropdownState.onSelect = null;
}

// ==========================================================================
// Drag and Drop
// ==========================================================================

let dragState = {
  draggingTaskId: null,
  sourceStatusId: null,
  dragElement: null,
  currentProjectSlug: null
};

function initDragAndDrop(projectSlug) {
  dragState.currentProjectSlug = projectSlug;

  // Task list view - task rows
  document.querySelectorAll('.task-row[draggable="true"]').forEach(row => {
    row.addEventListener('dragstart', handleDragStart);
    row.addEventListener('dragend', handleDragEnd);
    row.addEventListener('dragover', handleTaskDragOver);
    row.addEventListener('dragleave', handleDragLeave);
    row.addEventListener('drop', handleTaskDrop);
  });

  // Task list view - task groups (status sections)
  document.querySelectorAll('.task-list').forEach(list => {
    list.addEventListener('dragover', handleListDragOver);
    list.addEventListener('dragleave', handleDragLeave);
    list.addEventListener('drop', handleListDrop);
  });

  // Board view - board cards
  document.querySelectorAll('.board-card[draggable="true"]').forEach(card => {
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    card.addEventListener('dragover', handleCardDragOver);
    card.addEventListener('dragleave', handleDragLeave);
    card.addEventListener('drop', handleCardDrop);
  });

  // Board view - column content areas
  document.querySelectorAll('.board-column-content').forEach(content => {
    content.addEventListener('dragover', handleColumnDragOver);
    content.addEventListener('dragleave', handleDragLeave);
    content.addEventListener('drop', handleColumnDrop);
  });
}

function handleDragStart(e) {
  const element = e.target.closest('.task-row, .board-card');
  if (!element) return;

  const taskId = element.dataset.taskId;
  const task = getTaskById(taskId);
  if (!task) return;

  dragState.draggingTaskId = taskId;
  dragState.sourceStatusId = task.status_id;
  dragState.dragElement = element;

  element.classList.add('dragging');

  // Set drag data
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', taskId);

  // Create custom drag image (optional enhancement)
  const dragImage = element.cloneNode(true);
  dragImage.style.width = `${element.offsetWidth}px`;
  dragImage.style.position = 'absolute';
  dragImage.style.top = '-1000px';
  dragImage.classList.add('drag-ghost');
  document.body.appendChild(dragImage);
  e.dataTransfer.setDragImage(dragImage, 20, 20);
  setTimeout(() => dragImage.remove(), 0);
}

function handleDragEnd(e) {
  const element = e.target.closest('.task-row, .board-card');
  if (element) {
    element.classList.remove('dragging');
  }

  // Clear all drag-over states
  document.querySelectorAll('.drag-over, .drag-over-above, .drag-over-below').forEach(el => {
    el.classList.remove('drag-over', 'drag-over-above', 'drag-over-below');
  });

  dragState.draggingTaskId = null;
  dragState.sourceStatusId = null;
  dragState.dragElement = null;
}

function handleDragLeave(e) {
  const element = e.target.closest('.task-row, .board-card, .task-list, .board-column-content, .task-group, .board-column');
  if (element) {
    element.classList.remove('drag-over', 'drag-over-above', 'drag-over-below');
  }
}

// Task List View - Drag over a task row
function handleTaskDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const targetRow = e.target.closest('.task-row');
  if (!targetRow || targetRow.dataset.taskId === dragState.draggingTaskId) return;

  // Clear previous indicators
  document.querySelectorAll('.task-row.drag-over-above, .task-row.drag-over-below').forEach(el => {
    if (el !== targetRow) el.classList.remove('drag-over-above', 'drag-over-below');
  });

  // Determine if dropping above or below based on mouse position
  const rect = targetRow.getBoundingClientRect();
  const midpoint = rect.top + rect.height / 2;
  const isAbove = e.clientY < midpoint;

  targetRow.classList.remove('drag-over-above', 'drag-over-below');
  targetRow.classList.add(isAbove ? 'drag-over-above' : 'drag-over-below');
}

// Task List View - Drop on a task row
function handleTaskDrop(e) {
  e.preventDefault();
  e.stopPropagation();

  const targetRow = e.target.closest('.task-row');
  if (!targetRow) return;

  const targetTaskId = targetRow.dataset.taskId;
  if (targetTaskId === dragState.draggingTaskId) return;

  const targetTask = getTaskById(targetTaskId);
  if (!targetTask) return;

  // Determine drop position
  const rect = targetRow.getBoundingClientRect();
  const isAbove = e.clientY < rect.top + rect.height / 2;

  // Get target group info from the task group
  const taskGroup = targetRow.closest('.task-group');
  const groupId = taskGroup?.dataset.groupId;
  const groupType = taskGroup?.dataset.groupType || 'status';

  moveTask(dragState.draggingTaskId, groupId, groupType, targetTaskId, isAbove);
}

// Task List View - Drag over the task list container (empty area)
function handleListDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const taskList = e.target.closest('.task-list');
  if (taskList) {
    taskList.classList.add('drag-over');
  }
}

// Task List View - Drop on empty task list area
function handleListDrop(e) {
  e.preventDefault();

  const taskList = e.target.closest('.task-list');
  const taskGroup = taskList?.closest('.task-group');
  const groupId = taskGroup?.dataset.groupId;
  const groupType = taskGroup?.dataset.groupType || 'status';

  if (groupId) {
    moveTask(dragState.draggingTaskId, groupId, groupType, null, false);
  }
}

// Board View - Drag over a board card
function handleCardDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const targetCard = e.target.closest('.board-card');
  if (!targetCard || targetCard.dataset.taskId === dragState.draggingTaskId) return;

  // Clear previous indicators
  document.querySelectorAll('.board-card.drag-over-above, .board-card.drag-over-below').forEach(el => {
    if (el !== targetCard) el.classList.remove('drag-over-above', 'drag-over-below');
  });

  // Determine if dropping above or below
  const rect = targetCard.getBoundingClientRect();
  const midpoint = rect.top + rect.height / 2;
  const isAbove = e.clientY < midpoint;

  targetCard.classList.remove('drag-over-above', 'drag-over-below');
  targetCard.classList.add(isAbove ? 'drag-over-above' : 'drag-over-below');
}

// Board View - Drop on a board card
function handleCardDrop(e) {
  e.preventDefault();
  e.stopPropagation();

  const targetCard = e.target.closest('.board-card');
  if (!targetCard) return;

  const targetTaskId = targetCard.dataset.taskId;
  if (targetTaskId === dragState.draggingTaskId) return;

  const targetTask = getTaskById(targetTaskId);
  if (!targetTask) return;

  // Determine drop position
  const rect = targetCard.getBoundingClientRect();
  const isAbove = e.clientY < rect.top + rect.height / 2;

  // Get target group info from the column
  const column = targetCard.closest('.board-column');
  const groupId = column?.dataset.groupId;
  const groupType = column?.dataset.groupType || 'status';

  moveTask(dragState.draggingTaskId, groupId, groupType, targetTaskId, isAbove);
}

// Board View - Drag over column content area
function handleColumnDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const columnContent = e.target.closest('.board-column-content');
  if (columnContent) {
    columnContent.classList.add('drag-over');
  }
}

// Board View - Drop on column content (empty area or end of column)
function handleColumnDrop(e) {
  e.preventDefault();

  const columnContent = e.target.closest('.board-column-content');
  const column = columnContent?.closest('.board-column');
  const groupId = column?.dataset.groupId;
  const groupType = column?.dataset.groupType || 'status';

  if (groupId) {
    moveTask(dragState.draggingTaskId, groupId, groupType, null, false);
  }
}

// Core function to move a task
function moveTask(taskId, groupId, groupType, relativeToTaskId, insertBefore) {
  const task = getTaskById(taskId);
  if (!task) return;

  const project = getProjectBySlug(dragState.currentProjectSlug);
  if (!project) return;

  let fieldChanged = false;
  let feedbackMessage = '';

  // Update the appropriate task field based on group type
  if (groupType === 'status') {
    if (task.status_id !== groupId) {
      task.status_id = groupId;
      task.updated_at = new Date().toISOString();
      fieldChanged = true;
      const newStatus = getStatusById(groupId);
      feedbackMessage = `Task moved to ${newStatus?.name || 'new status'}`;
    }
  } else if (groupType === 'priority') {
    // groupId is like 'priority-high', 'priority-medium', 'priority-low', 'priority-none'
    const newPriorityId = groupId === 'priority-none' ? null : groupId;
    if (task.priority_id !== newPriorityId) {
      task.priority_id = newPriorityId;
      task.updated_at = new Date().toISOString();
      fieldChanged = true;
      const priority = getPriorityById(newPriorityId);
      feedbackMessage = `Task priority changed to ${priority?.name || 'No Priority'}`;
    }
  } else if (groupType === 'assignee') {
    // groupId is like 'unassigned' or 'assignee-user-001'
    const newAssigneeId = groupId === 'unassigned' ? null : groupId.replace('assignee-', '');
    if (task.assignee_id !== newAssigneeId) {
      task.assignee_id = newAssigneeId;
      task.updated_at = new Date().toISOString();
      fieldChanged = true;
      const assignee = getUserById(newAssigneeId);
      feedbackMessage = `Task assigned to ${assignee?.name || 'Unassigned'}`;
    }
  }

  // Get all tasks in the target group for reordering
  // For now, we use sort_order within the status (simplest approach)
  const targetTasks = state.tasks
    .filter(t => t.project_id === project.id && t.status_id === task.status_id && !t.is_archived)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  // Remove the dragged task from the array if it's already there
  const taskIndex = targetTasks.findIndex(t => t.id === taskId);
  if (taskIndex !== -1) {
    targetTasks.splice(taskIndex, 1);
  }

  // Find insertion index
  let insertIndex = targetTasks.length; // Default to end

  if (relativeToTaskId) {
    const relativeIndex = targetTasks.findIndex(t => t.id === relativeToTaskId);
    if (relativeIndex !== -1) {
      insertIndex = insertBefore ? relativeIndex : relativeIndex + 1;
    }
  }

  // Insert task at new position
  targetTasks.splice(insertIndex, 0, task);

  // Update sort_order for all tasks in this status
  targetTasks.forEach((t, index) => {
    t.sort_order = index + 1;
  });

  // Show feedback
  if (fieldChanged && feedbackMessage) {
    showToast(feedbackMessage, 'success');
  }

  // Re-render the view
  renderProjectDetail(dragState.currentProjectSlug);
}

// ==========================================================================
// Search Expand/Collapse
// ==========================================================================

function initSearch() {
  const searchContainer = document.getElementById('search-container');
  const searchToggle = document.getElementById('search-toggle');
  const searchInput = document.getElementById('search-input');
  const searchClose = document.getElementById('search-close');

  if (!searchContainer || !searchToggle || !searchInput || !searchClose) return;

  searchToggle.addEventListener('click', () => {
    searchContainer.classList.add('expanded');
    searchInput.focus();
  });

  searchClose.addEventListener('click', () => {
    searchContainer.classList.remove('expanded');
    searchInput.value = '';
  });

  // Close on Escape
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchContainer.classList.remove('expanded');
      searchInput.value = '';
    }
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchContainer.contains(e.target) && searchContainer.classList.contains('expanded')) {
      searchContainer.classList.remove('expanded');
    }
  });
}

// ==========================================================================
// Initialization
// ==========================================================================

async function init() {
  // Load all data
  await loadAllData();

  // Initialize search
  initSearch();

  // Set up routing
  window.addEventListener('hashchange', handleRouteChange);

  // Initial render
  if (!window.location.hash) {
    window.location.hash = '#/projects';
  } else {
    handleRouteChange();
  }
}

// Start the app
init();
