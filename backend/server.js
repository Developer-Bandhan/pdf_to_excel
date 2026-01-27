require("dotenv").config();

const express = require("express");
const cors = require("cors");

const pdfRoutes = require("./routes/pdf.routes");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use("/", pdfRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
