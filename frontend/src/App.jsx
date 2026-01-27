import React, { useState } from "react";
import axios from "axios";

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return alert("Please select a PDF file");
    setLoading(true);

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const response = await axios.post(
        "http://localhost:5000/process-pdf",
        formData,
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = "Extracted_Products.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert("Error processing PDF");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Inline CSS */}
      <style>{`
        body {
          margin: 0;
          font-family: Arial, Helvetica, sans-serif;
          background-color: #f3f4f6;
        }

        .container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .card {
          background: #ffffff;
          padding: 32px;
          width: 100%;
          max-width: 420px;
          border-radius: 10px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          border-top: 5px solid #2563eb;
        }

        .title {
          font-size: 22px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 8px;
        }

        .subtitle {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 24px;
        }

        .file-input {
          width: 100%;
          margin-bottom: 20px;
        }

        .file-input input {
          width: 100%;
        }

        .btn {
          width: 100%;
          padding: 14px;
          font-size: 16px;
          font-weight: bold;
          color: #ffffff;
          background-color: #2563eb;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .btn:hover {
          background-color: #1d4ed8;
        }

        .btn:disabled {
          background-color: #9ca3af;
          cursor: not-allowed;
        }
      `}</style>

      <div className="container">
        <div className="card">
          <h1 className="title">AI PDF Extractor</h1>
          <p className="subtitle">
            Unstructured PDF theke structured Excel banan
          </p>

          <div className="file-input">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files[0])}
            />
          </div>

          <button
            className="btn"
            onClick={handleUpload}
            disabled={loading}
          >
            {loading ? "Processing..." : "Convert to Excel"}
          </button>
        </div>
      </div>
    </>
  );
}

export default App;
