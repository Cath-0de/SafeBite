// Packaged-food data from Open Food Facts (free, no API key), looked up by barcode.

// A product in the shape the rest of the app uses.
export interface Product {
  barcode: string
  name: string
  brand: string
  ingredientsText: string
  allergens: string[]
}

// Looks up one barcode. Returns null if Open Food Facts has no such product,
// and throws if the request itself fails.
export async function lookupBarcode(barcode: string): Promise<Product | null> {
  // Ask only for the fields we use, to keep the response small.
  const fields = 'product_name,brands,ingredients_text,allergens_tags'
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`,
  )
  // Unknown barcodes come back as 404, which just means "no such product".
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Open Food Facts request failed (${res.status})`)
  const data = await res.json()
  // status 1 means the product was found.
  if (data.status !== 1) return null
  const p = data.product
  return {
    barcode,
    name: p.product_name ?? 'Unknown product',
    brand: p.brands ?? '',
    ingredientsText: p.ingredients_text ?? '',
    // Tags arrive as "en:milk"; strip the language prefix. These are Open Food
    // Facts' own names, not yet mapped to the ids in lib/allergens.ts.
    allergens: ((p.allergens_tags ?? []) as string[]).map((t) => t.replace(/^en:/, '')),
  }
}
