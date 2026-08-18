import { InboundForm } from '@/components/InboundForm'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/date'
import { LOCATION_TYPES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export default async function InboundPage() {
  const [products, locations, recent, todayCount] = await Promise.all([
    db.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, sku: true, unit: true },
      orderBy: { name: 'asc' },
    }),
    db.location.findMany({
      where: { isActive: true, type: { in: [LOCATION_TYPES.OWN, LOCATION_TYPES.FULFILLMENT] } },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    }),
    db.movement.findMany({
      where: { type: 'INBOUND' },
      select: { expiryDate: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    db.movement.count({
      where: { type: 'INBOUND', createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
  ])

  const recentExpiries = [...new Set(recent.map((r) => formatDate(r.expiryDate)))].slice(0, 3)

  return (
    <InboundForm
      products={products}
      locations={locations}
      recentExpiries={recentExpiries}
      todayCount={todayCount}
    />
  )
}
