// Packaged-food data from USDA FoodData Central (mostly US products), looked up
// by barcode through SafeBite's Cloudflare Worker (api/worker.ts), which holds the API key.
import { callWorker, workerConfigured } from './worker'

// Returns null if USDA has no product with exactly this barcode (or the worker
// isn't configured); throws if the request itself fails.
export async function lookupUsda(barcode: string): Promise<{ name: string; brand: string; ingredientsText: string } | null> {
  if (!workerConfigured) return null
  const { product } = await callWorker<{ product: { name: string; brand: string; ingredientsText: string } | null }>(
    `/usda?barcode=${encodeURIComponent(barcode)}`,
  )
  return product
}
