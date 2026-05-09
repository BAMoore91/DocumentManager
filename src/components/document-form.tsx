import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { uploadDocument } from "@/lib/actions/documents";

type Owner = { id: string; name: string | null; email: string };
type RequiredDoc = { id: string; name: string };
type SiteOption = { id: string; name: string };

export function DocumentForm({
  owners,
  lockedOwnerId,
  requiredDocuments = [],
  sites = [],
}: {
  owners: Owner[];
  lockedOwnerId?: string;
  requiredDocuments?: RequiredDoc[];
  sites?: SiteOption[];
}) {
  return (
    <form action={uploadDocument} encType="multipart/form-data" className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
          <Label>Owner</Label>
          {lockedOwnerId ? (
            <>
              <input type="hidden" name="ownerId" value={lockedOwnerId} />
              <Input value={owners.find((o) => o.id === lockedOwnerId)?.email ?? ""} disabled />
            </>
          ) : (
            <Select name="ownerId" required>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name ?? o.email}
                </option>
              ))}
            </Select>
          )}
        </div>
        <div>
          <Label>Site (optional)</Label>
          <Select name="siteId" defaultValue="">
            <option value="">— No site —</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label>Fulfills requirement (optional)</Label>
          <Select name="requiredDocumentId" defaultValue="">
            <option value="">— None —</option>
            {requiredDocuments.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          {requiredDocuments.length === 0 ? (
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              Required documents are configured under Organization Settings.
            </p>
          ) : null}
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
        <SubmitButton pendingLabel="Uploading…">Upload</SubmitButton>
      </div>
    </form>
  );
}
