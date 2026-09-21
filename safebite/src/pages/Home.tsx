import { Link } from 'react-router-dom'

const features = [
  { to: '/recipes', title: 'Recipe discovery', text: 'Find meals and see which ingredients might be a problem for you.' },
  { to: '/scan', title: 'Barcode lookup', text: 'Check packaged foods for ingredients and allergens.' },
]

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>Eat with confidence.</h1>
        <p>
          SafeBite helps you find recipes, swap out ingredients that don't agree with you,
          and track which foods trigger symptoms.
        </p>
        <div className="actions">
          <Link to="/recipes" className="button primary">Browse recipes</Link>
          <Link to="/scan" className="button">Scan a product</Link>
        </div>
      </section>
      <section className="cards">
        {features.map((f) => (
          <Link key={f.to} to={f.to} className="card">
            <h2>{f.title}</h2>
            <p>{f.text}</p>
          </Link>
        ))}
      </section>
    </>
  )
}
