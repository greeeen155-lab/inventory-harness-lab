import { OutboundForm } from '@/components/OutboundForm'
import { db } from '@/lib/db'
import { LOCATION_TYPES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export default async function OutboundPage() {
  const [products, locations, lots] = await Promise.all([
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
    db.lot.findMany({
      where: { quantity: { gt: 0 }, location: { type: { in: [LOCATION_TYPES.OWN, LOCATION_TYPES.FULFILLMENT] } } },
      include: { product: { select: { expiryAlertDays: true } } },
    }),
  ])

  return (
    <OutboundForm
      products={products}
      locations={locations}
      lots={lots.map((l) => ({
        id: l.id,
        productId: l.productId,
        locationId: l.locationId,
        expiry: l.expiryDate.toISOString(),
        quantity: l.quantity,
        alertDays: l.product.expiryAlertDays,
      }))}
    />
  )
}
