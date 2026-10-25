// The safety verdict for a recipe or product, always as icon + words + colour
// (never colour alone):
//   safe     → ✓ "Safe for you"
//   check    → ⚠ "Check" (+ why, e.g. "no ingredients listed")
//   contains → ⊗ "Contains milk, eggs"
import Icon from './Icon'

export type SafetyStatus = 'safe' | 'check' | 'contains'

export default function SafetyBadge({ status, allergens = [], reason, size = 'md' }: {
  status: SafetyStatus
  allergens?: string[] // allergy labels found, for "contains"
  reason?: string // why it needs checking, for "check"
  size?: 'md' | 'lg' // lg: the big verdict at the top of a recipe or scan result
}) {
  const text =
    status === 'safe'
      ? 'Safe for you'
      : status === 'check'
        ? reason ? `Check: ${reason}` : 'Check'
        : `Contains ${allergens.map((a) => a.toLowerCase()).join(', ')}`
  return (
    <span className={`badge badge-${status}${size === 'lg' ? ' badge-lg' : ''}`}>
      <Icon name={status} size={size === 'lg' ? 26 : 18} />
      {text}
    </span>
  )
}
