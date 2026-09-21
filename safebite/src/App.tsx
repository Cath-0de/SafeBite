import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Recipes from './pages/Recipes'
import Scan from './pages/Scan'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="recipes" element={<Recipes />} />
            <Route path="scan" element={<Scan />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
