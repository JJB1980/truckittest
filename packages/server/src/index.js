import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

const WORD_LIST = {
  fruit: [
    "apple",
    "banana",
    "orange",
    "grape",
    "strawberry",
    "watermelon",
    "grenadine",
  ],
  vegetable: [
    "carrot",
    "broccoli",
    "spinach",
    "potato",
    "tomato",
    "cucumber",
    "lettuce",
  ],
  meat: ["chicken", "beef", "pork", "lamb", "fish", "turkey", "duck"],
  animal: ["cat", "dog", "elephant", "giraffe", "lion", "tiger"],
  colour: ["red", "blue", "green", "yellow", "purple", "orange"],
  country: [
    "united states",
    "canada",
    "mexico",
    "brazil",
    "argentina",
    "france",
    "germany",
    "greenland",
  ],
};

app.get("/api/autocomplete", (req, res) => {
  const { query } = req.query;

  if (typeof query !== "string") {
    return res.status(400).json({ error: "query must be a string" });
  }

  const words = [];
  const categories = [];
  for (const category in WORD_LIST) {
    for (const word of WORD_LIST[category]) {
      if (word.startsWith(query.toLowerCase().trim())) {
        categories.push(category);
        words.push(word.charAt(0).toUpperCase() + word.slice(1));
        if (categories.length >= 5) break;
      }
    }
    if (categories.length >= 5) break;
  }

  res.json({
    categories,
    words,
    message: words.length ? `Success` : `No category found for '${query}'`,
  });
});

// Serve built client in production
if (process.env.NODE_ENV === "production") {
  const clientDist = join(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(join(clientDist, "index.html"));
  });
}

export { app };

// Only bind a port when this file is the entry point
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
