import { TransferForm } from '@/components/TransferForm'
import { db } from '@/lib/db'
import { LOCATION_TYPES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export default async function NewTransferPage() {
  const [products, own, dest, lots] = await Promise.all([
    db.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, sku: true, unit: true },
      orderBy: { name: 'asc' },
    }),
    db.location.findMany({
      where: { isActive: true, type: LOCATION_TYPES.OWN },
      select: { id: true, name: true },
    }),
    db.location.findMany({
      where: { isActive: true, type: LOCATION_TYPES.FULFILLMENT },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    }),
    db.lot.findMany({
      where: { quantity: { gt: 0 }, location: { type: LOCATION_TYPES.OWN } },
      include: { product: { select: { expiryAlertDays: true } } },
    }),
  ])

  return (
    <TransferForm
      products={products}
      ownLocations={own}
      destinations={dest}
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
