const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const path = require("path");

const pdfToImages = require("../services/pdfToImages");
const geminiExtract = require("../services/geminiExtract");
const openaiExtract = require("../services/openaiExtract");
const compareExtractsFull = require("../services/compareExtract");
const excelExportCompare = require("../services/excelExportCompare");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/process-pdf", upload.single("pdf"), async (req, res) => {
  let imageDir = "";

  try {
    if (!req.file) return res.status(400).send("PDF file missing");

    const pdfPath = req.file.path;
    imageDir = `temp_images_${Date.now()}`;
    await fs.ensureDir(imageDir);

    // 1) PDF → Images
    const imagePaths = await pdfToImages(pdfPath, imageDir);

    // 2) Extract both
    console.log(" Extracting Gemini + OpenAI...");
    const [geminiRows, openaiRows] = await Promise.all([
      geminiExtract(imagePaths),
      openaiExtract(imagePaths),
    ]);

    // 3) Compare FULL columns
    const { matchedRows, mismatchedRows } = compareExtractsFull(
      geminiRows,
      openaiRows
    );

    console.log("Matched:", matchedRows.length);
    console.log("Mismatched:", mismatchedRows.length);

    // 4) Export two Excels
    const { matchedFile, mismatchedFile } = await excelExportCompare(
      matchedRows,
      mismatchedRows
    );

    // Cleanup temp
    await fs.remove(pdfPath);
    await fs.remove(imageDir);

    // 5) Return zip? (Not using zip now)
    // Since you asked for separate excel, we'll send matched first.
    // You can download mismatched via another endpoint OR we can zip them.

    return res.json({
      message: "Done",
      matchedFile,
      mismatchedFile,
      matchedCount: matchedRows.length,
      mismatchedCount: mismatchedRows.length,
    });
  } catch (error) {
    console.error("Processing failed:", error);
    try {
      if (imageDir) await fs.remove(imageDir);
    } catch (_) {}

    return res.status(500).send("Processing failed");
  }
});

module.exports = router;
