import { PopupCreateForm } from '@/components/PopupCreateForm'
import { db } from '@/lib/db'
import { LOCATION_TYPES } from '@/lib/constants'
import { formatDate, today } from '@/lib/date'

export const dynamic = 'force-dynamic'

export default async function NewPopupPage() {
  const [products, sources] = await Promise.all([
    db.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, sku: true, unit: true },
      orderBy: { name: 'asc' },
    }),
    db.location.findMany({
      where: { isActive: true, type: LOCATION_TYPES.OWN },
      select: { id: true, name: true },
    }),
  ])

  return <PopupCreateForm products={products} sources={sources} today={formatDate(today())} />
}
