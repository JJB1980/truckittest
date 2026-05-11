import { render, screen, act, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import App from "../App";

// Server returns { categories, words, message }
function mockFetch(payload, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => payload,
  });
}

// Fire a change event, advance past the 200ms debounce, drain microtasks
async function typeAndSettle(textarea, value) {
  fireEvent.change(textarea, { target: { value } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("App", () => {
  it("renders the heading and textarea", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /autocomplete/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/start typing/i)).toBeInTheDocument();
  });

  it("does not fetch when input is shorter than 3 characters", async () => {
    global.fetch = mockFetch({ categories: [], words: [], message: "" });
    render(<App />);
    await typeAndSettle(screen.getByPlaceholderText(/start typing/i), "ab");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does not fetch when input is empty", async () => {
    global.fetch = mockFetch({ categories: [], words: [], message: "" });
    render(<App />);
    await typeAndSettle(screen.getByPlaceholderText(/start typing/i), "");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fetches after debounce when input is 3+ characters", async () => {
    global.fetch = mockFetch({ categories: ["fruit"], words: ["Apple"], message: "Success" });
    render(<App />);
    await typeAndSettle(screen.getByPlaceholderText(/start typing/i), "app");
    expect(global.fetch).toHaveBeenCalledOnce();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/autocomplete",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ text: "app" }),
      })
    );
  });

  it("shows suggestions returned from the API", async () => {
    global.fetch = mockFetch({
      categories: ["fruit", "animal"],
      words: ["Apple", "Ant"],
      message: "Success",
    });
    render(<App />);
    await typeAndSettle(screen.getByPlaceholderText(/start typing/i), "app");
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].textContent.trim()).toBe("Apple is a fruit");
    expect(items[1].textContent.trim()).toBe("Ant is a animal");
  });

  it("does not render the message paragraph when message is 'Success'", async () => {
    global.fetch = mockFetch({ categories: ["fruit"], words: ["Apple"], message: "Success" });
    render(<App />);
    await typeAndSettle(screen.getByPlaceholderText(/start typing/i), "app");
    expect(screen.queryByText("Success")).not.toBeInTheDocument();
  });

  it("shows message when no suggestions are found", async () => {
    global.fetch = mockFetch({ categories: [], words: [], message: "No suggestions" });
    render(<App />);
    await typeAndSettle(screen.getByPlaceholderText(/start typing/i), "xyz");
    expect(screen.getByText("No suggestions")).toBeInTheDocument();
  });

  it("clicking a suggestion updates the textarea and hides the list", async () => {
    global.fetch = mockFetch({ categories: ["fruit"], words: ["Apple"], message: "Success" });
    render(<App />);
    const textarea = screen.getByPlaceholderText(/start typing/i);
    await typeAndSettle(textarea, "app");

    const btn = screen.getByRole("button", { name: /apple is a fruit/i });
    await act(async () => { fireEvent.click(btn); });

    expect(textarea).toHaveValue("Apple ");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("clears suggestions and hides the list on API error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    render(<App />);
    await typeAndSettle(screen.getByPlaceholderText(/start typing/i), "app");
    expect(global.fetch).toHaveBeenCalledOnce();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows loading indicator while fetch is in-flight", async () => {
    let resolveFetch;
    global.fetch = vi.fn().mockReturnValue(
      new Promise((r) => { resolveFetch = r; })
    );
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText(/start typing/i), { target: { value: "app" } });

    await act(async () => { vi.advanceTimersByTime(250); });

    expect(screen.getByText("…")).toBeInTheDocument();

    await act(async () => {
      resolveFetch({ ok: true, json: async () => ({ categories: [], words: [], message: "" }) });
      await vi.runAllTimersAsync();
    });

    expect(screen.queryByText("…")).not.toBeInTheDocument();
  });

  it("debounces: sends only one request after rapid input changes", async () => {
    global.fetch = mockFetch({ categories: [], words: [], message: "" });
    render(<App />);
    const textarea = screen.getByPlaceholderText(/start typing/i);

    fireEvent.change(textarea, { target: { value: "a" } });
    fireEvent.change(textarea, { target: { value: "ap" } });
    fireEvent.change(textarea, { target: { value: "app" } });
    fireEvent.change(textarea, { target: { value: "appl" } });
    fireEvent.change(textarea, { target: { value: "apple" } });

    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(global.fetch).toHaveBeenCalledOnce();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/autocomplete",
      expect.objectContaining({ body: JSON.stringify({ text: "apple" }) })
    );
  });
});
