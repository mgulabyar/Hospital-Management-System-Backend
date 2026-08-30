const express = require('express')
const patientRoutes = require('./routes/patientRoutes')
const doctorRoutes = require('./routes/doctorRoutes')

const app = express()
app.use(express.json())

// Connect routes models paths
app.use('/api/patient', patientRoutes)
app.use('/api/doctor', doctorRoutes)

app.get('/', (req, res) => {
  res.send('Hospital Management System - Clean CRUD Backend is Live! 🚀')
})

const PORT = 3000
app.listen(PORT, () => {
  console.log(`Server is listening locally on http://localhost:${PORT}`)
})
