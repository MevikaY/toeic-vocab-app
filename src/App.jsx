import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import AddWord from './pages/AddWord';
import Quiz from './pages/Quiz';
import Tracker from './pages/Tracker';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      {/* ลบแท็ก <nav> ออก แล้วให้ <Routes> ทำงานเต็มหน้าจอไปเลย */}
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/add-word" element={<AddWord />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/tracker" element={<Tracker />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;