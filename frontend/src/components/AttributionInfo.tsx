import { InfoIcon } from "lucide-react";
import { Fragment, useState } from "react";
import { Link } from "react-router-dom";

interface Props {
  createdBy: string | null | undefined;
  createdAt: string | null | undefined;
  updatedBy?: string | null;
  updatedAt?: string | null;
  rehearsalId?: number | null;
  rehearsalLabel?: string | null;
  productionId?: number;
}

function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day}/${month}/${year} at ${time}`;
}

export default function AttributionInfo({
  createdBy,
  createdAt,
  updatedBy,
  updatedAt,
  rehearsalId,
  rehearsalLabel,
  productionId,
}: Props) {
  const [open, setOpen] = useState(false);
  if (!createdBy && !createdAt && !updatedBy) return null;

  const createdLine =
    createdBy && createdAt
      ? `Created by ${createdBy} on ${formatStamp(createdAt)}`
      : createdBy
        ? `Created by ${createdBy}`
        : createdAt
          ? `Created on ${formatStamp(createdAt)}`
          : null;
  const updatedLine =
    updatedBy && updatedAt && updatedAt !== createdAt
      ? `Last updated by ${updatedBy} on ${formatStamp(updatedAt)}`
      : null;

  return (
    <Fragment>
      <button
        type="button"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={createdLine ?? "Attribution"}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <InfoIcon className="size-3.5" />
      </button>
      {open && (
        <span className="basis-full rounded-md border border-border bg-muted/40 p-2 text-left text-xs text-foreground">
          {createdLine && <span className="block">{createdLine}</span>}
          {updatedLine && <span className="mt-1 block">{updatedLine}</span>}
          {rehearsalId != null && productionId != null && (
            <Link
              className="mt-1 block text-primary underline-offset-2 hover:underline"
              to={`/productions/${productionId}/rehearsals/${rehearsalId}`}
              onClick={(event) => event.stopPropagation()}
            >
              During {rehearsalLabel || "rehearsal"}
            </Link>
          )}
        </span>
      )}
    </Fragment>
  );
}
