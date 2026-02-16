import React from 'react';

const ResultTable = ({ data, type }) => {
    if (!data || data.length === 0) {
        return (
            <div className="text-center p-8 text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                No data found for this run.
            </div>
        );
    }

    // Define columns mapping
    const columns = [
        { label: "#", key: "index", width: "w-10", render: (_, idx) => idx + 1 },
        { label: "Pg", key: "page_number", width: "w-12" },
        { label: "Brand", key: "brand_name", width: "w-26" },
        { label: "Product Name", key: "product_name", width: "w-34" },
        { label: "Furniture Type", key: "furniture_type", width: "w-26" },
        { label: "Design", key: "design", width: "w-26" },
        { label: "Product Code", key: "product_code", width: "w-26 font-mono text-xs" },
        { label: "System Code", key: "system_code", width: "w-26 font-mono text-xs" },
        { label: "L (cm)", key: "length_cm", width: "w-18" },
        { label: "B (cm)", key: "breath_cm", width: "w-18" },
        { label: "H (cm)", key: "height_cm", width: "w-18" },
        { label: "Seat Height (cm)", key: "seat_height_cm", width: "w-18" },
        { label: "Upholstery", key: "upholstery", width: "w-22" },
        { label: "Currency", key: "currency", width: "w-14" },
        { label: "Price", key: "price", width: "w-20 font-semibold" },
        { label: "Other Material (Comments)", key: "other_material_comments", width: "w-22" },
        { label: "Special Feature", key: "special_feature", width: "w-22" },
        { label: "Additional Price", key: "additional_price", width: "w-18" },
        { label: "CBM", key: "cbm", width: "w-18" },
        { label: "Product Weight (kg)", key: "product_weight_kg", width: "w-18" },
        { label: "Remark", key: "remark", width: "w-32 truncate" },
    ];

    if (type === "verified") {
        columns.push({ label: "Verified", key: "is_verified", render: (val) => val ? "✅" : "❌" });
    }


    return (
        <div className="overflow-x-auto shadow-sm border border-gray-200 dark:border-gray-700 rounded-lg max-h-[600px] overflow-y-auto custom-scrollbar">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                        {columns.map((col, idx) => (
                            <th
                                key={idx}
                                scope="col"
                                className={`px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap ${col.width || ""}`}
                            >
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {data.map((row, rowIdx) => (
                        <tr key={row._id || rowIdx} className="hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">
                            {columns.map((col, colIdx) => (
                                <td
                                    key={`${rowIdx}-${colIdx}`}
                                    className={`px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300 ${col.width || ""}`}
                                    title={col.key === 'remark' ? row[col.key] : ''}
                                >
                                    {col.render ? col.render(row[col.key], rowIdx) : (row[col.key] || "-")}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ResultTable;
