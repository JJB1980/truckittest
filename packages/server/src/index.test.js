import request from "supertest";
import { describe, it, expect } from "vitest";
import { app } from "./index.js";

const post = (body) =>
  request(app).post("/api/autocomplete").send(body).set("Content-Type", "application/json");

describe("POST /api/autocomplete", () => {
  describe("input validation", () => {
    it("returns 400 when text is missing", async () => {
      const res = await post({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "text must be a string" });
    });

    it("returns 400 when text is a number", async () => {
      const res = await post({ text: 42 });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "text must be a string" });
    });

    it("returns 400 when text is null", async () => {
      const res = await post({ text: null });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "text must be a string" });
    });

    it("returns 400 when text is an array", async () => {
      const res = await post({ text: ["apple"] });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "text must be a string" });
    });
  });

  describe("no-match cases", () => {
    it("returns empty results and 'No suggestions' for a non-matching prefix", async () => {
      const res = await post({ text: "zzz" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ categories: [], words: [], message: "No suggestions" });
    });

    it("returns results for an empty string (every word starts with '')", async () => {
      const res = await post({ text: "" });
      expect(res.status).toBe(200);
      // startsWith("") is true for every word, so up to 5 results come back
      expect(res.body.words.length).toBeLessThanOrEqual(5);
      expect(res.body.message).toBe("Success");
    });
  });

  describe("matching", () => {
    it("returns matching words and categories for a known prefix", async () => {
      const res = await post({ text: "app" });
      expect(res.status).toBe(200);
      expect(res.body.words).toContain("Apple");
      expect(res.body.categories).toContain("fruit");
      expect(res.body.message).toBe("Success");
    });

    it("title-cases each matched word", async () => {
      const res = await post({ text: "ban" });
      expect(res.body.words).toContain("Banana");
    });

    it("is case-insensitive (uppercase input matches lowercase dictionary)", async () => {
      const resLower = await post({ text: "app" });
      const resUpper = await post({ text: "APP" });
      expect(resUpper.body.words).toEqual(resLower.body.words);
      expect(resUpper.body.categories).toEqual(resLower.body.categories);
    });

    it("trims leading and trailing whitespace before matching", async () => {
      const resTrimmed = await post({ text: "app" });
      const resPadded = await post({ text: "  app  " });
      expect(resPadded.body.words).toEqual(resTrimmed.body.words);
    });

    it("returns both the word and its category", async () => {
      const res = await post({ text: "cat" });
      const idx = res.body.words.indexOf("Cat");
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(res.body.categories[idx]).toBe("animal");
    });

    it("can match words across multiple categories", async () => {
      // "gr" matches "grape" (fruit) and "green" (colour) and "greenland" (country)
      const res = await post({ text: "gr" });
      expect(res.body.words.length).toBeGreaterThan(1);
      const cats = new Set(res.body.categories);
      expect(cats.size).toBeGreaterThan(1);
    });
  });

  describe("result cap", () => {
    it("returns at most 5 results", async () => {
      // single letter "a" matches many words across categories
      const res = await post({ text: "a" });
      expect(res.body.words.length).toBeLessThanOrEqual(5);
      expect(res.body.categories.length).toBeLessThanOrEqual(5);
    });

    it("words and categories arrays always have the same length", async () => {
      const res = await post({ text: "a" });
      expect(res.body.words.length).toBe(res.body.categories.length);
    });
  });

  describe("response shape", () => {
    it("always returns categories, words, and message keys", async () => {
      const res = await post({ text: "x" });
      expect(res.body).toHaveProperty("categories");
      expect(res.body).toHaveProperty("words");
      expect(res.body).toHaveProperty("message");
    });

    it("categories and words are arrays", async () => {
      const res = await post({ text: "app" });
      expect(Array.isArray(res.body.categories)).toBe(true);
      expect(Array.isArray(res.body.words)).toBe(true);
    });

    it("message is 'Success' when results are found", async () => {
      const res = await post({ text: "app" });
      expect(res.body.message).toBe("Success");
    });

    it("message is 'No suggestions' when no results are found", async () => {
      const res = await post({ text: "zzz" });
      expect(res.body.message).toBe("No suggestions");
    });
  });
});
