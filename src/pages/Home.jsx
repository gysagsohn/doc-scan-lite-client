// src/pages/Home.jsx
import Dropzone from "../components/Dropzone.jsx";

export default function Home() {
  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "2rem" }}>
      <header style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ margin: 0, color: "var(--primary)" }}>Doc Scan (lite)</h1>
        <p style={{ marginTop: "0.5rem", opacity: 0.9 }}>
          Upload a PDF (first 2 pages) or an image. We’ll extract key fields and push to a private Google Sheet.
        </p>
      </header>
      <Dropzone />
      <footer style={{ marginTop: "1.25rem", fontSize: 12, opacity: 0.7 }}>
        Uses OpenAI Vision ({import.meta.env?.VITE_OPENAI_MODEL || "gpt-4o-mini"}) • Max 10MB • Inter font • Green palette
      </footer>
    </main>
  );
}
