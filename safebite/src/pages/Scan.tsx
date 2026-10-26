// The barcode page (route "/scan"): the user types a barcode number and sees
// the product with the user's allergens flagged. The camera button reads the
// barcode instead of typing it (CameraScanner.tsx).
// Where the ingredients come from, best first: Open Food Facts, then USDA
// FoodData Central (api/usda.ts), then a product a user added
// (products/{barcode}), then Open Food Facts' entry without ingredients.
// If none has ingredients, the user can add them, or ask the AI to search the
// web (lib/ai.ts); that result is labelled as possibly wrong and never "safe".
import { lazy, Suspense, useCallback, useRef, useState, type FormEvent } from 'react'
import { lookupBarcode, type Product } from '../api/openFoodFacts'
import { lookupUsda } from '../api/usda'
import { useAuth } from '../context/AuthContext'
import { aiConfigured, findProductOnline, type WebProduct } from '../lib/ai'
import { getUserProduct, hasOpenReport, reportProduct, saveUserProduct } from '../lib/db'
import { firebaseConfigured } from '../lib/firebase'
import { allergenRegex, allergensIn } from '../lib/allergens'
import Button from '../components/Button'
import Card from '../components/Card'
import Chip from '../components/Chip'
import UnverifiedTag from '../components/UnverifiedTag'
import SafetyBadge, { type SafetyStatus } from '../components/SafetyBadge'

