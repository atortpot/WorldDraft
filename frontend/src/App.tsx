import { Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { AuthProvider } from './context/AuthContext'
import { DraftProvider } from './context/DraftContext'
import { ChampionPage } from './pages/ChampionPage'
import { DraftPage } from './pages/DraftPage'
import { EliminatedPage } from './pages/EliminatedPage'
import { FormationPage } from './pages/FormationPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { TournamentPage } from './pages/TournamentPage'
import { TournamentSummaryPage } from './pages/TournamentSummaryPage'

function App() {
  return (
    <AuthProvider>
      <DraftProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
          <Route path="/formation" element={<RequireAuth><FormationPage /></RequireAuth>} />
          <Route path="/draft" element={<RequireAuth><DraftPage /></RequireAuth>} />
          <Route path="/tournament" element={<RequireAuth><TournamentPage /></RequireAuth>} />
          <Route
            path="/tournament/champion"
            element={<RequireAuth><ChampionPage /></RequireAuth>}
          />
          <Route
            path="/tournament/eliminated"
            element={<RequireAuth><EliminatedPage /></RequireAuth>}
          />
          <Route
            path="/tournament/summary"
            element={<RequireAuth><TournamentSummaryPage /></RequireAuth>}
          />
        </Routes>
      </DraftProvider>
    </AuthProvider>
  )
}

export default App
