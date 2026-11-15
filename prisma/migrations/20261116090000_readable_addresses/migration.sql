-- Readable addresses: /rooms/kitchen, /fixtures/split-system, /jobs/bathroom-renovation.
-- Adds a slug to rooms, items and jobs, fills it from the existing names (lower-case words joined by hyphens,
-- with -2, -3 … for repeats within a household), then makes it required and unique per household.

ALTER TABLE "Space" ADD COLUMN "slug" TEXT;
ALTER TABLE "Fixture" ADD COLUMN "slug" TEXT;
ALTER TABLE "Job" ADD COLUMN "slug" TEXT;

-- name → slug (same rule as lib/slug.ts): accents dropped (café → cafe), apostrophes dropped (butler''s → butlers),
-- anything else not a letter or digit becomes a hyphen
CREATE OR REPLACE FUNCTION docket_slugify(v TEXT, fallback TEXT) RETURNS TEXT AS $$
  SELECT COALESCE(NULLIF(left(trim(both '-' from regexp_replace(regexp_replace(translate(lower(coalesce(v, '')), 'àáâãäåāçèéêëēìíîïīñòóôõöōøùúûüūýÿ', 'aaaaaaaceeeeeiiiiinooooooouuuuuyy'), '[''’]', '', 'g'), '[^a-z0-9]+', '-', 'g')), 60), ''), fallback)
$$ LANGUAGE SQL IMMUTABLE;

WITH s AS (
  SELECT id, docket_slugify(name, 'room') AS base,
         row_number() OVER (PARTITION BY "householdId", docket_slugify(name, 'room') ORDER BY "createdAt", id) AS n
  FROM "Space"
)
UPDATE "Space" t SET slug = CASE WHEN s.n = 1 THEN s.base ELSE s.base || '-' || s.n END FROM s WHERE t.id = s.id;

-- parts are named after their item ("split-system-remote") so they don't take the plain names
WITH f AS (
  SELECT c.id,
         docket_slugify(CASE WHEN p.id IS NULL THEN c.name ELSE p.name || ' ' || c.name END, 'item') AS base,
         c."householdId", c."createdAt"
  FROM "Fixture" c LEFT JOIN "Fixture" p ON p.id = c."parentId"
), r AS (
  SELECT id, base, row_number() OVER (PARTITION BY "householdId", base ORDER BY "createdAt", id) AS n FROM f
)
UPDATE "Fixture" t SET slug = CASE WHEN r.n = 1 THEN r.base ELSE r.base || '-' || r.n END FROM r WHERE t.id = r.id;

WITH j AS (
  SELECT id, docket_slugify(title, 'job') AS base,
         row_number() OVER (PARTITION BY "householdId", docket_slugify(title, 'job') ORDER BY "createdAt", id) AS n
  FROM "Job"
)
UPDATE "Job" t SET slug = CASE WHEN j.n = 1 THEN j.base ELSE j.base || '-' || j.n END FROM j WHERE t.id = j.id;

DROP FUNCTION docket_slugify(TEXT, TEXT);

ALTER TABLE "Space" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "Fixture" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "Job" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Space_householdId_slug_key" ON "Space"("householdId", "slug");
CREATE UNIQUE INDEX "Fixture_householdId_slug_key" ON "Fixture"("householdId", "slug");
CREATE UNIQUE INDEX "Job_householdId_slug_key" ON "Job"("householdId", "slug");
