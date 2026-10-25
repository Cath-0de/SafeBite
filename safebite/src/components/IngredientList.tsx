// A recipe's or product's ingredients. Any ingredient matching one of the
// user's allergies is highlighted and labelled with that allergy's name, and,
// when there's a known swap, crossed out with what to use instead.
import { allergensIn, substituteFor } from '../lib/allergens'
import Icon from './Icon'

export default function IngredientList({ ingredients, allergenIds }: {
  ingredients: { name: string; measure?: string }[]
  allergenIds: string[] // the user's allergies (profile.allergens)
}) {
  return (
    <ul className="ingredient-list">
      {ingredients.map((ing, i) => {
        const matched = allergensIn(allergenIds, [ing.name])
        const swap = matched.length ? substituteFor(allergenIds, ing.name) : null
        return (
          <li key={i} className={matched.length ? 'flagged' : undefined}>
            <span className="name">{swap ? <s>{ing.name}</s> : ing.name}</span>
            {swap && <span className="swap"><span aria-hidden="true">→</span> use {swap}</span>}
            {matched.map((label) => (
              <span key={label} className="flag">
                <Icon name="contains" size={16} />
                {label}
              </span>
            ))}
            {ing.measure && <span className="measure">{ing.measure}</span>}
          </li>
        )
      })}
    </ul>
  )
}
