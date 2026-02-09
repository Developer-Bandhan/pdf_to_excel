require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./database/db.js")

const pdfRoutes = require("./routes/pdf.routes");

const app = express();

connectDB();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use("/", pdfRoutes);

const { setupSSE } = require("./utils/progress");
app.get("/events", (req, res) => {
  setupSSE(req, res);
});


// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
