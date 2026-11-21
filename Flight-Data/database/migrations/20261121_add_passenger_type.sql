-- Add passenger_type column to bookings table
-- Supports: 'adult', 'child', 'infant'
-- adult & child: occupy seat
-- infant: does NOT occupy seat (must be with adult/child)
-- Default: 'adult' for backward compatibility

ALTER TABLE bookings 
ADD COLUMN passenger_type VARCHAR(20) DEFAULT 'adult' AFTER phone;

-- Create index for efficient seat counting queries
CREATE INDEX idx_passenger_type ON bookings(passenger_type);
