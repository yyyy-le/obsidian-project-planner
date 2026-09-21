import { normalizePath } from "obsidian";
import type { PlannerProject, ProjectPlannerSettings } from "../settings";

export const TASK_PLAN_FOLDER = "任务计划";

/** Resolve the real vault-relative folder containing project documents. */
export function getProjectRootPath(
  settings: ProjectPlannerSettings,
  project: PlannerProject,
): string {
  const configured = project.documentRootPath?.trim();
  if (configured) {
    return normalizePath(configured.replace(/^\/+|\/+$/g, ""));
  }

  const base = (settings.projectsBasePath || "Project Planner").trim();
  return normalizePath(`${base}/${project.storageKey ?? project.name}`);
}

/** Resolve the separate planner storage folder for a project. */
export function getPlannerProjectRootPath(
  settings: ProjectPlannerSettings,
  project: PlannerProject,
): string {
  const base = (settings.projectsBasePath || "Project Planner").trim();
  return normalizePath(`${base}/${project.storageKey ?? project.name}`);
}

export function getTaskPlanFolderPath(
  settings: ProjectPlannerSettings,
  project: PlannerProject,
): string {
  return normalizePath(`${getPlannerProjectRootPath(settings, project)}/${TASK_PLAN_FOLDER}`);
}

export function getProjectTaskDataPath(
  settings: ProjectPlannerSettings,
  project: PlannerProject,
): string {
  return normalizePath(`${getTaskPlanFolderPath(settings, project)}/.planner-tasks.json`);
}
