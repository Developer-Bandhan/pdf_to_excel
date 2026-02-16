import React from 'react';

const formatCurrency = (amount, currency = 'USD') => {
    if (amount === undefined || amount === null || isNaN(amount)) return currency === 'INR' ? '₹0.00' : '$0.00';
    return currency === 'INR'
        ? `₹${Number(amount).toFixed(4)}`
        : `$${Number(amount).toFixed(6)}`;
};

const StatCard = ({ label, value, icon, color }) => {
    const colorClasses = {
        blue: "from-blue-500 to-blue-600 shadow-blue-500/20",
        green: "from-green-500 to-green-600 shadow-green-500/20",
        emerald: "from-emerald-500 to-emerald-600 shadow-emerald-500/20",
        amber: "from-amber-500 to-amber-600 shadow-amber-500/20",
        purple: "from-purple-500 to-purple-600 shadow-purple-500/20",
        indigo: "from-indigo-500 to-indigo-600 shadow-indigo-500/20",
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 flex flex-col relative overflow-hidden group hover:shadow-lg transition-all duration-300">
            <div className="flex items-start justify-between z-10">
                <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                    <h4 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{typeof value === 'number' ? value.toLocaleString() : value}</h4>
                </div>
                <div className={`p-2.5 rounded-xl bg-linear-to-br ${colorClasses[color]} text-white shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
                    {icon}
                </div>
            </div>
            {/* Decorative blob */}
            <div className={`absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-5 bg-linear-to-br ${colorClasses[color]} blur-2xl group-hover:opacity-10 transition-opacity`}></div>
        </div>
    );
};

export const TokenUsageSummary = ({ stats }) => {
    if (!stats || !stats.overall) return null;
    const { overall } = stats;

    return (
        <div className="bg-linear-to-br from-white/95 to-white/80 dark:from-gray-800/95 dark:to-gray-900/80 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-white/20 dark:border-gray-700/50 transition-all hover:shadow-blue-500/10 ring-1 ring-black/5 dark:ring-white/10">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-tr from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-800/20 rounded-xl shadow-inner">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </div>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
                    Resource Usage & Cost
                </span>
            </h3>

            <div className="space-y-4">
                <StatCard
                    label="Total Input"
                    value={overall.input?.toLocaleString() || 0}
                    icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                    color="blue"
                />
                <StatCard
                    label="Total Output"
                    value={overall.output?.toLocaleString() || 0}
                    icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>}
                    color="green"
                />
                <StatCard
                    label="Grand Total"
                    value={overall.total?.toLocaleString() || 0}
                    icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                    color="purple"
                />
                <div className="grid grid-cols-2 gap-4">
                    <StatCard
                        label="Cost (USD)"
                        value={formatCurrency(overall.costUSD, 'USD')}
                        // icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                        // color="emerald"
                    />
                    <StatCard
                        label="Cost (INR)"
                        value={formatCurrency(overall.costINR, 'INR')}
                        // icon={<span className="font-bold text-sm font-serif">₹</span>}
                        // color="indigo"
                    />
                </div>
            </div>
        </div>
    );
};

export const TokenBreakdown = ({ stats }) => {
    if (!stats || !stats.byModel) return null;
    const { byModel } = stats;

    return (
        <div className="bg-white dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-gray-100 dark:border-gray-700/50 h-full max-h-[410px] flex flex-col">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2 flex-none">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Model Wise Costing
            </h3>

            <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl p-1 border border-gray-100 dark:border-gray-700/50 overflow-hidden flex flex-col flex-1">
                <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
                    <div className="min-w-[650px] p-1">
                        {/* Header Row - Sticky */}
                        <div className="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-sm grid grid-cols-7 gap-4 px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                            <div className="col-span-1">Model</div>
                            <div className="text-right">Input</div>
                            <div className="text-right">Output</div>
                            <div className="text-right">Thoughts</div>
                            <div className="text-right">Total</div>
                            <div className="text-right">Cost (USD)</div>
                            <div className="text-right">Cost (INR)</div>
                        </div>

                        <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                            {Object.entries(byModel).map(([model, metrics]) => (
                                <div key={model} className="bg-white dark:bg-gray-800 transition-colors grid grid-cols-7 gap-4 px-4 py-3 items-center group hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <div className="col-span-1">
                                        <span className="text-[13px] font-medium text-blue-600 dark:text-blue-400 truncate block" title={model}>{model}</span>
                                    </div>

                                    <div className="text-right">
                                        <span className="text-sm text-gray-600 dark:text-gray-300">{metrics.input.toLocaleString()}</span>
                                    </div>

                                    <div className="text-right">
                                        <span className="text-sm text-gray-600 dark:text-gray-300">{metrics.output.toLocaleString()}</span>
                                    </div>

                                    <div className="text-right">
                                        <span className="text-sm text-gray-600 dark:text-gray-300">{metrics.thoughts?.toLocaleString() || 0}</span>
                                    </div>

                                    <div className="text-right">
                                        <span className="text-sm font-semibold text-gray-800 dark:text-white">{metrics.total.toLocaleString()}</span>
                                    </div>

                                    <div className="text-right">
                                        <span className="text-sm text-gray-700 dark:text-gray-200">{formatCurrency(metrics.costUSD, 'USD')}</span>
                                    </div>

                                    <div className="text-right">
                                        <span className="text-sm font-medium text-green-600 dark:text-green-400">{formatCurrency(metrics.costINR, 'INR')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {Object.keys(byModel).length === 0 && (
                            <div className="text-center py-12 text-gray-400 dark:text-gray-500 italic">
                                Waiting for token usage data...
                            </div>
                        )}
                    </div>
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

// Also keep TokenStats for backward compatibility or as a combined component if needed
const TokenStats = ({ stats }) => {
    return (
        <div className="space-y-6">
            <TokenUsageSummary stats={stats} />
            <TokenBreakdown stats={stats} />
        </div>
    );
};

export default TokenStats;

