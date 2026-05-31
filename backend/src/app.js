const express = require("express");
const cors = require("cors");

const PORT = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  return res.send("server is up");
});

app.listen(PORT, () => {
  console.log(`Server is up on port ${PORT}`);
});
