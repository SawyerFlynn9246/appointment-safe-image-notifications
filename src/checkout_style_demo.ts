import { appointmentRequestSchema, decideNotification } from "./notification_policy.ts";

const appointment = appointmentRequestSchema.parse({
  appointmentId: "appt_1042",
  patientFirstName: "Mina",
  clinicName: "Harbor Family Clinic",
  startsAt: "2026-10-02T09:30:00+08:00",
  channel: "sms",
  purpose: "reminder",
  imageBrief: "A welcoming clinic reception with soft daylight and clear visual space."
});

console.log(JSON.stringify({ appointmentId: appointment.appointmentId, decision: decideNotification(appointment) }, null, 2));
