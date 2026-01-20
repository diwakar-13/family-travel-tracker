// ================= ENV =================
import dotenv from "dotenv";
dotenv.config();

import express from "express";
// ❌ REMOVED: body-parser (not needed)
// import bodyParser from "body-parser";

import pg from "pg";

const app = express();
const port = process.env.PORT || 3000; // ✅ SAME AS YOUR CODE

// ================= DATABASE =================

// 🔴 CHANGED: use Pool instead of Client
const { Pool } = pg;

// 🔴 CHANGED: use DATABASE_URL (Railway/Neon)
// ❌ REMOVED: DB_USER, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT
const db = new Pool({
  connectionString: process.env.DATABASE_URL,

  // 🔴 CHANGED: SSL required for cloud PostgreSQL
  ssl: {
    rejectUnauthorized: false,
  },
});

// ❌ REMOVED: db.connect()
// Pool handles connections automatically

// ================= MIDDLEWARE =================
app.use(express.urlencoded({ extended: true })); // ✅ SAME
app.use(express.json()); // ✅ SAME
app.use(express.static("public")); // ✅ SAME
app.set("view engine", "ejs"); // ✅ SAME

// ================= GLOBAL STATE =================
// ⚠️ SAME AS YOUR CODE (not production-safe, but OK for now)
let currentUserId = 1;
let users = [];

// ================= HELPER FUNCTIONS =================

// ✅ SAME AS YOUR CODE
async function checkVisited() {
  const result = await db.query(
    "SELECT country_code FROM visited_country WHERE user_id = $1;",
    [currentUserId]
  );
  return result.rows.map(row => row.country_code);
}

// ✅ SAME AS YOUR CODE
async function getCurrentUser() {
  const result = await db.query("SELECT * FROM users");
  users = result.rows || [];

  if (users.length === 0) return null;
  return users.find(u => u.id == currentUserId) || users[0];
}

// ✅ SAME AS YOUR CODE
function renderIndex(res, options = {}) {
  res.render("index.ejs", {
    countries: options.countries || [],
    total: options.countries ? options.countries.length : 0,
    users: users || [],
    color: options.color || "gray",
    error: options.error || null,
  });
}

// ================= ROUTES =================

// ✅ SAME AS YOUR CODE
app.get("/", async (req, res) => {
  try {
    const countries = await checkVisited();
    const currentUser = await getCurrentUser();

    renderIndex(res, {
      countries,
      color: currentUser ? currentUser.color : "gray",
    });
  } catch (err) {
    console.log("Home error:", err);
    renderIndex(res);
  }
});

// ✅ SAME AS YOUR CODE
app.post("/add", async (req, res) => {
  try {
    const input = req.body.country;

    if (!input || input.trim() === "") {
      return res.redirect("/");
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return res.redirect("/");
    }

    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    if (result.rows.length === 0) {
      const countries = await checkVisited();
      return renderIndex(res, {
        countries,
        color: currentUser.color,
        error: "Country name does not exist, try again.",
      });
    }

    const countryCode = result.rows[0].country_code;

    await db.query(
      "INSERT INTO visited_country (country_code, user_id) VALUES ($1, $2);",
      [countryCode, currentUserId]
    );

    res.redirect("/");
  } catch (err) {
    console.log(err);

    const countries = await checkVisited();
    const currentUser = await getCurrentUser();

    renderIndex(res, {
      countries,
      color: currentUser ? currentUser.color : "gray",
      error: "Country has already been added, try again.",
    });
  }
});

// ✅ SAME AS YOUR CODE
app.post("/user", (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

// ✅ SAME AS YOUR CODE
app.post("/new", async (req, res) => {
  const { name, color } = req.body;

  const result = await db.query(
    "INSERT INTO users (name, color) VALUES ($1, $2) RETURNING *;",
    [name, color]
  );

  currentUserId = result.rows[0].id;
  res.redirect("/");
});

// ================= SERVER =================
app.listen(port, () => {
  // 🔴 CHANGED: removed localhost (Railway has no localhost)
  console.log(`Server running on port ${port}`);
});
