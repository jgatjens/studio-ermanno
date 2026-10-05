# Hairdresser terminology update

Use Hairdresser / Hairdressers in admin navigation, catalog forms, appointment assignment, shared-hours descriptions and operator documentation. Use parrucchiere in Italian public descriptions.

## Implementation plan

1. Update visible labels and server error messages without changing scheduling behavior.
2. Navigate to `/admin/hairdressers`; redirect the existing `/admin/barbers` URL for saved links.
3. Update project prose and verify admin catalogs, appointments, routes and availability.

## Compatibility

The internal `Barber` model, `barbers` table, `/barbers` API, `barber_id` fields, appointment `barber` response property and `barber_conflict` error code remain unchanged. They represent hairdressers and are retained for compatibility with stored records and independently deployed clients. No database migration or production data changes are needed. A future API rename requires an explicit versioned migration plan.
