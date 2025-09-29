import Dropzone from "./components/Dropzone";
import "./styles/theme.css";

export default function App() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem" }}>
      <h1 style={{ marginTop: 0, color: "var(--primary)" }}>Doc Scan (Lite)</h1>
      <p style={{ marginTop: 0 }}>
        Upload a PDF or image. We’ll parse key fields with AI and append to a Google Sheet.
      </p>
      <Dropzone />
    </main>
  );
}
