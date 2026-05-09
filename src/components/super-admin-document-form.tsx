"use client";

import { useMemo, useState } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { uploadDocument } from "@/lib/actions/documents";

type User = { id: string; name: string | null; email: string };
type RequiredDoc = { id: string; name: string };
type Org = { id: string; name: string; users: User[]; requiredDocuments: RequiredDoc[] };

export function SuperAdminDocumentForm({ organizations }: { organizations: Org[] }) {
  const [orgId, setOrgId] = useState<string>(organizations[0]?.id ?? "");

  const selectedOrg = useMemo(
    () => organizations.find((o) => o.id === orgId),
    [organizations, orgId],
  );
  const users = selectedOrg?.users ?? [];
  const requiredDocs = selectedOrg?.requiredDocuments ?? [];

  if (organizations.length === 0) {
    return (
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Create an organization with at least one user before uploading documents.
      </p>
    );
  }

  return (
    <>
      <form
        action={uploadDocument}
        encType="multipart/form-data"
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        <div>
          <Label>Organization</Label>
          <Select value={orgId} onChange={(e) => setOrgId(e.target.value)} required>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Assign to user</Label>
          <Select name="ownerId" required disabled={users.length === 0}>
            {users.length === 0 ? (
              <option value="">No users in this organization</option>
            ) : (
              users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email}
                </option>
              ))
            )}
          </Select>
        </div>
        <div>
          <Label>Document name</Label>
          <Input name="name" required placeholder="OSHA 30 Certificate" />
        </div>
        <div>
          <Label>Type</Label>
          <Select name="type" required defaultValue="Certificate">
            <option>Certificate</option>
            <option>License</option>
            <option>Insurance</option>
            <option>Training</option>
            <option>Compliance</option>
            <option>Other</option>
          </Select>
        </div>
        <div>
          <Label>Expiration date</Label>
          <Input name="expirationDate" type="date" required />
        </div>
        <div>
          <Label>Fulfills requirement (optional)</Label>
          <Select name="requiredDocumentId" defaultValue="">
            <option value="">— None —</option>
            {requiredDocs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label>File (PDF, image, etc — max 15MB)</Label>
          <Input name="file" type="file" required accept="application/pdf,image/*,.doc,.docx" />
        </div>
        <div className="md:col-span-2">
          <Label>Notes</Label>
          <Textarea name="notes" placeholder="Optional notes" />
        </div>
        <div className="md:col-span-2">
          <SubmitButton pendingLabel="Uploading…" disabled={users.length === 0}>
            Upload
          </SubmitButton>
        </div>
      </form>
    </>
  );
}
