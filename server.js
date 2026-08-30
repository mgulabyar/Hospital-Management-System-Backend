const express = require('express');
const patientRoutes = require('./routes/patientRoutes');
const doctorRoutes = require('./routes/doctorRoutes');

const app = express();

app.use(express.json());

app.use('/api/patient', patientRoutes);
app.use('/api/doctor', doctorRoutes); 

app.get('/', (req, res) => {
  res.send('Hospital Management System - Complete Integrated Backend is Running!');
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is listening locally on http://localhost:${PORT}`);
});
