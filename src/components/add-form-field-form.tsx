"use client";

import { useState } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addFormField } from "@/lib/actions/forms";

const TYPE_OPTIONS = [
  { value: "TEXT", label: "Short text" },
  { value: "TEXTAREA", label: "Long text" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "CHECKBOX", label: "Single checkbox (yes / no)" },
  { value: "CHECKBOXES", label: "Multiple choice (checkboxes)" },
  { value: "SELECT", label: "Dropdown" },
];

const ACCEPTS_PLACEHOLDER = new Set(["TEXT", "TEXTAREA", "NUMBER"]);
const ACCEPTS_OPTIONS = new Set(["SELECT", "CHECKBOXES"]);

export function AddFormFieldForm({ formId }: { formId: string }) {
  const [type, setType] = useState("TEXT");
  const showPlaceholder = ACCEPTS_PLACEHOLDER.has(type);
  const showOptions = ACCEPTS_OPTIONS.has(type);

  return (
    <form action={addFormField} className="space-y-4">
      <input type="hidden" name="formId" value={formId} />

      <div>
        <Label htmlFor="field-label">Field label</Label>
        <Input
          id="field-label"
          name="label"
          required
          maxLength={200}
          placeholder="What's the question?"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="field-type">Type</Label>
          <Select
            id="field-type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            required
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" name="required" className="h-4 w-4" />
            Required
          </label>
        </div>
      </div>

      {showPlaceholder ? (
        <div>
          <Label htmlFor="field-placeholder">Placeholder (optional)</Label>
          <Input id="field-placeholder" name="placeholder" maxLength={200} />
        </div>
      ) : null}

      {showOptions ? (
        <div>
          <Label htmlFor="field-options">
            Options <span className="text-[hsl(var(--muted-foreground))]">(one per line)</span>
          </Label>
          <Textarea
            id="field-options"
            name="options"
            required
            maxLength={2000}
            placeholder={"Option 1\nOption 2\nOption 3"}
          />
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Each line becomes one {type === "SELECT" ? "dropdown choice" : "checkbox"}.
          </p>
        </div>
      ) : null}

      <Button type="submit">Add field</Button>
    </form>
  );
}
