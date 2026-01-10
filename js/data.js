/**
 * Task Canvas - Data Loading & Helpers
 * Functions for loading JSON data and querying state
 */

import { state, updateState } from './state.js';

// ==========================================================================
// Data Loading
// ==========================================================================

/**
 * Load a JSON file from the data directory
 * @param {string} filename
 * @returns {Promise<any>}
 */
export async function loadJSON(filename) {
  try {
    const response = await fetch(`data/${filename}`);
    if (!response.ok) throw new Error(`Failed to load ${filename}`);
    return await response.json();
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    return null;
  }
}

/**
 * Load all application data
 */
export async function loadAllData() {
  updateState({ isLoading: true, loadingMessage: 'Loading data...' });

  try {
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

    updateState({
      workspace,
      projects: projects || [],
      tasks: tasks || [],
      statuses: statuses || [],
      users: users || [],
      priorities: priorities || [],
      labels: labels || [],
      files: files || [],
      isLoading: false,
      loadingMessage: '',
    });
  } catch (error) {
    console.error('Failed to load data:', error);
    updateState({ isLoading: false, loadingMessage: '' });
  }
}

// ==========================================================================
// Data Helpers - Projects
// ==========================================================================

export function getProjectById(id) {
  return state.projects.find(p => p.id === id);
}

export function getProjectBySlug(slug) {
  return state.projects.find(p => p.slug === slug);
}

export function getFilteredProjects() {
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

export function calculateProjectProgress(projectId) {
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

export function getProjectMembers(projectId) {
  const tasks = getTasksForProject(projectId);
  const memberIds = [...new Set(tasks.map(t => t.assignee_id).filter(Boolean))];
  return memberIds.map(id => getUserById(id)).filter(Boolean);
}

// ==========================================================================
// Data Helpers - Tasks
// ==========================================================================

export function getTasksForProject(projectId, includeArchived = null) {
  const showArchived = includeArchived !== null ? includeArchived : (state.showArchivedTasks[projectId] || false);
  return state.tasks.filter(t => t.project_id === projectId && (showArchived || !t.is_archived));
}

export function getTaskById(id) {
  return state.tasks.find(t => t.id === id);
}

// ==========================================================================
// Data Helpers - Statuses
// ==========================================================================

export function getStatusById(id) {
  return state.statuses.find(s => s.id === id);
}

export function getStatusesForProject(projectId) {
  return state.statuses.filter(s => s.project_id === projectId).sort((a, b) => a.sort_order - b.sort_order);
}

// ==========================================================================
// Data Helpers - Users
// ==========================================================================

export function getUserById(id) {
  return state.users.find(u => u.id === id);
}

export function getCurrentUser() {
  // For now, return the first user as current user
  return state.users[0] || null;
}

// ==========================================================================
// Data Helpers - Priorities
// ==========================================================================

export function getPriorityById(id) {
  return state.priorities.find(p => p.id === id);
}

// ==========================================================================
// Data Helpers - Labels
// ==========================================================================

export function getLabelById(id) {
  return state.labels.find(l => l.id === id);
}

export function getLabelsForProject(projectId) {
  return state.labels.filter(l => l.project_id === projectId);
}

// ==========================================================================
// Data Helpers - Files
// ==========================================================================

export function getFilesForProject(projectId) {
  return state.files.filter(f => f.project_id === projectId);
}

// ==========================================================================
// Data Helpers - Fields
// ==========================================================================

export function getDefaultFields() {
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

export function getProjectFields(projectId) {
  return state.projectFields[projectId] || getDefaultFields();
}

// ==========================================================================
// Utility Functions
// ==========================================================================

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function isOverdue(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

export function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
