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
  const [words, setWords] = useState([]);
  const [message, setMessage] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const handleChange = useCallback((e) => {
    const value = e.target.value;
    setText(value);
    setWords([]);

    clearTimeout(debounceRef.current);

    if (value.length < 3) {
      setMessage("");
      setWords([]);
      return;
    }

    if (!value.trim()) return;

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { words, message } = await fetchCategories(value);
        setWords(words);
        setMessage(message);
      } catch {
        setWords([]);
        setMessage("");
      } finally {
        setLoading(false);
      }
    }, 200);
  }, []);

  const applySuggestion = useCallback((completion) => {
    setText(completion + " ");
    setWords([]);
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
      {words?.length > 0 && (
        <ul className="suggestions">
          {words.map((s, i) => (
            <li key={i}>
              <button
                className="invisible-btn"
                onClick={() => applySuggestion(words[i])}
                tabIndex={2 + i}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
