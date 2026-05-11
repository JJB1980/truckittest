import { useState, useCallback, useRef } from "react";

async function fetchCategories(text) {
  const res = await fetch(
    `/api/autocomplete?query=${encodeURIComponent(text)}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
  );
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

export default function App() {
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [words, setWords] = useState([]);
  const [message, setMessage] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const handleChange = useCallback((e) => {
    const value = e.target.value;
    setText(value);
    setSuggestions([]);

    clearTimeout(debounceRef.current);

    if (value.length < 3) return;

    if (!value.trim()) return;

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { categories, words, message } = await fetchCategories(value);
        setSuggestions(categories);
        setWords(words);
        setMessage(message);
      } catch {
        setSuggestions([]);
        setWords([]);
        setMessage("");
      } finally {
        setLoading(false);
      }
    }, 200);
  }, []);

  const applySuggestion = useCallback((completion) => {
    setText(completion + " ");
    setSuggestions([]);
  }, []);

  return (
    <div className="container">
      <h1>Autocomplete</h1>
      <div className="input-wrapper">
        <input
          value={text}
          onChange={handleChange}
          placeholder="Start typing..."
          tabIndex={1}
        />
        {loading && <span className="loading">…</span>}
      </div>
      {message !== "Success" && <p className="message">{message}</p>}
      {suggestions?.length > 0 && (
        <ul className="suggestions">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                className="invisible-btn"
                onClick={() => applySuggestion(words[i])}
                tabIndex={2 + i}
              >
                {words[i]} is a {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
