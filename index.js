const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// Simple route to test response
app.get("/", (req, res) => {
  res.send("Hello, World!");
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
