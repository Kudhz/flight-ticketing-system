ALTER TABLE flight_records
  ADD COLUMN adult_pax INT UNSIGNED NOT NULL DEFAULT 0 AFTER pax,
  ADD COLUMN child_pax INT UNSIGNED NOT NULL DEFAULT 0 AFTER adult_pax,
  ADD COLUMN infant_pax INT UNSIGNED NOT NULL DEFAULT 0 AFTER child_pax;

ALTER TABLE flight_load_records
  ADD COLUMN adult_pax INT UNSIGNED NOT NULL DEFAULT 0 AFTER pax,
  ADD COLUMN child_pax INT UNSIGNED NOT NULL DEFAULT 0 AFTER adult_pax,
  ADD COLUMN infant_pax INT UNSIGNED NOT NULL DEFAULT 0 AFTER child_pax;

UPDATE flight_records SET adult_pax = pax;
UPDATE flight_load_records SET adult_pax = pax;
