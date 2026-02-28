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
    DIA: {
        type: String,
        default: ""
    },
    length_cm: {
        type: String,
        default: ""
    },
    length_2_cm: {
        type: String,
        default: ""
    },
    length_3_cm: {
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
    finish_code: {
        type: String,
        default: ""
    },
    finish_specification: {
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
    other_material_comments: {
        type: String,
        default: ""
    },
    special_feature: {
        type: String,
        default: ""
    },
    additional_price_lowest: {
        type: String,
        default: ""
    },
    additional_price_highest: {
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
    },

    invalid_fields: {
        type: [String],
        default: []
    },

    is_verified: {
        type: Boolean,
        default: false
    },
    validation_status: {
        type: String,
        default: "valid"
    }
}, { timestamps: true });

productRowSchema.index({ pdf_id: 1, product_code: 1 });

// module.exports = mongoose.model("ProductRow", productRowSchema);


module.exports = {
    ProductRowRun1: mongoose.model(
        "ProductRowRun1",
        productRowSchema,
        "product_rows_run1"
    ),

    ProductRowRun2: mongoose.model(
        "ProductRowRun2",
        productRowSchema,
        "product_rows_run2"
    ),

    ProductRowVerified: mongoose.model(
        "ProductRowVerified",
        productRowSchema,
        "product_rows_verified"
    )
};