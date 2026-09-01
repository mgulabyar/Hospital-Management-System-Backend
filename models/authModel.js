const supabase = require("../config/db");
const crypto = require("crypto");
const bcrypt = require("bcryptjs"); // Change to bcryptjs for absolute node stability

// 1. REGISTER USER FUNCTION (With Secure Hashed Password)
async function create(data) {
  const secureRandomId = crypto.randomBytes(4).toString("hex");
  const customUserId = `USR-${secureRandomId}`;

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const { data: newUser, error } = await supabase
    .from("users")
    .insert([
      {
        user_id: customUserId,
        name: data.name,
        email: data.email,
        password: hashedPassword, // Secured hash storage
        role_category: data.role_category,
        specific_role: data.specific_role,
        phone_number: data.phone_number,
      },
    ])
    .select();

  if (error) throw error;
  return newUser;
}

// 2. FIND USER BY EMAIL (For Secure Hashed Logins Verification)
async function findByEmail(email) {
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email);

  if (error) throw error;
  return user;
}

// 3. CREATE SESSION: Token and user identifier mapping layout
async function createSession(userId, token) {
  const { error } = await supabase
    .from("sessions")
    .insert([{ user_id: userId, token }]);

  if (error) throw error;
}

// 4. FIND SESSION (FIXED): Mapped relational users table lookup matching safely
async function findSession(token) {
  const { data, error } = await supabase
    .from("sessions")
    .select("*, users(*)") // Pulls total fields from both sessions and users tables
    .eq("token", token);

  return { data, error };
}

// 5. DELETE SESSION: Permanent row truncation tracking for custom manual logouts
async function deleteSession(token) {
  const { error } = await supabase.from("sessions").delete().eq("token", token);

  if (error) throw error;
}

async function findAll() {
  const { data: usersList, error } = await supabase.from("users").select("*");

  if (error) throw error;
  return usersList;
}

async function update(id, updateData) {
  const { data, error } = await supabase
    .from("users")
    .update(updateData)
    .eq("user_id", id)
    .select();

  if (error) throw error;
  return data;
}

async function remove(id) {
  const { data, error } = await supabase
    .from("users")
    .delete()
    .eq("user_id", id)
    .select();

  if (error) throw error;
  return data;
}

module.exports = {
  create,
  findByEmail,
  createSession,
  findSession,
  deleteSession,
  findAll,
  update,
  remove,
};
