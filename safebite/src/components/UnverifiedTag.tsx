// The tag on anything users added to the database rather than a trusted source
// (their recipes, products from the Scan page): "Not verified", and by whom.
import Chip from './Chip'

export default function UnverifiedTag({ mine }: { mine: boolean }) {
  return <Chip label={`Not verified · added by ${mine ? 'you' : 'a SafeBite user'}`} tone="check" />
}
