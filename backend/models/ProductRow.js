const mongoose = require("mongoose");

const productRowSchema = new mongoose.Schema({
    pdf_id: {
        type: mongoose.Types.ObjectId,
        ref: "PdfDocument",
        required: true,
    },
    page_number: {
        type: Number,
        required: true,
    },
    brand_name: {
        type: String,
        default: ""
    },
    product_name: {
        type: String,
        default: ""
    },
    furniture_type: {
        type: String,
        default: ""
    },
    design: {
        type: String,
        default: ""
    },
    product_code: {
        type: String,
        default: ""
    },
    system_code: {
        type: String,
        default: ""
    },
    length_cm: {
        type: String,
        default: ""
    },
    breath_cm: {
        type: String,
        default: ""
    },
    height_cm: {
        type: String,
        default: ""
    },
    seat_height_cm: {
        type: String,
        default: ""
    },
    upholstery: {
        type: String,
        default: ""
    },
    currency: {
        type: String,
        default: ""
    },
    price: {
        type: String,
        default: ""
    },
    other_material: {
        type: String,
        default: ""
    },
    special_feature: {
        type: String,
        default: ""
    },
    additional_price: {
        type: String,
        default: ""
    },
    cbm: {
        type: String,
        default: ""
    },
    product_weight_kg: {
        type: String,
        default: ""
    },
    remark: {
        type: String,
        default: ""
    },
    initials: {
        type: String,
        default: ""
    },
    date: {
        type: String,
        default: ""
    }
}, { timestamps: true });

productRowSchema.index({ pdf_id: 1 });

module.exports = mongoose.model("ProductRow", productRowSchema);