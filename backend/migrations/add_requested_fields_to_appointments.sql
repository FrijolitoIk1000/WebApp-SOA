-- Migration: Add requested change fields to appointments table
-- Purpose: Store user-requested changes for admin approval
-- Date: 2024-11-23

-- Add columns to store requested changes
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS requested_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS requested_reason TEXT;

-- Add comment to the table explaining the new fields
COMMENT ON COLUMN appointments.requested_date IS 'Fecha solicitada por el usuario para cambio pendiente de aprobación';
COMMENT ON COLUMN appointments.requested_reason IS 'Motivo solicitado por el usuario para cambio pendiente de aprobación';

-- Create index for better query performance on status field
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- Note: These fields are used when:
-- 1. A regular user requests a change to their appointment
-- 2. The change is stored here with status='pending_change'
-- 3. Admin can approve (applies the changes) or reject (clears these fields)
-- 4. When approved or rejected, these fields are set back to NULL
