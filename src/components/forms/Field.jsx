import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import FieldLabel from "./FieldLabel";

/**
 * Generic Field Renderer
 * Renders form fields based on field type configuration
 * Supports: number, date, textarea, select, radio, checkbox
 */
function Field({ f, val, on }) {
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
        <FieldLabel label={f.label} helpText={f.helpText} />
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
