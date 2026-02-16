import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import ResultTable from "./ResultTable";

const PdfViewer = () => {
    const { id } = useParams();
    const [pdf, setPdf] = useState(null);
    const [activeTab, setActiveTab] = useState("run1");
    const [rows, setRows] = useState([]);
    const [loadingRows, setLoadingRows] = useState(false);

    useEffect(() => {
        fetchPdfDetails();
    }, [id]);

    useEffect(() => {
        fetchRows(activeTab);
    }, [id, activeTab]);

    const fetchPdfDetails = async () => {
        try {
            const res = await axios.get(`http://localhost:5000/pdfs/${id}`);
            setPdf(res.data);
        } catch (error) {
            console.error("Failed to fetch PDF details", error);
        }
    };

    const fetchRows = async (type) => {
        setLoadingRows(true);
        try {
            const res = await axios.get(`http://localhost:5000/pdfs/${id}/rows?type=${type}`);
            setRows(res.data);
        } catch (error) {
            console.error("Failed to fetch rows", error);
        } finally {
            setLoadingRows(false);
        }
    };

    const handleDownload = async () => {
        try {
            // Use window.location.href to trigger download directly
            const url = `http://localhost:5000/pdfs/${id}/download?type=${activeTab}`;
            window.open(url, '_blank');
        } catch (error) {
            console.error("Download failed", error);
        }
    };

    if (!pdf) return <div className="p-8 text-center">Loading PDF details...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div>
                    <div className="flex items-center space-x-3 mb-2">
                        <Link to="/" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                            </svg>
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate max-w-xl">
                            {pdf.original_name}
                        </h1>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${pdf.status === "COMPLETED" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                            }`}>
                            {pdf.status}
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 ml-8">
                        Processed on {new Date(pdf.createdAt).toLocaleString()} • {pdf.total_pages} Pages
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="border-b border-gray-200 dark:border-gray-700 px-6 pt-4">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        {["run1", "run2", "verified"].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab
                                        ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                                    }
                `}
                            >
                                {tab === "run1" && "Iteration 1 (Raw)"}
                                {tab === "run2" && "Iteration 2 (Raw)"}
                                {tab === "verified" && "Verified Data (Clean)"}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-4">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white capitalize">
                                {activeTab === 'verified' ? 'Verified Extraction Results' : `${activeTab} Extraction Results`}
                            </h3>
                            <button
                                onClick={handleDownload}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download Excel
                            </button>
                        </div>
                        <span className="text-sm text-gray-500">
                            {rows.length} rows found
                        </span>
                    </div>

                    {loadingRows ? (
                        <div className="flex justify-center items-center py-20">
                            <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                    ) : (
                        <ResultTable data={rows} type={activeTab} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default PdfViewer;
