"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CloudOff } from "lucide-react";
import { enqueue } from "@/lib/offline-queue";
import { usePwa } from "@/components/pwa-provider";

type Field = {
  id: string;
  label: string;
  type:
    | "TEXT"
    | "TEXTAREA"
    | "NUMBER"
    | "DATE"
    | "CHECKBOX"
    | "CHECKBOXES"
    | "SELECT";
  required: boolean;
  placeholder: string | null;
  options: string | null;
};

export function FormFillRunner({
  formId,
  formName,
  fields,
}: {
  formId: string;
  formName: string;
  fields: Field[];
}) {
  const router = useRouter();
  const { online, refreshPending, showToast } = usePwa();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    const formEl = e.currentTarget;
    const fd = new FormData(formEl);

    const values: Record<string, unknown> = {};
    for (const field of fields) {
      const name = `f_${field.id}`;
      switch (field.type) {
        case "CHECKBOXES":
          values[field.id] = fd.getAll(name).map((v) => String(v));
          break;
        case "CHECKBOX":
          values[field.id] = fd.get(name) === "on";
          break;
        case "NUMBER": {
          const raw = fd.get(name);
          values[field.id] = raw === null || raw === "" ? null : Number(raw);
          break;
        }
        default:
          values[field.id] = fd.get(name) ?? "";
      }
    }

    const endpoint = `/api/forms/${formId}/submit`;
    const payload = { values };

    async function queueOffline() {
      await enqueue({
        endpoint,
        payload,
        label: `${formName} submission`,
      });
      await refreshPending();
      formEl.reset();
      showToast(
        "Saved offline — will upload automatically when you're back online",
        "info",
      );
    }

    if (!online) {
      try {
        await queueOffline();
      } catch {
        showToast("Could not save offline submission", "danger");
      }
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
      });
      if (res.ok) {
        showToast(`${formName} submitted`, "success");
        formEl.reset();
        router.refresh();
      } else {
        let msg = `Submission failed (${res.status})`;
        try {
          const json = await res.json();
          if (json?.error) msg = json.error;
        } catch {
          // ignore
        }
        showToast(msg, "danger");
      }
    } catch {
      // Network failure mid-submission — queue and inform
      try {
        await queueOffline();
      } catch {
        showToast("Could not save offline submission", "danger");
      }
    }
    setSubmitting(false);
  }

  return (
    <Card>
      {!online ? (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950 dark:text-amber-200">
          <CloudOff className="h-4 w-4" />
          You're offline. Submitting this form will save it locally and upload
          automatically when you're back online.
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-4">
        {fields.map((field) => {
          const opts = field.options ? (JSON.parse(field.options) as string[]) : [];
          const name = `f_${field.id}`;
          const labelEl = (
            <Label htmlFor={name}>
              {field.label}
              {field.required ? (
                <span className="ml-1 text-red-600 dark:text-red-300">*</span>
              ) : null}
            </Label>
          );

          switch (field.type) {
            case "TEXT":
              return (
                <div key={field.id}>
                  {labelEl}
                  <Input
                    id={name}
                    name={name}
                    required={field.required}
                    placeholder={field.placeholder ?? undefined}
                    maxLength={2000}
                  />
                </div>
              );
            case "TEXTAREA":
              return (
                <div key={field.id}>
                  {labelEl}
                  <Textarea
                    id={name}
                    name={name}
                    required={field.required}
                    placeholder={field.placeholder ?? undefined}
                    maxLength={10000}
                  />
                </div>
              );
            case "NUMBER":
              return (
                <div key={field.id}>
                  {labelEl}
                  <Input
                    id={name}
                    name={name}
                    type="number"
                    step="any"
                    required={field.required}
                    placeholder={field.placeholder ?? undefined}
                  />
                </div>
              );
            case "DATE":
              return (
                <div key={field.id}>
                  {labelEl}
                  <Input id={name} name={name} type="date" required={field.required} />
                </div>
              );
            case "CHECKBOX":
              return (
                <div key={field.id}>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" name={name} className="h-4 w-4" />
                    {field.label}
                    {field.required ? (
                      <span className="text-red-600 dark:text-red-300">*</span>
                    ) : null}
                  </label>
                </div>
              );
            case "CHECKBOXES":
              return (
                <div key={field.id}>
                  {labelEl}
                  <div className="flex flex-col gap-2 rounded-md border border-[hsl(var(--border))] px-3 py-2">
                    {opts.length === 0 ? (
                      <span className="text-sm text-[hsl(var(--muted-foreground))]">
                        No options configured.
                      </span>
                    ) : (
                      opts.map((opt) => (
                        <label
                          key={opt}
                          className="inline-flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            name={name}
                            value={opt}
                            className="h-4 w-4"
                          />
                          {opt}
                        </label>
                      ))
                    )}
                  </div>
                </div>
              );
            case "SELECT":
              return (
                <div key={field.id}>
                  {labelEl}
                  <Select id={name} name={name} required={field.required} defaultValue="">
                    <option value="" disabled>
                      Choose…
                    </option>
                    {opts.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Select>
                </div>
              );
            default:
              return null;
          }
        })}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : online ? "Submit" : "Save offline"}
        </Button>
      </form>
    </Card>
  );
}
