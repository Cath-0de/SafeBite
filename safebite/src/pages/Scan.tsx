// The barcode page (route "/scan"): the user types a barcode number and sees
// the product from Open Food Facts, with the user's allergens flagged. The
// camera button reads the barcode instead of typing it (CameraScanner.tsx).
// If Open Food Facts doesn't know the barcode or has no ingredients for it,
// the user can ask Gemini to search the web (lib/ai.ts); that result is
// labelled as possibly wrong and never shown as "safe". Signed-in users can
// also add a missing product or its ingredients themselves (products/{barcode}),
// which later lookups use when Open Food Facts has no ingredients.
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { lookupBarcode, type Product } from '../api/openFoodFacts'
import { useAuth } from '../context/AuthContext'
import { findProductOnline, type WebProduct } from '../lib/ai'
import { getUserProduct, saveUserProduct } from '../lib/db'
import { firebaseConfigured } from '../lib/firebase'
import { allergenRegex, allergensIn } from '../lib/allergens'
import Button from '../components/Button'
import Card from '../components/Card'
import Chip from '../components/Chip'
import UnverifiedTag from '../components/UnverifiedTag'
import SafetyBadge, { type SafetyStatus } from '../components/SafetyBadge'

// Loaded only when the camera is opened, so the barcode reader doesn't slow down other pages.
const CameraScanner = lazy(() => import('../components/CameraScanner'))

// Google requires its "search suggestions" chip to be shown with search-grounded answers, as given, in a shadow root.
function SearchSuggestions({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) (el.shadowRoot ?? el.attachShadow({ mode: 'open' })).innerHTML = html
  }, [html])
  return <div ref={ref} className="search-suggestions" />
}

