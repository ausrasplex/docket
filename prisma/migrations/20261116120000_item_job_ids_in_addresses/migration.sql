-- Items and jobs are addressed by their random id again (/fixtures/cmw…, /jobs/cmw…); only rooms keep a
-- readable address (/rooms/kitchen). Their slugs were only derived from names, so nothing else is lost.
DROP INDEX "Fixture_householdId_slug_key";
DROP INDEX "Job_householdId_slug_key";
ALTER TABLE "Fixture" DROP COLUMN "slug";
ALTER TABLE "Job" DROP COLUMN "slug";
