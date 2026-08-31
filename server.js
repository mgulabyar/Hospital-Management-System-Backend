const express = require('express')
const patientRoutes = require('./routes/patientRoutes')
const authRoutes = require('./routes/authRoutes') 

const app = express()

app.use(express.json())

app.use('/api/patient', patientRoutes) 
app.use('/api/auth', authRoutes)   

app.get('/', (req, res) => {
  res.send('Hospital Management System - Secured Authentication Gate is Live!')
})

const PORT = 3000
app.listen(PORT, () => {
  console.log(`Server is listening locally on http://localhost:${PORT}`)
})
