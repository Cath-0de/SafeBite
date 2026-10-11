// Top-level component: wires up sign-in state and the page routes.
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Profile from './pages/Profile'
import Recipes from './pages/Recipes'
import RecipeDetail from './pages/RecipeDetail'
import Scan from './pages/Scan'

export default function App() {
  return (
    // AuthProvider wraps everything so any page can call useAuth().
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Layout draws the header; the matching page below renders inside it. */}
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="recipes" element={<Recipes />} />
            <Route path="recipes/:id" element={<RecipeDetail />} />
            <Route path="scan" element={<Scan />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
