import { useState, type FormEvent } from 'react'
import { lookupBarcode, type Product } from '../api/openFoodFacts'

export default function Scan() {
  const [barcode, setBarcode] = useState('')
  const [product, setProduct] = useState<Product | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
      <p className="muted">Enter a barcode number. Camera scanning comes later.</p>
      <form className="search" onSubmit={onSubmit}>
        <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="e.g. 3017620422003" inputMode="numeric" />
        <button className="primary" disabled={busy || !barcode.trim()}>{busy ? 'Looking up…' : 'Look up'}</button>
      </form>
      {error && <p className="error">{error}</p>}
      {notFound && <p className="muted">No product found for that barcode.</p>}
      {product && (
        <article className="card">
          <h2>{product.name}</h2>
          {product.brand && <p className="muted">{product.brand}</p>}
          <p><strong>Allergens:</strong> {product.allergens.length ? product.allergens.join(', ') : 'none listed'}</p>
          <p className="ingredients">{product.ingredientsText || 'No ingredients listed.'}</p>
        </article>
      )}
    </>
  )
}