// Loaded only when the camera is opened, so the barcode reader doesn't slow down other pages.
const CameraScanner = lazy(() => import('../components/CameraScanner'))

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
  const [web, setWeb] = useState<Pick<WebProduct, 'sources'> | null>(null)
  const [webBusy, setWebBusy] = useState(false)
  const [webMissed, setWebMissed] = useState(false)
  // Where the shown product's details came from, for the "Source:" line.
  const [source, setSource] = useState('')
  // Who added the shown product, when it came from products/{barcode}.
  const [addedBy, setAddedBy] = useState<string | null>(null)
  // The product form, prefilled from whatever was found: adding a missing product,
  // editing one this user typed in, or reporting a saved one as wrong.
  const [form, setForm] = useState<{ mode: 'add' | 'edit' | 'report'; name: string; brand: string; ingredientsText: string; reason: string } | null>(null)
  const [saving, setSaving] = useState(false)
  // The shown product is an AI result saved by an earlier search: shown as plain
  // food data with a "Not verified" tag (no AI notes or links).
  const [storedAi, setStoredAi] = useState(false)
  // Whether the shown saved product has a report waiting for review.
  const [reported, setReported] = useState(false)
  // The barcode of the newest lookup, so a slow report check for an older one is ignored.
  const latestCode = useRef('')
  // Whether the camera view is open.
  const [scanning, setScanning] = useState(false)
  const { user, profile } = useAuth()
  const myAllergens = profile?.allergens ?? []
  const re = allergenRegex(myAllergens)
  // One part per ingredient, with the separators kept as their own parts so the text joins back unchanged.
  const parts = product ? product.ingredientsText.split(/([,;()[\]])/) : []
  const found = product ? allergensIn(myAllergens, [...parts, ...product.allergens]) : []
  const addedByOther = Boolean(addedBy && addedBy !== user?.uid)
  // Shown from products/{barcode}, or a fresh AI result: these can be reported.
  // Nothing listed, only what the AI found online, or someone else's typing means we can't be sure: ask the user to check the packet.
  const status: SafetyStatus = found.length
    ? 'contains'
    : reported || web || storedAi || addedByOther || (product && !product.ingredientsText && !product.allergens.length) ? 'check' : 'safe'
  const checkReason = reported ? 'reported as wrong'
    : web ? 'found online, could be wrong'
    : storedAi ? 'not verified'
    : addedByOther ? 'added by another user' : 'no ingredients listed'
  const missing = notFound || Boolean(product && !product.ingredientsText)
  const canSearchWeb = aiConfigured && !web && !webMissed && missing
  // Which form the button opens: add what's missing, edit your own entry, or report a saved one.
  const formMode = notFound || (product && !product.ingredientsText) ? 'add'
    : addedBy && !addedByOther ? 'edit'
    : web || storedAi || addedByOther ? 'report' : null
  const formButton = notFound ? 'Add this product'
    : formMode === 'add' ? 'Add the ingredients list'
    : formMode === 'edit' ? 'Edit this product'
    : 'Report this if wrong'

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
    setSource('')
    setReported(false)
    setStoredAi(false)
    latestCode.current = code
    const digits = /^\d{6,14}$/.test(code)
    try {
      // If any one source fails (e.g. Open Food Facts is down), carry on with the
      // rest, so the user still gets a result or the "Add this product" button.
      // Users' additions need sign-in to read.
      let offFailed = false
      const [off, usda, added] = await Promise.all([
        lookupBarcode(code).catch((err) => {
          console.error('Could not check Open Food Facts', err)
          offFailed = true
          return null
        }),
        digits
          ? lookupUsda(code).catch((err) => {
              console.error('Could not check USDA', err)
              return null
            })
          : null,
        user && digits
          ? getUserProduct(code).catch((err) => {
              console.error('Could not check user-added products', err)
              return null
            })
          : null,
      ])
      const allergens = off?.allergens ?? []
      if (off?.ingredientsText) {
        setProduct(off)
        setSource('Open Food Facts')
      } else if (usda) {
        setProduct({ barcode: code, ...usda, allergens })
        setSource('USDA FoodData Central')
      } else if (added) {
        setProduct({ barcode: code, name: added.name, brand: added.brand, ingredientsText: added.ingredientsText, allergens })
        // A stored AI result shows like a fresh one; a person's version shows who added it.
        if (added.source === 'ai') setStoredAi(true)
        else setAddedBy(added.addedBy)
        hasOpenReport(code)
          .then((open) => {
            if (latestCode.current === code) setReported(open)
          })
          .catch((err) => console.error('Could not check reports', err))
      } else if (off) {
        setProduct(off)
        setSource('Open Food Facts')
      } else {
        setNotFound(true)
        if (offFailed) setError("Open Food Facts couldn't be reached, so it may have this product. Try again later, or add it below.")
      }
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
      if (form.mode === 'report') {
        // The product stays as it is until someone reviews the report.
        await reportProduct(user.uid, code, form.reason.trim(), entry)
        setReported(true)
        setForm(null)
        return
      }
      await saveUserProduct(user.uid, code, { ...entry, source: 'user' })
      setProduct({ barcode: code, ...entry, allergens: product?.allergens ?? [] })
      setAddedBy(user.uid)
      setSource('')
      setNotFound(false)
      setWeb(null)
      setForm(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this product')
    } finally {
      setSaving(false)
    }
  }

  // Ask the AI (which searches the web) for this product's ingredients.
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
      setSource('')
      setWeb({ sources: result.sources })
      // Keep the result so the next scan of this barcode (by anyone) doesn't search again.
      if (user) {
        saveUserProduct(user.uid, code, { name: result.name, brand: result.brand, ingredientsText: result.ingredientsText, sources: result.sources, source: 'ai' })
          .catch((err) => console.error('Could not store the AI result', err))
      }
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
      {firebaseConfigured && formMode && !form && (
        user ? (
          <div className="row">
            <Button
              onClick={() =>
                setForm({ mode: formMode, name: product?.name ?? '', brand: product?.brand ?? '', ingredientsText: product?.ingredientsText ?? '', reason: '' })
              }
            >
              {formButton}
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
            <h2>{form.mode === 'report' ? 'Report a problem' : form.mode === 'edit' ? 'Edit your product' : notFound ? 'Add this product' : 'Add the ingredients'}</h2>
            <p className="muted">
              Barcode {code}. Copy the details from the packet.
              {form.mode === 'report' && ' Your correction is sent for review; the product stays as it is until then.'}
            </p>
            {form.mode === 'report' && (
              <label>
                <span>What's wrong? <span className="muted">(optional)</span></span>
                <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={1000} rows={2} placeholder="e.g. Wrong product, or it's missing milk" />
              </label>
            )}
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
                {saving ? 'Sending…' : form.mode === 'report' ? 'Send for review' : form.mode === 'edit' ? 'Save changes' : 'Save product'}
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
          {storedAi && <Chip label="Not verified" tone="check" />}
          {reported && <p className="warning-box" role="status">Someone reported this as wrong and it's being reviewed. Check the packet before eating.</p>}
          {addedBy && <UnverifiedTag mine={!addedByOther} />}
          <h2>{product.name}</h2>
          {product.brand && <p className="muted">{product.brand}</p>}
          {source && <p className="muted">Source: {source}</p>}
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
            </>
          )}
        </Card>
      )}
    </>
  )
}
