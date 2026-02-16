import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import PdfViewer from "./components/PdfViewer";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 font-sans transition-colors duration-300">
        <div className="max-w-6xl mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/view/:id" element={<PdfViewer />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;

