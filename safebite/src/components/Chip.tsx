// A rounded label, e.g. one allergy name. With onRemove it gets an × button.
// tone="check" is the amber "maybe / double-check this" style; the caller
// should also say so in words, since colour alone isn't enough.
export default function Chip({ label, onRemove, tone = 'default' }: {
  label: string
  onRemove?: () => void
  tone?: 'default' | 'check'
}) {
  return (
    <span className={`chip chip-${tone}`}>
      {label}
      {onRemove && (
        <button type="button" className="chip-remove" onClick={onRemove} aria-label={`Remove ${label}`}>×</button>
      )}
    </span>
  )
}
