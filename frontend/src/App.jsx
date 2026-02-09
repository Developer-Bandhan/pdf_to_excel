import React, { useState, useEffect } from "react";
import axios from "axios";
import ActivityLog from "./components/ActivityLog";
import TokenStats from "./components/TokenStats";

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    byModel: {},
    overall: { input: 0, output: 0, thoughts: 0, total: 0 }
  });

  useEffect(() => {
    const eventSource = new EventSource("http://localhost:5000/events");

    eventSource.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data);

      if (type === "token_update") {
        setStats(data);
      } else {
        setLogs((prev) => [...prev, { type, data }]);

        if (type === "complete") {
          setLoading(false);

        }
      }
    };

    eventSource.onerror = (err) => {
      // console.error("EventSource failed:", err);
      // eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const handleUpload = async () => {
    if (!file) return alert("Please select a PDF file");

    // Reset state
    setLoading(true);
    setLogs([]);
    setStats({
      byModel: {},
      overall: { input: 0, output: 0, thoughts: 0, total: 0 }
    });

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const response = await axios.post(
        "http://localhost:5000/process-pdf",
        formData,
        // { responseType: "blob" }
      );

      setLogs((prev) => [
        ...prev,
        { type: "complete", data: response.data }
      ]);

    } catch (error) {
      setLogs((prev) => [
        ...prev,
        { type: "error", data: { message: "Upload failed or server error." } }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 font-sans transition-colors duration-300">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between pb-6 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              <span className="text-blue-600">PDF Extractor</span>
            </h1>

          </div>
          <div className="mt-4 md:mt-0">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${loading ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
              {loading ? '● Processing...' : '● System Ready'}
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Panel: Controls */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Upload Document</h2>

              <div className="relative border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-blue-500 transition-colors cursor-pointer group">
                <input
                  type="file"
                  accept="application/pdf"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => setFile(e.target.files[0])}
                />
                <div className="pointer-events-none">
                  <svg className="mx-auto h-12 w-12 text-gray-400 group-hover:text-blue-500 transition-colors" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {file ? <span className="text-blue-600 font-medium">{file.name}</span> : <span>Click to upload or drag and drop PDF</span>}
                  </p>
                </div>
              </div>

              <button
                onClick={handleUpload}
                disabled={!file || loading}
                className={`mt-6 w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white transition-all
                  ${!file || loading
                    ? 'bg-gray-300 cursor-not-allowed dark:bg-gray-700'
                    : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                  }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : "Convert to Excel"}
              </button>
            </div>
          </div>

          {/* Right Panel: Output & Stats */}
          <div className="lg:col-span-2 space-y-6">
            <ActivityLog logs={logs} />
            <TokenStats stats={stats} />
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;
