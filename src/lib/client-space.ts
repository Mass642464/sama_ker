export type ClientRequestStatus = "received" | "qualifying" | "visit_planned" | "file_open" | "closed";

export type ClientAppointment = { id: string; startsAt: string; status: string };

export type ClientRequest = {
  id: string;
  title: string;
  message: string;
  status: ClientRequestStatus;
  createdAt: string | null;
  updatedAt: string | null;
  appointments: ClientAppointment[];
};

export function isClientSpaceConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_API_URL,
  );
}

export const requestStatusSteps: { status: Exclude<ClientRequestStatus, "closed">; label: string; description: string }[] = [
  { status: "received", label: "Demande reçue", description: "Votre demande est enregistrée et attend la prise en charge d’un conseiller." },
  { status: "qualifying", label: "En analyse", description: "Notre équipe étudie votre besoin et peut vous recontacter." },
  { status: "visit_planned", label: "Visite planifiée", description: "Une visite ou un rendez-vous a été convenu avec vous." },
  { status: "file_open", label: "Dossier ouvert", description: "Votre projet est suivi dans un dossier avec votre conseiller." },
];

export const appointmentStatusLabels: Record<string, string> = {
  "À confirmer": "À confirmer par votre conseiller",
  "Confirmé": "Confirmé",
  "Annulé": "Annulé",
};
