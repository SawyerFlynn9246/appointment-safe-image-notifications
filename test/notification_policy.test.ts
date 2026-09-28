import assert from "node:assert/strict";
import test from "node:test";
import { appointmentRequestSchema, decideNotification } from "../src/notification_policy.ts";

const baseRequest = {
  appointmentId: "appt_1042",
  patientFirstName: "Mina",
  clinicName: "Harbor Family Clinic",
  startsAt: "2026-10-02T09:30:00+08:00",
  channel: "sms" as const,
  purpose: "reminder" as const,
  imageBrief: "A welcoming clinic reception with soft daylight and clear visual space."
};

test("appointment logistics are ready but clinical notes require review", () => {
  const ready = decideNotification(appointmentRequestSchema.parse(baseRequest));
  assert.equal(ready.state, "ready");
  if (ready.state === "ready") {
    assert.match(ready.message, /appointment.*coming up/);
    assert.doesNotMatch(ready.imagePrompt, /Mina/);
  }

  const held = decideNotification(appointmentRequestSchema.parse({
    ...baseRequest,
    operatorNote: "Patient asked whether the biopsy test result is positive."
  }));
  assert.deepEqual(held, {
    state: "manual_review",
    reason: "The operator note contains clinical content; a care-team member must review it."
  });
});