export default function Scan() {
  const [barcode, setBarcode] = useState('')
  // The result of the last lookup: a product, "not found", or an error.
  const [product, setProduct] = useState<Product | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // The barcode the current result is for (the box may have been edited since).
  const [code, setCode] = useState('')
  // Set when the shown product came from the AI web search rather than Open Food Facts.
  const [web, setWeb] = useState<Pick<WebProduct, 'sources' | 'searchSuggestions'> | null>(null)
  const [webBusy, setWebBusy] = useState(false)
  const [webMissed, setWebMissed] = useState(false)
  // Who added the shown product, when it came from products/{barcode}.
  const [addedBy, setAddedBy] = useState<string | null>(null)
  // The "add this product" form, prefilled from whatever was found.
  const [form, setForm] = useState<{ name: string; brand: string; ingredientsText: string } | null>(null)
  const [saving, setSaving] = useState(false)
  // Whether the camera view is open.
  const [scanning, setScanning] = useState(false)
  const { user, profile } = useAuth()
  const myAllergens = profile?.allergens ?? []
  const re = allergenRegex(myAllergens)
  // One part per ingredient, with the separators kept as their own parts so the text joins back unchanged.
  const parts = product ? product.ingredientsText.split(/([,;()[\]])/) : []
  const found = product ? allergensIn(myAllergens, [...parts, ...product.allergens]) : []
  const addedByOther = Boolean(addedBy && addedBy !== user?.uid)
  // Nothing listed, only what the AI found online, or someone else's typing means we can't be sure: ask the user to check the packet.
  const status: SafetyStatus = found.length
    ? 'contains'
    : web || addedByOther || (product && !product.ingredientsText && !product.allergens.length) ? 'check' : 'safe'
  const checkReason = web ? 'found online, could be wrong' : addedByOther ? 'added by another user' : 'no ingredients listed'
  const missing = notFound || Boolean(product && !product.ingredientsText)
  const canSearchWeb = firebaseConfigured && !web && !webMissed && missing
  // Offer the form for a missing product or ingredients, to save a checked AI result, or to fix one this user added.
  const addLabel = notFound ? 'Add this product'
    : product && !product.ingredientsText ? 'Add the ingredients list'
    : web ? 'Save it after checking the packet'
    : addedBy && addedBy === user?.uid ? 'Edit this product' : ''

  // Clear the previous result, then fetch the product for this barcode.
  const lookup = useCallback(async (code: string) => {
    setBusy(true)
    setError('')
    setNotFound(false)
    setProduct(null)
    setCode(code)
    setWeb(null)
    setWebMissed(false)
    setAddedBy(null)
    setForm(null)
    try {
      // Users' own additions need sign-in to read; without it, just use Open Food Facts.
      const [off, added] = await Promise.all([
        lookupBarcode(code),
        user && /^\d{6,14}$/.test(code)
          ? getUserProduct(code).catch((err) => {
              console.error('Could not check user-added products', err)
              return null
            })
          : null,
      ])
      // Open Food Facts wins when it has ingredients; a user's addition fills the gap otherwise.
      if (added && !off?.ingredientsText) {
        setProduct({ barcode: code, name: added.name, brand: added.brand, ingredientsText: added.ingredientsText, allergens: off?.allergens ?? [] })
        setAddedBy(added.addedBy)
      } else if (off) setProduct(off)
      else setNotFound(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }, [user])

  async function saveProduct(e: FormEvent) {
    e.preventDefault()
    if (!user || !form) return
    if (!/^\d{6,14}$/.test(code)) {
      setError('Only barcode numbers (6 to 14 digits) can be added.')
      return
    }
    const entry = { name: form.name.trim(), brand: form.brand.trim(), ingredientsText: form.ingredientsText.trim() }
    setSaving(true)
    setError('')
    try {
      await saveUserProduct(user.uid, code, entry)
      setProduct({ barcode: code, ...entry, allergens: product?.allergens ?? [] })
      setAddedBy(user.uid)
      setNotFound(false)
      setWeb(null)
      setForm(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this product')
    } finally {
      setSaving(false)
    }
  }

  // Ask Gemini (with Google Search) for this product's ingredients.
  async function searchWeb() {
    setWebBusy(true)
    setError('')
    try {
      const result = await findProductOnline(code, product ? { name: product.name, brand: product.brand } : undefined)
      if (!result) {
        setWebMissed(true)
        return
      }
      setProduct({ barcode: code, name: result.name, brand: result.brand, ingredientsText: result.ingredientsText, allergens: product?.allergens ?? [] })
      setNotFound(false)
      setWeb({ sources: result.sources, searchSuggestions: result.searchSuggestions })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The web search failed')
    } finally {
      setWebBusy(false)
    }
  }

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
        <Button variant="primary" onClick={() => setScanning(true)}>📷 Scan with camera</Button>
      )}
      <form className="search" onSubmit={onSubmit}>
        <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="e.g. 3017620422003" inputMode="numeric" />
        <Button type="submit" variant="primary" disabled={busy || !barcode.trim()}>{busy ? 'Looking up…' : 'Look up'}</Button>
      </form>
      {error && <p className="error">{error}</p>}
      {notFound && <p className="muted">No product found for that barcode.</p>}
      {canSearchWeb && (
        <div className="row">
          <Button onClick={searchWeb} disabled={webBusy}>{webBusy ? 'Searching the web…' : 'Search the web with AI'}</Button>
          <span className="muted">Finds the ingredients online. It can be wrong, so check the packet.</span>
        </div>
      )}
      {webMissed && <p className="muted">The web search couldn't find this product's ingredients either. Check the packet.</p>}
      {firebaseConfigured && addLabel && !form && (
        user ? (
          <div className="row">
            <Button onClick={() => setForm({ name: product?.name ?? '', brand: product?.brand ?? '', ingredientsText: product?.ingredientsText ?? '' })}>
              {addLabel}
            </Button>
            {missing && <span className="muted">Type it from the packet so it's here next time, for you and others.</span>}
          </div>
        ) : (
          missing && <p className="muted">Sign in to add this product's ingredients yourself.</p>
        )
      )}
      {form && (
        <Card>
          <form className="stack" onSubmit={saveProduct}>
            <h2>{notFound ? 'Add this product' : 'Product details'}</h2>
            <p className="muted">Barcode {code}. Copy the details from the packet.</p>
            <label>
              Product name
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={300} required />
            </label>
            <label>
              <span>Brand <span className="muted">(optional)</span></span>
              <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} maxLength={200} />
            </label>
            <label>
              Ingredients, as printed on the packet
              <textarea
                value={form.ingredientsText}
                onChange={(e) => setForm({ ...form, ingredientsText: e.target.value })}
                placeholder="e.g. Sugar, palm oil, hazelnuts (13%), skimmed milk powder"
                maxLength={5000}
                rows={5}
                required
              />
            </label>
            <div className="row">
              <Button type="submit" variant="primary" disabled={saving || !form.name.trim() || !form.ingredientsText.trim()}>
                {saving ? 'Saving…' : 'Save product'}
              </Button>
              <Button onClick={() => setForm(null)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}
      {/* The product card: name, brand, the safety verdict (only when the user
      has allergies to check), listed allergens and ingredients, with the
      user's allergens highlighted in the ingredients. */}
      {product && (
        <Card>
          {web && <Chip label="Found online by AI · could be wrong" tone="check" />}
          {addedBy && <UnverifiedTag mine={!addedByOther} />}
          <h2>{product.name}</h2>
          {product.brand && <p className="muted">{product.brand}</p>}
          {myAllergens.length > 0 && (
            <SafetyBadge status={status} allergens={found} reason={status === 'check' ? checkReason : undefined} size="lg" />
          )}
          <p><strong>Allergens:</strong> {product.allergens.length ? product.allergens.join(', ') : 'none listed'}</p>
          <p className="ingredients">
            {!product.ingredientsText
              ? 'No ingredients listed.'
              : re
                ? parts.map((part, i) => (re.test(part) ? <mark key={i}>{part}</mark> : part))
                : product.ingredientsText}
          </p>
          {web && (
            <>
              <p className="muted">
                This is what we found on the web. It may be for a different product or an old recipe, so check the packet before eating.
              </p>
              {web.sources.length > 0 && (
                <p className="muted">
                  Sources:{' '}
                  {web.sources.map((src, i) => (
                    <span key={src.uri}>
                      {i > 0 && ', '}
                      <a href={src.uri} target="_blank" rel="noreferrer">{src.title}</a>
                    </span>
                  ))}
                </p>
              )}
              {web.searchSuggestions && <SearchSuggestions html={web.searchSuggestions} />}
            </>
          )}
        </Card>
      )}
    </>
  )
}
