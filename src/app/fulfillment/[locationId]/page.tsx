import { notFound } from 'next/navigation'
import { FulfillmentSheet } from '@/components/FulfillmentSheet'
import { getFulfillmentSheet, reflectedLabel } from '@/lib/inventory'
import { dateOnly, today } from '@/lib/date'

export const dynamic = 'force-dynamic'

export default async function FulfillmentSheetPage({
  params,
}: {
  params: Promise<{ locationId: string }>
}) {
  const { locationId } = await params
  const sheet = await getFulfillmentSheet(Number(locationId))
  if (!sheet) notFound()

  const daysSince = sheet.location.lastReflectedAt
    ? Math.floor((today().getTime() - dateOnly(sheet.location.lastReflectedAt).getTime()) / 86_400_000)
    : null

  return (
    <FulfillmentSheet
      location={{ id: sheet.location.id, name: sheet.location.name }}
      rows={sheet.rows}
      lastReflectedLabel={reflectedLabel(daysSince)}
    />
  )
}
