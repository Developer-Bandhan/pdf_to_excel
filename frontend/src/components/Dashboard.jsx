import React, { useState, useEffect } from "react";
import axios from "axios";
import ActivityLog from "./ActivityLog";
import { TokenUsageSummary, TokenBreakdown } from "./TokenStats";
import HistoryList from "./HistoryList";

const Dashboard = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState([]);
    const [isDualExtraction, setIsDualExtraction] = useState(false);
    const [isValidationEnabled, setIsValidationEnabled] = useState(false);
    const [seconds, setSeconds] = useState(0);
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

    useEffect(() => {
        let interval = null;
        if (loading) {
            interval = setInterval(() => {
                setSeconds((prev) => prev + 1);
            }, 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [loading]);

    const formatTime = (totalSeconds) => {
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleUpload = async () => {
        if (!file) return alert("Please select a PDF file");

        setLoading(true);
        setSeconds(0);
        setLogs([]);
        setStats({
            byModel: {},
            overall: { input: 0, output: 0, thoughts: 0, total: 0 }
        });

        const formData = new FormData();
        formData.append("pdf", file);
        formData.append("isDualExtraction", isDualExtraction);
        formData.append("isValidationEnabled", isValidationEnabled);

        try {
            const response = await axios.post(
                "http://localhost:5000/process-pdf",
                formData
            );

            setLogs((prev) => [
                ...prev,
                { type: "complete", data: response.data }
            ]);

            // We could trigger a refresh of the history list here if we moved state up, 
            // but simpler to just let the user see it on refresh or we can add a refresh trigger later.
            // For now, simple is fine.

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
        <div className="space-y-8">
            {/* Header */}
            <header className="flex flex-col md:flex-row items-center justify-between pb-6 border-b border-gray-200 dark:border-gray-800">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        <span className="text-blue-600">PDF Extractor</span>
                    </h1>
                </div>
                <div className="mt-4 md:mt-0 flex items-center gap-3">
                    <span className={`inline-flex items-center px-4 py-1.5 rounded-xl text-sm font-bold tracking-wider shadow-sm transition-all ${loading ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                        <svg className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatTime(seconds)}
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

                        <div className="mt-6 flex flex-col gap-4">
                            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50">
                                <div>
                                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Dual Extraction</p>
                                </div>
                                <button
                                    onClick={() => setIsDualExtraction(!isDualExtraction)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isDualExtraction ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDualExtraction ? 'translate-x-6' : 'translate-x-1'}`}
                                    />
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800/50">
                                <div>
                                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Visual Validation</p>
                                </div>
                                <button
                                    onClick={() => setIsValidationEnabled(!isValidationEnabled)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isValidationEnabled ? 'bg-amber-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isValidationEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                                    />
                                </button>
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

                    <TokenUsageSummary stats={stats} />
                </div>

                {/* Right Panel: Output & Stats */}
                <div className="lg:col-span-2 space-y-6">
                    <ActivityLog logs={logs} />
                    <TokenBreakdown stats={stats} />
                </div>
            </div>

            {/* History Section */}
            <HistoryList />
        </div>
    );
};

export default Dashboard;
