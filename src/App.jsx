import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Regalo from './pages/Regalo';
import Guest from './pages/Guest';
import Admin from './pages/Admin';
import Display from './pages/Display';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/guest" replace />} />
        <Route path="/guest" element={<Guest />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/display" element={<Display />} />
        <Route path="/regalo" element={<Regalo />} />

        <Route
          path="*"
          element={<Navigate to="/guest" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;