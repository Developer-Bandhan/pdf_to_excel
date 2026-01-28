const excelExportSingle = require("./excelExport");

async function excelExportCompare(matchedRows, mismatchedRows) {
  const matchedFile = await excelExportSingle(matchedRows, "Matched");

  // mismatched rows -> for excel, we store gemini version only (or openai)
  const mismatchGeminiRows = mismatchedRows
    .map((m) => m.gemini)
    .filter(Boolean);

  const mismatchedFile = await excelExportSingle(
    mismatchGeminiRows,
    "Mismatched"
  );

  return { matchedFile, mismatchedFile };
}

module.exports = excelExportCompare;
