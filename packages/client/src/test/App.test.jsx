import { render, screen, act, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import App from "../App";

function mockFetch(payload, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => payload,
  });
}

// Trigger input change, advance past debounce, drain microtasks — all inside act
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
    global.fetch = mockFetch({ completions: [], words: [], message: "" });
    render(<App />);
    await typeAndSettle(screen.getByPlaceholderText(/start typing/i), "ab");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does not fetch when input is empty", async () => {
    global.fetch = mockFetch({ completions: [], words: [], message: "" });
    render(<App />);
    await typeAndSettle(screen.getByPlaceholderText(/start typing/i), "");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fetches after debounce when input is 3+ characters", async () => {
    global.fetch = mockFetch({ completions: ["fruit"], words: ["apple"], message: "Success" });
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
      completions: ["fruit", "animal"],
      words: ["apple", "ant"],
      message: "Success",
    });
    render(<App />);
    await typeAndSettle(screen.getByPlaceholderText(/start typing/i), "app");
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].textContent.replace(/\s+/g, " ").trim()).toBe("Apple is a fruit");
    expect(items[1].textContent.replace(/\s+/g, " ").trim()).toBe("Ant is a animal");
  });

  it("does not render the message paragraph when message is 'Success'", async () => {
    global.fetch = mockFetch({ completions: ["fruit"], words: ["apple"], message: "Success" });
    render(<App />);
    await typeAndSettle(screen.getByPlaceholderText(/start typing/i), "app");
    expect(screen.queryByText("Success")).not.toBeInTheDocument();
  });

  it("shows message when no suggestions are found", async () => {
    global.fetch = mockFetch({ completions: [], words: [], message: "No suggestions" });
    render(<App />);
    await typeAndSettle(screen.getByPlaceholderText(/start typing/i), "xyz");
    expect(screen.getByText("No suggestions")).toBeInTheDocument();
  });

  it("clicking a suggestion updates the textarea and hides the list", async () => {
    global.fetch = mockFetch({ completions: ["fruit"], words: ["apple"], message: "Success" });
    render(<App />);
    const textarea = screen.getByPlaceholderText(/start typing/i);
    await typeAndSettle(textarea, "app");
    const item = screen.getByRole("listitem");

    await act(async () => { fireEvent.click(item); });

    expect(textarea).toHaveValue("apple ");
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

    // Advance past the debounce so the callback fires and sets loading=true,
    // but the fetch Promise is still pending so loading stays true
    await act(async () => { vi.advanceTimersByTime(250); });

    expect(screen.getByText("…")).toBeInTheDocument();

    await act(async () => {
      resolveFetch({ ok: true, json: async () => ({ completions: [], words: [], message: "" }) });
      await vi.runAllTimersAsync();
    });

    expect(screen.queryByText("…")).not.toBeInTheDocument();
  });

  it("debounces: sends only one request after rapid input changes", async () => {
    global.fetch = mockFetch({ completions: [], words: [], message: "" });
    render(<App />);
    const textarea = screen.getByPlaceholderText(/start typing/i);

    // Fire several changes quickly — each resets the debounce timer
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
