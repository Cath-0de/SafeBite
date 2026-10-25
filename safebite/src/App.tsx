// Top-level component: wires up sign-in state and the page routes.
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Profile from './pages/Profile'
import Recipes from './pages/Recipes'
import RecipeDetail from './pages/RecipeDetail'
import RecipeForm from './pages/RecipeForm'
import Scan from './pages/Scan'
import Log from './pages/Log'
import DesignPreview from './pages/DesignPreview'

export default function App() {
  return (
    // AuthProvider wraps everything so any page can call useAuth().
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Layout draws the sidebar / tab bar; the matching page below renders inside it. */}
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="recipes" element={<Recipes />} />
            <Route path="recipes/new" element={<RecipeForm />} />
            <Route path="recipes/:id" element={<RecipeDetail />} />
            <Route path="recipes/:id/edit" element={<RecipeForm />} />
            <Route path="scan" element={<Scan />} />
            <Route path="log" element={<Log />} />
            <Route path="profile" element={<Profile />} />
            <Route path="design" element={<DesignPreview />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
