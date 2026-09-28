import { z } from "zod";

export const appointmentRequestSchema = z.object({
  appointmentId: z.string().regex(/^[A-Za-z0-9_-]{3,64}$/),
  patientFirstName: z.string().trim().min(1).max(60),
  clinicName: z.string().trim().min(1).max(120),
  startsAt: z.string().datetime({ offset: true }),
  channel: z.enum(["sms", "email", "portal"]),
  purpose: z.enum(["confirmation", "reminder", "reschedule"]),
  imageBrief: z.string().trim().min(10).max(400),
  operatorNote: z.string().trim().max(500).optional()
}).strict();

export type AppointmentRequest = z.infer<typeof appointmentRequestSchema>;

export type NotificationDecision =
  | { state: "ready"; message: string; imagePrompt: string }
  | { state: "manual_review"; reason: string };

const clinicalTerms = /\b(diagnos(?:is|ed)|test results?|prescription|medication|prognosis|biopsy|positive|negative)\b/i;

export function decideNotification(request: AppointmentRequest): NotificationDecision {
  if (request.operatorNote && clinicalTerms.test(request.operatorNote)) {
    return {
      state: "manual_review",
      reason: "The operator note contains clinical content; a care-team member must review it."
    };
  }

  const when = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(new Date(request.startsAt));
  const action = request.purpose === "reschedule" ? "needs rescheduling" : `is ${request.purpose === "reminder" ? "coming up" : "confirmed"}`;

  return {
    state: "ready",
    message: `${request.patientFirstName}, your appointment with ${request.clinicName} ${action} for ${when} UTC. Contact the clinic if you need to make a change.`,
    imagePrompt: [
      "Create a calm, inclusive healthcare appointment illustration.",
      request.imageBrief,
      "No patient likeness, medical findings, medication, readable text, logos, or urgency cues."
    ].join(" ")
  };
}
