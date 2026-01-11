"use server"

import { query, queryOne } from "../db"
import type {
  MaintenanceTask,
  SharedTaskList,
  SharedTaskItem,
} from "@/types/database"

// ============================================
// MAINTENANCE TASKS
// ============================================

/**
 * Get all maintenance tasks, ordered by priority and due date
 */
export async function getMaintenanceTasks(): Promise<MaintenanceTask[]> {
  return query<MaintenanceTask>(
    `SELECT mt.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM maintenance_tasks mt
     LEFT JOIN properties p ON mt.property_id = p.id
     LEFT JOIN vehicles v ON mt.vehicle_id = v.id
     ORDER BY
       CASE mt.priority
         WHEN 'urgent' THEN 1
         WHEN 'high' THEN 2
         WHEN 'medium' THEN 3
         WHEN 'low' THEN 4
       END,
       mt.due_date NULLS LAST`
  )
}

/**
 * Get only pending or in-progress maintenance tasks
 */
export async function getPendingMaintenanceTasks(): Promise<MaintenanceTask[]> {
  return query<MaintenanceTask>(
    `SELECT mt.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM maintenance_tasks mt
     LEFT JOIN properties p ON mt.property_id = p.id
     LEFT JOIN vehicles v ON mt.vehicle_id = v.id
     WHERE mt.status IN ('pending', 'in_progress')
     ORDER BY
       CASE mt.priority
         WHEN 'urgent' THEN 1
         WHEN 'high' THEN 2
         WHEN 'medium' THEN 3
         WHEN 'low' THEN 4
       END,
       mt.due_date NULLS LAST`
  )
}

/**
 * Get urgent and high priority tasks that are pending or in-progress
 */
export async function getUrgentTasks(): Promise<MaintenanceTask[]> {
  return query<MaintenanceTask>(
    `SELECT mt.*, row_to_json(p.*) as property, row_to_json(v.*) as vehicle
     FROM maintenance_tasks mt
     LEFT JOIN properties p ON mt.property_id = p.id
     LEFT JOIN vehicles v ON mt.vehicle_id = v.id
     WHERE mt.status IN ('pending', 'in_progress')
       AND mt.priority IN ('urgent', 'high')
     ORDER BY
       CASE mt.priority
         WHEN 'urgent' THEN 1
         WHEN 'high' THEN 2
       END,
       mt.due_date NULLS LAST`
  )
}

// ============================================
// SHARED TASK LISTS
// ============================================

/**
 * Get all active shared task lists
 */
export async function getSharedTaskLists(): Promise<SharedTaskList[]> {
  return query<SharedTaskList>(
    `SELECT stl.*, row_to_json(p.*) as property
     FROM shared_task_lists stl
     JOIN properties p ON stl.property_id = p.id
     WHERE stl.is_active = TRUE
     ORDER BY p.name, stl.title`
  )
}

/**
 * Get a shared task list with its items
 */
export async function getSharedTaskListWithItems(listId: string): Promise<SharedTaskList | null> {
  const list = await queryOne<SharedTaskList>(
    `SELECT stl.*, row_to_json(p.*) as property
     FROM shared_task_lists stl
     JOIN properties p ON stl.property_id = p.id
     WHERE stl.id = $1`,
    [listId]
  )

  if (list) {
    const items = await query<SharedTaskItem>(
      `SELECT * FROM shared_task_items WHERE list_id = $1 ORDER BY sort_order, created_at`,
      [listId]
    )
    list.items = items
  }

  return list
}

/**
 * Get all shared task lists for a specific property
 */
export async function getSharedTaskListsForProperty(propertyId: string): Promise<SharedTaskList[]> {
  return query<SharedTaskList>(
    `SELECT * FROM shared_task_lists WHERE property_id = $1 AND is_active = TRUE ORDER BY title`,
    [propertyId]
  )
}
