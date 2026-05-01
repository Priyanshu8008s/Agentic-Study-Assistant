import { useState, useRef } from "react";

export default function DocumentUpload({ onUploadComplete }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("idle"); // idle, uploading, success, error
  const [statusMessage, setStatusMessage] = useState("");
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file) => {
    if (file.type !== "application/pdf") {
      setUploadStatus("error");
      setStatusMessage("Please upload a valid PDF file.");
      return;
    }

    setUploadStatus("uploading");
    setStatusMessage(`Parsing and embedding ${file.name}...`);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/knowledge/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const result = await response.json();
      setUploadStatus("success");
      setStatusMessage(`Successfully processed ${result.chunksProcessed} chunks from ${file.name}. The agent will now use this context.`);
      if (onUploadComplete && result.outline) {
        onUploadComplete(result.outline);
      }
    } catch (error) {
      setUploadStatus("error");
      setStatusMessage(error.message);
    }
  };

  return (
    <div className="rounded-[2rem] border border-ink/10 bg-white/75 p-6 shadow-glow backdrop-blur">
      <h2 className="mb-4 text-lg font-semibold text-ink">Knowledge Base</h2>
      <p className="mb-4 text-sm text-ink/70">
        Upload academic materials (PDFs) to ground the agent's responses.
      </p>

      <div
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? "border-pine bg-pine/5"
            : "border-ink/20 hover:border-pine/50 hover:bg-pine/5"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="application/pdf"
          onChange={handleFileSelect}
        />
        
        <svg
          className="mb-3 h-8 w-8 text-ink/40"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        
        <p className="text-sm font-medium text-ink/80">
          {isDragging ? "Drop PDF here" : "Click or drag PDF to upload"}
        </p>
      </div>

      {uploadStatus === "uploading" && (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-ink/5 px-4 py-3 text-sm text-ink/70">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {statusMessage}
        </div>
      )}

      {uploadStatus === "success" && (
        <div className="mt-4 rounded-xl bg-pine/10 px-4 py-3 text-sm text-pine">
          ✓ {statusMessage}
        </div>
      )}

      {uploadStatus === "error" && (
        <div className="mt-4 rounded-xl bg-ember/10 px-4 py-3 text-sm text-ember">
          ✗ {statusMessage}
        </div>
      )}
    </div>
  );
}
