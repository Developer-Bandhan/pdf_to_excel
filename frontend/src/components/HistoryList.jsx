import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

const HistoryList = () => {
    const [pdfs, setPdfs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPdfs();
    }, []);

    const fetchPdfs = async () => {
        try {
            const res = await axios.get("http://localhost:5000/pdfs");
            setPdfs(res.data);
        } catch (error) {
            console.error("Failed to fetch PDFs", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center p-4">Loading history...</div>;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    Recent Processing
                </h2>
                <button
                    onClick={fetchPdfs}
                    className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                    Refresh
                </button>
            </div>

            <div className="overflow-hidden flex flex-col max-h-[600px]">
                <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-700/95 backdrop-blur-sm text-gray-500 dark:text-gray-400 font-medium border-b border-gray-100 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-4">File Name</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4 text-center">Pages</th>
                                <th className="px-6 py-4 text-center">Rows</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {pdfs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        No files processed yet.
                                    </td>
                                </tr>
                            ) : (
                                pdfs.map((doc) => (
                                    <tr key={doc._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                                            {doc.original_name}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                                            {new Date(doc.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                                            {doc.total_pages}
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-900 dark:text-gray-100 font-medium">
                                            {doc.status === "COMPLETED" ? (doc.verified_rows || 0) : "-"}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${doc.status === "COMPLETED"
                                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                                    : doc.status === "FAILED"
                                                        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                                        : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                                    }`}
                                            >
                                                {doc.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                to={`/view/${doc._id}`}
                                                className="inline-flex items-center justify-center px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors text-xs font-semibold"
                                            >
                                                View Data
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <style jsx="true">{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #334155;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
        </div>
    );
};

export default HistoryList;
