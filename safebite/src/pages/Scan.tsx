// The barcode page (route "/scan"): the user types a barcode number and sees
// the product from Open Food Facts, with the user's allergens flagged.
// No camera scanning yet.
import { useState, type FormEvent } from 'react'
import { lookupBarcode, type Product } from '../api/openFoodFacts'
import { useAuth } from '../context/AuthContext'
import { allergenRegex } from '../lib/allergens'

export default function Scan() {
  const [barcode, setBarcode] = useState('')
  // The result of the last lookup: a product, "not found", or an error.
  const [product, setProduct] = useState<Product | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { profile } = useAuth()
  const re = allergenRegex(profile?.allergens ?? [])
  // One part per ingredient, with the separators kept as their own parts so the text joins back unchanged.
  const parts = product ? product.ingredientsText.split(/([,;()[\]])/) : []
  const flagged = Boolean(re && product && [...parts, ...product.allergens].some((t) => re.test(t)))

  // Lookup submit: clear the previous result, then fetch the new barcode.
  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotFound(false)
    setProduct(null)
    try {
      const result = await lookupBarcode(barcode.trim())
      if (result) setProduct(result)
      else setNotFound(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h1>Barcode lookup</h1>
      <p className="muted">Enter a barcode number. Camera scanning soon.</p>
      <form className="search" onSubmit={onSubmit}>
        <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="e.g. 3017620422003" inputMode="numeric" />
        <button className="primary" disabled={busy || !barcode.trim()}>{busy ? 'Looking up…' : 'Look up'}</button>
      </form>
      {error && <p className="error">{error}</p>}
      {notFound && <p className="muted">No product found for that barcode.</p>}
      {/* The product card: name, brand, listed allergens and ingredients, with
      the user's allergens flagged by ⚠️ and bolded in the ingredients. */}
      {product && (
        <article className="card">
          <h2>
            {flagged && <span role="img" aria-label="Contains your allergens" title="Contains your allergens">⚠️ </span>}
            {product.name}
          </h2>
          {product.brand && <p className="muted">{product.brand}</p>}
          <p><strong>Allergens:</strong> {product.allergens.length ? product.allergens.join(', ') : 'none listed'}</p>
          <p className="ingredients">
            {!product.ingredientsText
              ? 'No ingredients listed.'
              : re
                ? parts.map((part, i) => (re.test(part) ? <strong key={i}>{part}</strong> : part))
                : product.ingredientsText}
          </p>
        </article>
      )}
    </>
  )
}
