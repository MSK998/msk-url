const express = require("express");
const { Client } = require("pg");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();

const baseURL = "https://msk-url.herokuapp.com/";

const connectionString =
  "postgres://yzznzysrnnlktr:42856f3c14695d42baff64dff767e1e912d3c520560931c3f0badc7fd4c5dae6@ec2-54-228-209-117.eu-west-1.compute.amazonaws.com:5432/d3r2nfr6adat1p";

const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

client.connect();

// Checking the connection to the database
// If this returns anything but the time something is broken
client
  .query("SELECT NOW() as now")
  .then((res) => console.log(res.rows[0]))
  .catch((e) => console.error(e.stack));

// Passes the request through the body-parser middleware
app.use(bodyParser.json());

// Sets the path to load the front end from.
app.use("/", express.static(path.join(__dirname, "WebContent")));

// If a user is supplied a shortened URL from this site then the database is queried
// If a matching ID is found then the user wil be instantly redirected
app.get("/:shorturl", (req, res, next) => {
  // Converts the radix 36 value back into a base10 number
  const urlID = parseInt(req.params.shorturl, 36);

  // Construct the query
  // This should be sanitised
  const query = {
    text: "SELECT * FROM urls WHERE ID = $1",
    values: [urlID],
  };

  // Search the DB for the ID
  client
    .query(query)
    .then((result) => {
      // If a result is found, the url from that result is used to redirect the user
      if (result.rows[0] != null) {
        return res.redirect(result.rows[0].url);
      }
    })
    .catch((e) => console.error(e.stack));
});

// This post method could include a check for whether the url is already saved to the database

// If a POST request hits this endpoint then the URL will be added
// to the database and a base36 number will be supplied
app.post("/api/short", (req, res, next) => {
  // Extracts the url to be shortened
  const url = req.body.url;
  // Constructs the SQL query
  // These queries is not sanitised but definitely should be like with all SQL commands
  const query = {
    text:
      "INSERT INTO urls (url) SELECT CAST($1 AS VARCHAR) WHERE NOT EXISTS (SELECT 1 FROM urls WHERE url=$1)",
    values: [url],
  };

  // Sends the request to the server
  // This query will only insert a row if the url is not already in the database
  client
    .query(query)
    .then((insertResult) => console.log(insertResult))
    .catch((e) => console.error(e));

  const idQuery = {
    text: "SELECT * FROM urls WHERE url=$1;",
    values: [url],
  };

  // Gets the ID of the newly created row entry
  client.query(idQuery).then((idResult) => {
    console.log(idResult);
    // Encodes the ID to a radix value 36
    const radix36 = idResult.rows[0].id.toString(36);

    // Sends a response with the short url
    return res.status(201).json({
      shorturl: baseURL + radix36,
    });
  });
});

app.use((req, res, next) => {
  res.sendFile(path.join(__dirname, "WebContent", "index.html"))
})

module.exports = app;
