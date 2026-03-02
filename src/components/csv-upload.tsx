"use client";

import { useCallback, useState } from "react";

interface CSVUploadProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
}

export default function CSVUpload({
  onFileSelected,
  isLoading,
}: CSVUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (
        file.type === "text/csv" ||
        file.name.endsWith(".csv") ||
        file.type === "application/vnd.ms-excel"
      ) {
        setFileName(file.name);
        onFileSelected(file);
      } else {
        alert("Please upload a CSV file");
      }
    },
    [onFileSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        relative rounded-lg border-2 border-dashed p-8 text-center transition-all cursor-pointer
        ${
          isDragging
            ? "border-[#39ff14] bg-[#39ff14]/5 shadow-[0_0_30px_rgba(57,255,20,0.15)]"
            : "border-[#39ff14]/30 hover:border-[#39ff14]/60 hover:bg-[#39ff14]/5"
        }
        ${isLoading ? "opacity-50 pointer-events-none" : ""}
      `}
      onClick={() => document.getElementById("csv-input")?.click()}
    >
      <input
        id="csv-input"
        type="file"
        accept=".csv"
        onChange={handleInputChange}
        className="hidden"
      />

      <div className="flex flex-col items-center gap-3">
        <div className="text-4xl">
          {isLoading ? (
            <div className="w-10 h-10 border-2 border-[#39ff14]/30 border-t-[#39ff14] rounded-full animate-spin" />
          ) : (
            <svg
              className="w-10 h-10 text-[#39ff14]/60"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          )}
        </div>

        {isLoading ? (
          <p className="text-[#39ff14]/80 font-mono text-sm">
            Parsing CSV...
          </p>
        ) : fileName ? (
          <div>
            <p className="text-[#39ff14] font-mono text-sm font-bold">
              {fileName}
            </p>
            <p className="text-white/40 text-xs mt-1">
              Drop another file to replace
            </p>
          </div>
        ) : (
          <div>
            <p className="text-white/70 font-mono text-sm">
              Drop your Convoso ACID list CSV here
            </p>
            <p className="text-white/40 text-xs mt-1">
              or click to browse files
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
