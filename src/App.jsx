import Dropzone from "./components/Dropzone";
import "./styles/theme.css";

export default function App() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem" }}>
      <h1 style={{ 
        marginTop: 0, 
        marginBottom: "0.5rem",
        color: "var(--primary)",
        textAlign: "center"
      }}>
        Doc Scan (Lite)
      </h1>
      <p style={{ 
        marginTop: 0,
        marginBottom: "1.5rem",
        textAlign: "center",
        opacity: 0.9
      }}>
        Upload a PDF or image. We'll parse key fields with AI and append to a Google Sheet.
      </p>
      <Dropzone />
      <footer style={{ 
        marginTop: "2rem", 
        textAlign: "center", 
        fontSize: "0.85rem", 
        opacity: 0.7 
      }}>
        Uses OpenAI Vision (gpt-4o-mini) • Max 10MB • Optimized to 800px JPEG
      </footer>
    </main>
  );
}