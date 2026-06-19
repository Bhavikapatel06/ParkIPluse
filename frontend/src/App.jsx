import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import HeatmapView from './components/HeatmapView';
import AnalyticsView from './components/AnalyticsView';
import Upload from './components/Upload';

function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/heatmap" element={<HeatmapView />} />
            <Route path="/analytics" element={<AnalyticsView />} />
            <Route path="/upload" element={<Upload />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
