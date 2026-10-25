// A page showing the design tokens and shared components (route "/design",
// not in the tab bar). For checking the look in light and dark mode while the
// screens are being redesigned; delete it and its route when no longer useful.
import Button from '../components/Button'
import Card from '../components/Card'
import Chip from '../components/Chip'
import IngredientList from '../components/IngredientList'
import SafetyBadge from '../components/SafetyBadge'

const TOKENS = ['primary', 'bg', 'surface', 'panel', 'accent', 'muted', 'safe', 'check', 'contains']

export default function DesignPreview() {
  return (
    <>
      <h1>Design preview</h1>
      <p className="muted">Switch light/dark on the Profile page to compare.</p>

      <h2>Colours</h2>
      <div className="swatch-grid">
        {TOKENS.map((t) => (
          <div key={t}>
            <span style={{ background: `var(--${t})` }} />
            <p>--{t}</p>
          </div>
        ))}
      </div>

      <h2>Buttons</h2>
      <div className="row">
        <Button variant="primary">Primary</Button>
        <Button>Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="primary" size="lg">Large (flare / low energy)</Button>
        <Button disabled>Disabled</Button>
      </div>

      <h2>Safety badges</h2>
      <div className="row">
        <SafetyBadge status="safe" />
        <SafetyBadge status="check" reason="no ingredients listed" />
        <SafetyBadge status="contains" allergens={['Dairy', 'Eggs']} />
      </div>
      <div className="row">
        <SafetyBadge status="contains" allergens={['Dairy']} size="lg" />
      </div>

      <h2>Chips</h2>
      <div className="row">
        <Chip label="Dairy" />
        <Chip label="kiwi" onRemove={() => {}} />
        <Chip label="Maybe: whey" tone="check" />
      </div>

      <h2>Card with ingredient list</h2>
      <Card>
        <IngredientList
          allergenIds={['dairy', 'egg']}
          ingredients={[
            { name: 'Spaghetti', measure: '200g' },
            { name: 'Butter', measure: '2 tbsp' },
            { name: 'Garlic', measure: '2 cloves' },
            { name: 'Egg yolks', measure: '3' },
          ]}
        />
      </Card>

      <h2>Panel</h2>
      <div className="panel">
        <p>A soft sage panel for gentle grouping, e.g. today's flare and energy settings.</p>
      </div>
    </>
  )
}
