import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { uploadDocument } from "@/lib/actions/documents";

type Owner = { id: string; name: string | null; email: string };

export function DocumentForm({ owners, lockedOwnerId }: { owners: Owner[]; lockedOwnerId?: string }) {
  return (
    <Card>
      <h2 className="mb-3 font-medium">Upload document</h2>
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
        <div className="md:col-span-2">
          <Label>File (PDF, image, etc — max 15MB)</Label>
          <Input name="file" type="file" required accept="application/pdf,image/*,.doc,.docx" />
        </div>
        <div className="md:col-span-2">
          <Label>Notes</Label>
          <Textarea name="notes" placeholder="Optional notes" />
        </div>
        <div className="md:col-span-2">
          <Button type="submit">Upload</Button>
        </div>
      </form>
    </Card>
  );
}
