import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { expirationStatus, formatBytes, formatDate } from "@/lib/utils";
import { deleteDocument } from "@/lib/actions/documents";

type Doc = {
  id: string;
  name: string;
  type: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  expirationDate: Date;
  owner?: { name: string | null; email: string } | null;
  organization?: { name: string } | null;
};

export function DocumentTable({
  docs,
  showOwner = false,
  showOrganization = false,
}: {
  docs: Doc[];
  showOwner?: boolean;
  showOrganization?: boolean;
}) {
  const cols = 6 + (showOwner ? 1 : 0) + (showOrganization ? 1 : 0);
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-[hsl(var(--border))] text-left text-xs uppercase text-[hsl(var(--muted-foreground))]">
          <tr>
            <th className="px-4 py-3">Document</th>
            <th className="px-4 py-3">Type</th>
            {showOrganization ? <th className="px-4 py-3">Organization</th> : null}
            {showOwner ? <th className="px-4 py-3">Owner</th> : null}
            <th className="px-4 py-3">Expires</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Size</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id} className="border-b border-[hsl(var(--border))] last:border-0">
              <td className="px-4 py-3">
                <Link href={d.fileUrl} target="_blank" className="font-medium hover:underline">
                  {d.name}
                </Link>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">{d.fileName}</div>
              </td>
              <td className="px-4 py-3">{d.type}</td>
              {showOrganization ? <td className="px-4 py-3">{d.organization?.name ?? "—"}</td> : null}
              {showOwner ? <td className="px-4 py-3">{d.owner?.name ?? d.owner?.email ?? "—"}</td> : null}
              <td className="px-4 py-3">{formatDate(d.expirationDate)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={expirationStatus(d.expirationDate)} />
              </td>
              <td className="px-4 py-3">{formatBytes(d.fileSize)}</td>
              <td className="px-4 py-3 text-right">
                <form action={deleteDocument}>
                  <input type="hidden" name="id" value={d.id} />
                  <Button type="submit" variant="danger" size="sm">
                    Delete
                  </Button>
                </form>
              </td>
            </tr>
          ))}
          {docs.length === 0 ? (
            <tr>
              <td colSpan={cols} className="px-4 py-6 text-center text-[hsl(var(--muted-foreground))]">
                No documents yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </Card>
  );
}
