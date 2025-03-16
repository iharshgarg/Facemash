const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON requests
app.use(express.json());

// Serve static files (for frontend HTML)
app.use(express.static(path.join(__dirname, "public")));

// Simple route to serve the HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Test API endpoint (Responds immediately)
app.post("/test-api", (req, res) => {
  res.json({ message: "Test API response received!" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
