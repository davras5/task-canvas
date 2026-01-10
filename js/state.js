/**
 * Task Canvas - State Management
 * Centralized application state
 */

export const state = {
  // Data
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
  projectGroupBy: {}, // { projectId: 'status' | 'priority' | 'assignee' } - for list view
  projectSort: {}, // { projectId: { field: 'title' | 'priority' | 'dueDate' | 'created' | 'updated', direction: 'asc' | 'desc' } }
  boardSwimlane: {}, // { projectId: 'none' | 'priority' | 'assignee' } - for board view
  showArchivedTasks: {}, // { projectId: boolean }
  assignedToMe: {}, // { projectId: boolean } - filter to show only tasks assigned to current user
  projectFields: {}, // { projectId: { status: bool, priority: bool, ... } }
  collapsedGroups: new Set(),
  selectedFiles: new Set(),
  selectedTasks: new Set(),

  // Modal state
  activeModal: null,
  activeDropdown: null,
  quickAddStatus: null, // For inline task creation (group ID)
  quickAddGroupType: null, // For inline task creation (group type)

  // Task detail panel state
  openTaskId: null,
  openTaskProjectSlug: null,

  // Loading state
  isLoading: false,
  loadingMessage: '',
};

/**
 * Update state with new values
 * @param {Partial<typeof state>} updates
 */
export function updateState(updates) {
  Object.assign(state, updates);
}

/**
 * Reset UI state to defaults
 */
export function resetUIState() {
  state.activeModal = null;
  state.activeDropdown = null;
  state.quickAddStatus = null;
  state.quickAddGroupType = null;
  state.openTaskId = null;
  state.openTaskProjectSlug = null;
}
