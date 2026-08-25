import { Route, Routes } from 'react-router-dom'
import { DraftProvider } from './context/DraftContext'
import { DraftPage } from './pages/DraftPage'
import { HomePage } from './pages/HomePage'
import { ResultPage } from './pages/ResultPage'
import { SimulationPage } from './pages/SimulationPage'

function App() {
  return (
    <DraftProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/draft" element={<DraftPage />} />
        <Route path="/simulate" element={<SimulationPage />} />
        <Route path="/result" element={<ResultPage />} />
      </Routes>
    </DraftProvider>
  )
}

export default App
