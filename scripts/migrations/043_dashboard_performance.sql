-- Migration 043: Dashboard Performance Indexes
-- Adds indexes identified through performance analysis to optimize dashboard queries

-- 1. Pin notes lookup by entity_id
-- Used by getDashboardPinnedItems() when fetching notes for multiple entities
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pin_notes_entity_id
ON pin_notes(entity_id);

-- 2. Pinned items active ordered by pinned_at
-- Dashboard queries: WHERE dismissed_at IS NULL ORDER BY pinned_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pinned_items_active_ordered
ON pinned_items(pinned_at DESC)
WHERE dismissed_at IS NULL;

-- 3. Maintenance tasks by status and due_date
-- Frequent filter pattern for pending/in_progress tasks with due dates
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_tasks_status_due
ON maintenance_tasks(status, due_date)
WHERE status IN ('pending', 'in_progress');

-- 4. Vehicles active with expiration dates
-- Used by getUpcomingWeek() for registration/inspection expiry checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_active_expiry
ON vehicles(is_active, registration_expires, inspection_expires)
WHERE is_active = TRUE;

-- 5. Bills for autopay matching (payment suggestions)
-- Optimizes the NOT EXISTS subquery in getPendingPaymentSuggestions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bills_autopay_matching
ON bills(vendor_id, amount, confirmation_date)
WHERE payment_method = 'auto_pay' AND status = 'confirmed';

-- 6. Property weather alerts lookup
-- Used in weather alert aggregation query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_property_weather_alerts_alert
ON property_weather_alerts(weather_alert_id);

-- 7. Vendor communications by vendor and date (for BuildingLink queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_comms_vendor_date
ON vendor_communications(vendor_id, received_at DESC);

-- Update statistics for query planner
ANALYZE pin_notes;
ANALYZE pinned_items;
ANALYZE maintenance_tasks;
ANALYZE vehicles;
ANALYZE bills;
ANALYZE property_weather_alerts;
ANALYZE vendor_communications;
