export type VisitWorkflow = {
  id: string;
  startsAt: string;
  status: string;
  purpose: string;
  pending: "none" | "cancel" | "reschedule" | "offer";
  proposedAt: string | null;
  revision: number;
};

export type AdminVisitWorkflow = VisitWorkflow & { contactName: string; contactEmail: string };
export type VisitAction = "confirm" | "accept_cancel" | "reject_request" | "propose" |
  "accept_offer" | "request_cancel" | "request_reschedule";

export function visitDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long", timeStyle: "short", timeZone: "Africa/Dakar",
  }).format(new Date(value));
}

export function visitDateInput(value: string) {
  const timestamp = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
    throw new Error("Choisissez une date et une heure futures.");
  }
  return new Date(timestamp).toISOString();
}
