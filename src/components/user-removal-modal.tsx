"use client";

import { useState } from "react";
import { X, Archive, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { archiveUser, deleteUser } from "@/lib/actions/users";

export function UserRemovalModal({
  userId,
  userName,
  userEmail,
}: {
  userId: string;
  userName: string | null;
  userEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const matches = confirmEmail.trim().toLowerCase() === userEmail.toLowerCase();
  const display = userName ?? userEmail;

  function close() {
    setOpen(false);
    setConfirmEmail("");
  }

  return (
    <>
      <Button
        type="button"
        variant="danger"
        size="sm"
        onClick={() => setOpen(true)}
        className="print:hidden"
      >
        Remove
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 print:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="relative my-8 w-full max-w-2xl rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Remove {display}?</h2>
                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                  Choose what happens to this member's data.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded-md p-1 hover:bg-[hsl(var(--muted))]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-md border border-[hsl(var(--border))] p-4">
                <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                  <Archive className="h-4 w-4" /> Archive (keep documents)
                </div>
                <p className="mb-3 text-sm text-[hsl(var(--muted-foreground))]">
                  The user can no longer sign in. Their documents, training
                  records, attendances, and history stay attached to their
                  archived profile so audit trails are preserved. You can
                  restore them later.
                </p>
                <form
                  action={archiveUser}
                  onSubmit={() => setTimeout(() => close(), 0)}
                >
                  <input type="hidden" name="id" value={userId} />
                  <Button type="submit" variant="secondary" size="sm">
                    Archive user
                  </Button>
                </form>
              </div>

              <div className="rounded-md border border-red-200 bg-red-50/40 p-4 dark:border-red-900/40 dark:bg-red-950/20">
                <div className="mb-1 flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
                  <Trash2 className="h-4 w-4" /> Permanently delete
                </div>
                <p className="mb-3 text-sm text-[hsl(var(--muted-foreground))]">
                  Removes the user <strong>and</strong> all associated data —
                  documents, training records, attendances, signatures, and
                  history. This cannot be undone.
                </p>
                <form
                  action={deleteUser}
                  onSubmit={(e) => {
                    if (!matches) {
                      e.preventDefault();
                      return;
                    }
                    setTimeout(() => close(), 0);
                  }}
                  className="space-y-2"
                >
                  <input type="hidden" name="id" value={userId} />
                  <div>
                    <Label htmlFor={`confirm-${userId}`} className="text-xs">
                      Type{" "}
                      <span className="font-mono text-[hsl(var(--foreground))]">
                        {userEmail}
                      </span>{" "}
                      to confirm
                    </Label>
                    <Input
                      id={`confirm-${userId}`}
                      name="confirmEmail"
                      autoComplete="off"
                      value={confirmEmail}
                      onChange={(e) => setConfirmEmail(e.target.value)}
                      placeholder={userEmail}
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="danger"
                    size="sm"
                    disabled={!matches}
                  >
                    Permanently delete
                  </Button>
                </form>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="button" variant="secondary" size="sm" onClick={close}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
