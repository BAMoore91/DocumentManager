import { Card, CardTitle, CardValue } from "@/components/ui/card";

export type Metric = { label: string; value: number | string; tone?: "default" | "warning" | "danger" | "success" };

const tones = {
  default: "",
  warning: "text-amber-600 dark:text-amber-300",
  danger: "text-red-600 dark:text-red-300",
  success: "text-emerald-600 dark:text-emerald-300",
};

export function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((m) => (
        <Card key={m.label}>
          <CardTitle>{m.label}</CardTitle>
          <CardValue className={tones[m.tone ?? "default"]}>{m.value}</CardValue>
        </Card>
      ))}
    </div>
  );
}
