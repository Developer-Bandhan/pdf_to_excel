import React, { useEffect, useRef } from 'react';

const ActivityLog = ({ logs }) => {
    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    return (
        <div className="bg-gray-900 text-gray-300 font-mono text-sm rounded-xl overflow-hidden shadow-2xl border border-gray-700 flex flex-col h-[500px]">
            <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                <span className="font-semibold text-gray-100 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Terminal
                </span>
                <span className="text-xs text-gray-500">v1.0.0-rc1</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-700">
                {logs.length === 0 && (
                    <div className="text-center text-gray-600 py-20 italic">
                        Waiting for process to start...
                    </div>
                )}

                {logs.map((log, index) => (
                    <div key={index} className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                        <span className="text-gray-600 select-none shrink-0 text-xs mt-0.5">{new Date().toLocaleTimeString()}</span>

                        <div className="flex-1 min-w-0">
                            {log.type === 'log' && (
                                <p className="text-blue-400">➜ {log.data}</p>
                            )}

                            {log.type === 'error' && (
                                <div className="p-3 bg-red-900/20 border-l-2 border-red-500 text-red-300 rounded-r">
                                    Error: {log.data.message}
                                </div>
                            )}

                            {log.type === 'thoughts' && (
                                <div className="text-xs text-gray-400 pl-4 border-l border-gray-700">
                                    <span className="text-purple-400 opacity-75">[{log.data.model}]</span>{' '}
                                    <span className="italic">{log.data.text}</span>
                                </div>
                            )}

                            {log.type === 'complete' && (
                                <div className="p-3 bg-green-900/20 border-l-2 border-green-500 text-green-300 rounded-r mt-2">
                                    ✓ Process Complete. <a href={log.data.downloadUrl} className="underline hover:text-green-200">Processing file...</a>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={endRef} />
            </div>
        </div>
    );
};

export default ActivityLog;
