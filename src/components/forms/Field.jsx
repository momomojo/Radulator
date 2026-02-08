import React, { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import FieldLabel from "./FieldLabel";

function FileImportField({ f, onBatch }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setStatus(null);
    try {
      const result = await f.onImport(file, onBatch);
      setStatus(result);
    } catch {
      setStatus({ success: false, error: "Unexpected error reading file." });
    }
    setLoading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-2 md:col-span-2">
      <FieldLabel label={f.label} subLabel={f.subLabel} />
      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept={f.accept || ".csv"}
          onChange={handleFile}
          className="hidden"
          id={f.id}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-input bg-background text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          {loading ? "Importing..." : "Import from CSV"}
        </button>
      </div>
      {status && (
        <p
          className={`text-sm ${status.success ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
        >
          {status.success ? status.message : status.error}
        </p>
      )}
    </div>
  );
}

/**
 * Generic Field Renderer
 * Renders form fields based on field type configuration
 * Supports: number, date, textarea, select, radio, checkbox, file-import
 */
function Field({ f, val, on, onBatch }) {
  if (f.type === "file-import") {
    return <FileImportField f={f} onBatch={onBatch} />;
  }
  if (f.type === "textarea") {
    return (
      <div className="space-y-1 md:col-span-2">
        <FieldLabel
          htmlFor={f.id}
          label={f.label}
          subLabel={f.subLabel}
          helpText={f.helpText}
        />
        <textarea
          id={f.id}
          className="w-full border border-input bg-background text-foreground rounded-md p-2 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent font-mono text-sm placeholder:text-muted-foreground transition-colors"
          value={val ?? ""}
          onChange={(e) => on(f.id, e.target.value)}
          placeholder={f.subLabel}
        />
      </div>
    );
  }
  if (f.type === "select") {
    return (
      <div className="space-y-1">
        <FieldLabel htmlFor={f.id} label={f.label} helpText={f.helpText} />
        <Select
          id={f.id}
          value={val || ""}
          onChange={(e) => on(f.id, e.target.value)}
          placeholder="Select…"
        >
          {f.opts.map((o) => {
            // Support both string options and {value, label} objects
            const optValue = typeof o === "object" ? o.value : o;
            const optLabel = typeof o === "object" ? o.label : o;
            return (
              <option key={optValue} value={optValue}>
                {optLabel}
              </option>
            );
          })}
        </Select>
      </div>
    );
  }
  if (f.type === "radio") {
    return (
      <div className="space-y-2 md:col-span-2">
        <FieldLabel
          label={f.label}
          subLabel={f.subLabel}
          helpText={f.helpText}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {f.opts.map((opt) => (
            <div key={opt.value} className="flex items-center space-x-2">
              <input
                id={`${f.id}-${opt.value}`}
                type="radio"
                name={f.id}
                value={opt.value}
                checked={val === opt.value}
                onChange={(e) => on(f.id, e.target.value)}
                className="text-primary focus:ring-primary accent-primary"
              />
              <Label
                htmlFor={`${f.id}-${opt.value}`}
                className="text-sm font-normal cursor-pointer text-foreground"
              >
                {opt.label}
              </Label>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (f.type === "checkbox") {
    return (
      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <Switch
            id={f.id}
            checked={!!val}
            onCheckedChange={(c) => on(f.id, c)}
          />
          <FieldLabel htmlFor={f.id} label={f.label} helpText={f.helpText} />
        </div>
      </div>
    );
  }
  return (
    <div className={`space-y-1 ${f.type === "date" ? "md:col-span-2" : ""}`}>
      <FieldLabel
        htmlFor={f.id}
        label={f.label}
        subLabel={f.subLabel}
        helpText={f.helpText}
      />
      <Input
        id={f.id}
        type={f.type}
        value={val ?? ""}
        onChange={(e) => on(f.id, e.target.value)}
        placeholder={f.subLabel}
      />
    </div>
  );
}

export default Field;
