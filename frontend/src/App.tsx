import { Route, Routes } from 'react-router-dom'
import { DraftProvider } from './context/DraftContext'
import { ChampionPage } from './pages/ChampionPage'
import { DraftPage } from './pages/DraftPage'
import { EliminatedPage } from './pages/EliminatedPage'
import { FormationPage } from './pages/FormationPage'
import { HomePage } from './pages/HomePage'
import { TournamentPage } from './pages/TournamentPage'

function App() {
  return (
    <DraftProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/formation" element={<FormationPage />} />
        <Route path="/draft" element={<DraftPage />} />
        <Route path="/tournament" element={<TournamentPage />} />
        <Route path="/tournament/champion" element={<ChampionPage />} />
        <Route path="/tournament/eliminated" element={<EliminatedPage />} />
      </Routes>
    </DraftProvider>
  )
}

export default App
