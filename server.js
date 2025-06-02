const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const admin = require("firebase-admin");

// Load credentials from environment variables
const serviceAccount = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'), // fix escaped newlines
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
  universe_domain: process.env.UNIVERSE_DOMAIN,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

const BOOKS_COLLECTION = "books";

// Scraper function
async function scrapeBooks() {
  const res = await axios.get("https://books.toscrape.com/");
  const $ = cheerio.load(res.data);

  const books = [];

  $(".product_pod").each((i, el) => {
    const title = $(el).find("h3 a").attr("title");
    const price = $(el).find(".price_color").text();
    books.push({ title, price });
  });

  return books;
}

// API to trigger scraping and save to Firestore
app.post("/api/scrape", async (req, res) => {
  try {
    const books = await scrapeBooks();

    // Clear previous data
    const snapshot = await db.collection(BOOKS_COLLECTION).get();
    const batch = db.batch();
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    // Save new data
    const batchAdd = db.batch();
    books.forEach(book => {
      const docRef = db.collection(BOOKS_COLLECTION).doc();
      batchAdd.set(docRef, book);
    });
    await batchAdd.commit();

    res.json({ success: true, count: books.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API to get books
app.get("/api/books", async (req, res) => {
  try {
    const snapshot = await db.collection(BOOKS_COLLECTION).get();
    const books = [];
    snapshot.forEach(doc => {
      books.push(doc.data());
    });
    res.json(books);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
