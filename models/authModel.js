const supabase = require('../config/db')
const crypto = require('crypto')

// 1. REGISTER USER FUNCTION (Admin Kisi Ko Bhi Add Karega)
async function create(data) {
  const secureRandomId = crypto.randomBytes(4).toString('hex')
  const customUserId = `USR-${secureRandomId}` // Output: USR-a1b2c3d4

  const { data: newUser, error } = await supabase
    .from('users')
    .insert([
      {
        user_id: customUserId,
        name: data.name,
        email: data.email,
        password: data.password,
        role_category: data.role_category, // Grouping Category (e.g. Clinical_Medical)
        specific_role: data.specific_role, // Exact Role (e.g. Doctor)
        phone_number: data.phone_number
      }
    ])
    .select()

  if (error) throw error
  return newUser
}

// 2. FIND USER BY EMAIL (Login Ke Waqt Password Verify Karne Ke Liye)
async function findByEmail(email) {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)

  if (error) throw error
  return user
}

// 3. READ ALL USERS FUNCTION (Admin Sab Ki List Dekh Sakta Hai)
async function findAll() {
  const { data: usersList, error } = await supabase
    .from('users')
    .select('*')
  if (error) throw error
  return usersList
}

// 4. DELETE USER FUNCTION (Admin Kisi Ko Bhi Permanent Remove Kar Sakta Hai)
async function remove(id) {
  const { data, error } = await supabase
    .from('users')
    .delete()
    .eq('user_id', id)
    .select()
  if (error) throw error
  return data
}

module.exports = {
  create,
  findByEmail,
  findAll,
  remove
}
