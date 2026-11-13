// A recipe's or product's ingredients. Any ingredient matching one of the
// user's allergies is highlighted and labelled with that allergy's name, and,
// when there's a known swap, crossed out with what to use instead. Ingredients
// that only sometimes contain an allergy ("natural flavors") get an amber "Maybe" label.
// With `advice` (RecipeDetail), flagged ingredients and ones the user marked
// with "Can't eat this?" show the AI's advice: whether it can be left out, and
// what to use instead. Without it, the hand-written swaps in allergens.ts are used.
import { allergensIn, maybeAllergensIn, substituteFor, type Allergies } from '../lib/allergens'
import type { SwapAdvice } from '../lib/ai'
import Button from './Button'
import Icon from './Icon'

// Per ingredient (lowercase name): the advice, still asking, or no answer.
export type AdviceMap = Record<string, SwapAdvice | 'loading' | 'none'>

export default function IngredientList({ ingredients, allergies, advice, onCantEat }: {
  ingredients: { name: string; measure?: string }[]
  allergies: Allergies // the user's profile
  advice?: AdviceMap
  onCantEat?: (name: string) => void // offers "Can't eat this?" on unflagged ingredients
}) {
  return (
    <ul className="ingredient-list">
      {ingredients.map((ing, i) => {
        const matched = allergensIn(allergies, [ing.name])
        const maybe = maybeAllergensIn(allergies, [ing.name])
        const a = advice?.[ing.name.toLowerCase()]
        const ai = typeof a === 'object' ? a : null
        // The user's own "can't eat this" pick counts like a flagged ingredient.
        const picked = !matched.length && a !== undefined
        // The AI's replacement, or the hand-written one if it had none.
        const swap = ai?.replacement || (matched.length ? substituteFor(allergies, ing.name) : null)
        return (
          <li key={i} className={matched.length || picked ? 'flagged' : maybe.length ? 'maybe' : undefined}>
            <span className="name">{swap || ai?.canOmit ? <s>{ing.name}</s> : ing.name}</span>
            {swap && <span className="swap"><span aria-hidden="true">→</span> use {swap}</span>}
            {ai?.canOmit && <span className="swap">{swap ? 'or leave it out' : 'Can leave out'}</span>}
            {ai && !swap && !ai.canOmit && <span className="muted">No good swap: consider another recipe</span>}
            {ai?.note && <span className="advice-note muted">{ai.note}</span>}
            {ai && <span className="advice-tag muted">AI suggestion</span>}
            {a === 'loading' && <span className="muted" role="status">Finding a swap…</span>}
            {a === 'none' && picked && <span className="muted">Couldn't get a suggestion right now</span>}
            {picked && <span className="flag"><Icon name="contains" size={16} />You can't eat this</span>}
            {matched.map((label) => (
              <span key={label} className="flag">
                <Icon name="contains" size={16} />
                {label}
              </span>
            ))}
            {maybe.map((label) => (
              <span key={label} className="flag flag-maybe">
                <Icon name="check" size={16} />
                Maybe {label.toLowerCase()}
              </span>
            ))}
            {onCantEat && !matched.length && !picked && (
              <Button variant="ghost" className="cant-eat" onClick={() => onCantEat(ing.name)}>Can't eat this?</Button>
            )}
            {ing.measure && <span className="measure">{ing.measure}</span>}
          </li>
        )
      })}
    </ul>
  )
}
