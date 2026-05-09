# Integration Test Base

Integration tests belong here and should use PostgreSQL through Testcontainers or the CI service database.

Required conventions:

- Seed data must be deterministic.
- Tests must not depend on wall-clock local time; pass explicit KST dates where needed.
- Reservation and inventory tests must assert `available_walkin = produced - reserved - sold_walkin`.
