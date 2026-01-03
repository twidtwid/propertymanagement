-- Migration 018: Tickets Enhancement
-- Transforms maintenance_tasks into a proper ticketing system
-- Adds activity history and migrates shared_task_items

-- Add ticket-specific fields to maintenance_tasks
ALTER TABLE maintenance_tasks
  ADD COLUMN IF NOT EXISTS vendor_contact_id UUID REFERENCES vendor_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolution TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Activity history table for tracking all changes
CREATE TABLE IF NOT EXISTS ticket_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES maintenance_tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'created', 'status_changed', 'assigned', 'updated', 'closed'
  details JSONB,         -- { from: 'pending', to: 'in_progress' } or { field: 'vendor', value: 'Parker Construction' }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_activity_ticket_id ON ticket_activity(ticket_id);

-- Indexes for filtering tickets
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_status ON maintenance_tasks(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_property_status ON maintenance_tasks(property_id, status);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_vendor_status ON maintenance_tasks(vendor_id, status);

-- Migrate existing completed tasks with resolution notes
UPDATE maintenance_tasks
SET resolution = 'Migrated from legacy system',
    resolved_at = completed_date
WHERE status = 'completed' AND resolution IS NULL;

UPDATE maintenance_tasks
SET resolution = 'Cancelled'
WHERE status = 'cancelled' AND resolution IS NULL;

-- Migrate shared_task_items to tickets
-- Each task list item becomes a maintenance_task (ticket)
INSERT INTO maintenance_tasks (
  id, property_id, vendor_id, title, priority, status, notes, created_at
)
SELECT
  gen_random_uuid(),
  stl.property_id,
  stl.vendor_id,
  sti.task,
  COALESCE(sti.priority, 'medium')::task_priority,
  CASE WHEN sti.is_completed THEN 'completed' ELSE 'pending' END::task_status,
  sti.notes,
  sti.created_at
FROM shared_task_items sti
JOIN shared_task_lists stl ON sti.list_id = stl.id
WHERE stl.is_active = TRUE;

-- Set resolution for migrated completed items
UPDATE maintenance_tasks
SET resolution = 'Completed (migrated from task list)',
    resolved_at = COALESCE(completed_date, NOW())
WHERE status = 'completed'
  AND resolution IS NULL;

-- Archive shared_task_lists (don't delete, just deactivate)
UPDATE shared_task_lists SET is_active = FALSE;

COMMENT ON TABLE ticket_activity IS 'Audit trail of changes to maintenance tickets';
COMMENT ON COLUMN maintenance_tasks.vendor_contact_id IS 'Specific contact at vendor assigned to this ticket';
COMMENT ON COLUMN maintenance_tasks.resolution IS 'How the issue was resolved (required when closing)';
COMMENT ON COLUMN maintenance_tasks.resolved_at IS 'When the ticket was closed';
COMMENT ON COLUMN maintenance_tasks.resolved_by IS 'User who closed the ticket';
