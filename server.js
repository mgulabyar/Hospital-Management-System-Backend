const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db.js");
const authRoutes = require("./routes/authRoutes.js");
const staffRoutes = require("./routes/staffRoutes.js");
const patientRoutes = require("./routes/patientRoutes.js");
const tokenRoutes = require("./routes/tokenRoutes.js");
const medicalRecordRoutes = require('./routes/medicalRecordRoutes.js');
const labRoutes = require('./routes/labRoutes.js');
const pharmacyRoutes = require('./routes/pharmacyRoutes.js');
const billingRoutes = require('./routes/billingRoutes.js');
const departmentRoutes = require("./routes/departmentRoutes.js");
const appointmentRoutes = require("./routes/appointmentRoutes.js");



dotenv.config();

connectDB();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/tokens", tokenRoutes);
app.use('/api/medical-records', medicalRecordRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/appointments", appointmentRoutes);


app.get("/", (req, res) => {
  res.send("Hospital Management System API is running...");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}`);
});
