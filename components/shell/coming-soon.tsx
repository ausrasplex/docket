import { PageBody, PageHeader } from "./page-header"
import { EmptyState } from "./empty-state"

/** Placeholder page used until each section is built. */
export function ComingSoon({ title, icon, body }: { title: string; icon: React.ReactNode; body: string }) {
  return (
    <>
      <PageHeader title={title} />
      <PageBody>
        <EmptyState icon={icon} title={`${title} Are on the Way`} body={body} />
      </PageBody>
    </>
  )
}
