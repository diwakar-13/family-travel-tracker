import dotenv from "dotenv";
dotenv.config();
import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = process.env.PORT || 3000;

// ================= DATABASE =================
const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});



db.connect();

// ================= MIDDLEWARE =================
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// ================= GLOBAL STATE =================
let currentUserId = 1;
let users = [];

// ================= HELPER FUNCTIONS =================

// get visited countries for current user
async function checkVisited() {
  const result = await db.query(
    "SELECT country_code FROM visited_country WHERE user_id = $1;",
    [currentUserId]
  );

  return result.rows.map(row => row.country_code);
}

// get users + current user safely
async function getCurrentUser() {
  const result = await db.query("SELECT * FROM users");
  users = result.rows || [];

  if (users.length === 0) return null;

  return users.find(u => u.id == currentUserId) || users[0];
}

// ALWAYS-safe render for index.ejs
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

// HOME
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

// ADD COUNTRY
app.post("/add", async (req, res) => {
  try {
    const input = req.body.country;

    // accidental click / empty input
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

// SWITCH / ADD USER
app.post("/user", (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

// CREATE NEW USER
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
  console.log(`Server running on http://localhost:${port}`);
});
