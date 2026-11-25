// Creates (or promotes) the first superadmin account.
//   node --env-file=.env.local database/create-superadmin.mjs you@example.com "YourPassword" "First" "Last"
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const [email, password, firstName = "Super", lastName = "Admin"] = process.argv.slice(2);

if (!email || !password || password.length < 8) {
  console.error('Usage: create-superadmin.mjs <email> <password (8+ chars)> ["First"] ["Last"]');
  process.exit(1);
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME,
});

try {
  const hash = await bcrypt.hash(password, 12);
  const normalized = email.trim().toLowerCase();
  const [rows] = await connection.execute("SELECT id FROM users WHERE email = ?", [normalized]);

  if (rows.length) {
    await connection.execute(
      "UPDATE users SET role = 'superadmin', status = 'active', password_hash = ? WHERE id = ?",
      [hash, rows[0].id]
    );
    console.log(`Updated ${normalized} to superadmin.`);
  } else {
    await connection.execute(
      `INSERT INTO users (id, first_name, last_name, full_name, email, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?, 'superadmin')`,
      [randomUUID(), firstName, lastName, `${firstName} ${lastName}`.trim(), normalized, hash]
    );
    console.log(`Created superadmin ${normalized}.`);
  }
} finally {
  await connection.end();
}
