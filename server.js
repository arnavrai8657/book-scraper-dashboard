const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const admin = require("firebase-admin");
const serviceAccount = require("./firebaseServiceAccount.json");

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
