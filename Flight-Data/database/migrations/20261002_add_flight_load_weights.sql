ALTER TABLE flight_records
  ADD COLUMN passenger_weight DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER note,
  ADD COLUMN baggage_pieces INT UNSIGNED NOT NULL DEFAULT 0 AFTER passenger_weight,
  ADD COLUMN baggage_weight DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER baggage_pieces,
  ADD COLUMN cabin_baggage_pieces INT UNSIGNED NOT NULL DEFAULT 0 AFTER baggage_weight,
  ADD COLUMN cabin_baggage_weight DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER cabin_baggage_pieces,
  ADD COLUMN cargo_pieces INT UNSIGNED NOT NULL DEFAULT 0 AFTER cabin_baggage_weight,
  ADD COLUMN cargo_weight DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER cargo_pieces,
  ADD COLUMN total_weight DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER cargo_weight;
