export interface Product {
  barcode: string
  name: string
  brand: string
  ingredientsText: string
  allergens: string[]
}

export async function lookupBarcode(barcode: string): Promise<Product | null> {
  const fields = 'product_name,brands,ingredients_text,allergens_tags'
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`,
  )
  if (!res.ok) throw new Error(`Open Food Facts request failed (${res.status})`)
  const data = await res.json()
  if (data.status !== 1) return null
  const p = data.product
  return {
    barcode,
    name: p.product_name ?? 'Unknown product',
    brand: p.brands ?? '',
    ingredientsText: p.ingredients_text ?? '',
    allergens: ((p.allergens_tags ?? []) as string[]).map((t) => t.replace(/^en:/, '')),
  }
}
