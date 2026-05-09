"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Print / PDF" }: { label?: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={() => window.print()}
      className="print:hidden"
    >
      <Printer className="h-4 w-4" /> {label}
    </Button>
  );
}
