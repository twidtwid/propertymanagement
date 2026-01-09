-- Migration 039: Add front_door_code to access_type enum
-- Adds "Front Door Code" as a new property access type

ALTER TYPE access_type ADD VALUE 'front_door_code' AFTER 'gate_code';
