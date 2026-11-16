/** What a document is filed to, for showing next to it ("Air Con › Outdoor unit · Installation"). */

export const PLACE_SELECT = {
  label: true,
  space: { select: { name: true } },
  fixture: { select: { name: true, parent: { select: { name: true } } } },
  finish: { select: { colourName: true, colourCode: true, product: true, space: { select: { name: true } } } },
  job: { select: { title: true } },
  expense: { select: { description: true, vendor: true, job: { select: { title: true } } } },
} as const

type PlaceLink = {
  label: string | null
  space: { name: string } | null
  fixture: { name: string; parent: { name: string } | null } | null
  finish: { colourName: string | null; colourCode: string | null; product: string | null; space: { name: string } } | null
  job: { title: string } | null
  expense: { description: string | null; vendor: string | null; job: { title: string } | null } | null
}

export function linkPlace(l: PlaceLink) {
  const place = l.fixture
    ? [l.fixture.parent?.name, l.fixture.name].filter(Boolean).join(" › ")
    : l.finish
      ? `${l.finish.space.name} › ${l.finish.colourName ?? l.finish.colourCode ?? l.finish.product ?? "Paint"}`
      : l.job
        ? l.job.title
        : l.expense
          ? [l.expense.job?.title, l.expense.description ?? l.expense.vendor ?? "Cost"].filter(Boolean).join(" › ")
          : l.space?.name
  return [place, l.label].filter(Boolean).join(" · ")
}

/** Every place a document is filed, or "Inbox" when it isn't filed anywhere yet. */
export function docPlaces(links: PlaceLink[]) {
  const where = links.map(linkPlace).filter(Boolean)
  return where.length ? where.join(", ") : "Inbox"
}
