const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");

const pdfToImages = require("../services/pdfToImages.js");
// const excelExport = require("../services/excelExport");
const geminiExtract = require("../services/geminiExtract");
const openaiExtract = require("../services/openaiExtract.js")
const { sendEvent } = require("../utils/progress");
const ProductRow = require("../models/ProductRow");
const PdfDocument = require("../models/PdfDocumentSchema.js");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/process-pdf", upload.single("pdf"), async (req, res) => {
  let imageDir = "";
  let outputFilePath = "";

  try {
    if (!req.file) return res.status(400).send("PDF file missing");

    const pdfPath = req.file.path;
    imageDir = `temp_images_${Date.now()}`;
    await fs.ensureDir(imageDir);

    // 1) PDF → Images
    sendEvent("log", "Converting PDF to images...");
    const imagePaths = await pdfToImages(pdfPath, imageDir);

    const pdfDoc = await PdfDocument.create({
      file_name: req.file.filename,
      original_name: req.file.originalname,
      total_pages: imagePaths.length,
      status: "PROCESSING"
    })

    // 2) Gemini Extract
    // const { rows, token_usage } = await geminiExtract(imagePaths);

    sendEvent("log", "Starting Gemini Extraction...");
    const { rows } = await geminiExtract(imagePaths);

    console.log("rows", rows);

    if (rows.length) {
      await ProductRow.insertMany(
        rows.map(r => ({
          ...r,
          pdf_id: pdfDoc._id,
          page_number: r.page_number || null
        })),
        { ordered: false }
      );
    }

    await PdfDocument.updateOne(
      { _id: pdfDoc._id },
      { status: "COMPLETED" }
    );

    // Cleanup temp
    await fs.remove(pdfPath);
    await fs.remove(imageDir);

    // sendEvent("log", "Generating Excel file...");

    return res.json({
      message: "Extraction completed and data stored in DB",
      pdf_id: pdfDoc._id,
      total_rows: rows.length
    });

    // 2) OpenAI Extract
    // console.log("OpenAI Extracting...");
    // const allRows = await openaiExtract(imagePaths);

    // 3) Export Excel
    // outputFilePath = await excelExport(rows, token_usage);




    // sendEvent("complete", { message: "Processing complete", downloadUrl: outputFilePath });

    // return res.download(outputFilePath);
  } catch (error) {
    console.error("Processing failed:", error);
    sendEvent("error", { message: error.message });
    return res.status(500).send("Processing failed");
  }
});

module.exports = router;
