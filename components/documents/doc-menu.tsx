"use client"

import { useState, useTransition } from "react"
import { MoreHorizontal, Pencil, Trash2, Unlink } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { deleteDocument } from "@/app/(app)/documents/actions"

/**
 * The ⋯ menu on a document or photo. Edit and Remove only appear when given; Delete always asks first,
 * because it removes the file for everyone and can't be undone.
 */
export function DocMenu({
  doc,
  onEdit,
  onRemove,
  removeLabel,
  onDeleted,
}: {
  doc: { id: string; title: string; isLink?: boolean }
  onEdit?: () => void
  onRemove?: () => void
  /** e.g. "Remove From Part" */
  removeLabel?: string
  onDeleted?: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Options for ${doc.title}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {onEdit ? (
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil />
              Edit Details
            </DropdownMenuItem>
          ) : null}
          {onRemove ? (
            <DropdownMenuItem onSelect={onRemove}>
              <Unlink />
              {removeLabel ?? "Remove From Here"}
            </DropdownMenuItem>
          ) : null}
          {onEdit || onRemove ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDelete open={confirm} onOpenChange={setConfirm} doc={doc} onDeleted={onDeleted} />
    </>
  )
}

/** "Delete this for good?" — shared by the menu and any plain Delete button. */
export function ConfirmDelete({
  open,
  onOpenChange,
  doc,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  doc: { id: string; title: string; isLink?: boolean }
  onDeleted?: () => void
}) {
  const [pending, start] = useTransition()
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{doc.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {doc.isLink
              ? "The link is removed from everywhere it's filed, for everyone in the household. This can't be undone."
              : "The file is deleted for everyone in the household and removed from everywhere it's filed. This can't be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
              variant="destructive-solid"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault() // keep the dialog open until it's done
                start(async () => {
                  const r = await deleteDocument(doc.id)
                  if (!r.ok) {
                    toast.error(r.error)
                    onOpenChange(false)
                    return
                  }
                  toast("Deleted")
                  onOpenChange(false)
                  onDeleted?.()
                })
              }}
            >
              <Trash2 />
              Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
