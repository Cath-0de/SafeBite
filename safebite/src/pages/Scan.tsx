// The barcode page (route "/scan"): the user types a barcode number and sees
// the product from Open Food Facts, with the user's allergens flagged. The
// camera button reads the barcode instead of typing it (CameraScanner.tsx).
import { lazy, Suspense, useCallback, useState, type FormEvent } from 'react'
import { lookupBarcode, type Product } from '../api/openFoodFacts'
import { useAuth } from '../context/AuthContext'
import { allergenRegex } from '../lib/allergens'

// Loaded only when the camera is opened, so the barcode reader doesn't slow down other pages.
const CameraScanner = lazy(() => import('../components/CameraScanner'))

export default function Scan() {
  const [barcode, setBarcode] = useState('')
  // The result of the last lookup: a product, "not found", or an error.
  const [product, setProduct] = useState<Product | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Whether the camera view is open.
  const [scanning, setScanning] = useState(false)
  const { profile } = useAuth()
  const re = allergenRegex(profile?.allergens ?? [])
  // One part per ingredient, with the separators kept as their own parts so the text joins back unchanged.
  const parts = product ? product.ingredientsText.split(/([,;()[\]])/) : []
  const flagged = Boolean(re && product && [...parts, ...product.allergens].some((t) => re.test(t)))

  // Clear the previous result, then fetch the product for this barcode.
  const lookup = useCallback(async (code: string) => {
    setBusy(true)
    setError('')
    setNotFound(false)
    setProduct(null)
    try {
      const result = await lookupBarcode(code)
      if (result) setProduct(result)
      else setNotFound(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }, [])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setScanning(false)
    lookup(barcode.trim())
  }

  // The camera found a barcode: show the number in the box and look it up.
  const onDetect = useCallback(
    (code: string) => {
      setScanning(false)
      setBarcode(code)
      lookup(code)
    },
    [lookup],
  )

  return (
    <>
      <h1>Barcode lookup</h1>
      <p className="muted">Scan a product's barcode with your camera, or type the number.</p>
      {scanning ? (
        <Suspense fallback={<p className="muted">Starting camera…</p>}>
          <CameraScanner onDetect={onDetect} onClose={() => setScanning(false)} />
        </Suspense>
      ) : (
        <button className="primary" onClick={() => setScanning(true)}>📷 Scan with camera</button>
      )}
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
