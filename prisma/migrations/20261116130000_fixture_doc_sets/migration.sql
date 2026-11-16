-- Document sets: copies of the same product share their manuals, warranties and links (lib/doc-sets.ts).
ALTER TABLE "Fixture" ADD COLUMN "docSetId" TEXT;
CREATE INDEX "Fixture_docSetId_idx" ON "Fixture"("docSetId");

-- Copies made before sets existed: items in the same household and property with the same name, brand and
-- model (ignoring case and spaces at the ends) form a set, named after its oldest member.
WITH g AS (
  SELECT id,
         first_value(id) OVER (
           PARTITION BY "householdId", "propertyId", lower(trim(name)), coalesce("brandId", ''), lower(trim(coalesce(model, '')))
           ORDER BY "createdAt", id
         ) AS set_id,
         count(*) OVER (
           PARTITION BY "householdId", "propertyId", lower(trim(name)), coalesce("brandId", ''), lower(trim(coalesce(model, '')))
         ) AS n
  FROM "Fixture"
  WHERE "parentId" IS NULL AND "archivedAt" IS NULL
)
UPDATE "Fixture" f SET "docSetId" = g.set_id FROM g WHERE f.id = g.id AND g.n > 1;

-- Their parts pair up by name: the outdoor unit of each copy shares with the other outdoor units.
WITH g AS (
  SELECT p.id,
         first_value(p.id) OVER (PARTITION BY parent."docSetId", lower(trim(p.name)) ORDER BY p."createdAt", p.id) AS set_id,
         count(*) OVER (PARTITION BY parent."docSetId", lower(trim(p.name))) AS n
  FROM "Fixture" p
  JOIN "Fixture" parent ON parent.id = p."parentId"
  WHERE parent."docSetId" IS NOT NULL AND p."archivedAt" IS NULL
)
UPDATE "Fixture" f SET "docSetId" = g.set_id FROM g WHERE f.id = g.id AND g.n > 1;

-- Each member gets the set's shared documents it doesn't already have (receipts, invoices and photos stay put).
INSERT INTO "DocumentLink" ("id", "documentId", "fixtureId", "label", "sortOrder", "createdAt")
SELECT 'ds' || md5(src."documentId" || ':' || m.id), src."documentId", m.id, src.label, src."sortOrder", now()
FROM (
  SELECT DISTINCT ON (f."docSetId", l."documentId") f."docSetId", l."documentId", l.label, l."sortOrder"
  FROM "DocumentLink" l
  JOIN "Fixture" f ON f.id = l."fixtureId"
  JOIN "Document" d ON d.id = l."documentId"
  WHERE f."docSetId" IS NOT NULL AND d.kind NOT IN ('RECEIPT', 'INVOICE', 'PHOTO')
  ORDER BY f."docSetId", l."documentId", l."createdAt"
) src
JOIN "Fixture" m ON m."docSetId" = src."docSetId"
WHERE NOT EXISTS (SELECT 1 FROM "DocumentLink" x WHERE x."documentId" = src."documentId" AND x."fixtureId" = m.id);
