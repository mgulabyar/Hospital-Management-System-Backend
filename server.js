const express = require("express");
const patientRoutes = require("./routes/patientRoutes");

const app = express();

app.use(express.json());

app.use("/api/patient", patientRoutes);

app.get("/", (req, res) => {
  res.send("Hospital Management System - Backend is Active and Running! 🚀");
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is listening locally on http://localhost:${PORT}`);
});
