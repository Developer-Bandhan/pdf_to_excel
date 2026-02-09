const mongoose = require("mongoose");

const pdfDocumentSchema = new mongoose.Schema({
    file_name: {
        type: String,
        required: true
    },
    original_name: {
        type: String,
        required: true
    },
    total_pages: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ["UPLOADED", "PROCESSING", "COMPLETED", "FAILED"],
        default: "UPLOADED"
    }

}, { timestamps: true });


module.exports = mongoose.model("PdfDocument", pdfDocumentSchema);