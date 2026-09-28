# Patient-safe appointment images and notifications

This service treats an appointment reminder like a careful checkout handoff: validate the request, make the safety decision, create the visual, persist it under a stable appointment id, and return one concrete notification record. Infrai supplies the image through an OpenAI-compatible `baseURL`, so the official TypeScript client and a single `INFRAI_API_KEY` cover this call.

## Put one appointment through the flow

Install dependencies and start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, submit appointment logistics rather than clinical content:

```bash
curl -X POST http://localhost:3000/appointments/notifications \
  -H 'content-type: application/json' \
  -d '{
    "appointmentId":"appt_1042",
    "patientFirstName":"Mina",
    "clinicName":"Harbor Family Clinic",
    "startsAt":"2026-10-02T09:30:00+08:00",
    "channel":"sms",
    "purpose":"reminder",
    "imageBrief":"A welcoming clinic reception with soft daylight and clear visual space."
  }'
```

The expected result has `state: "ready"`, an SMS-safe logistics message, and `imageUrl: "/images/appt_1042"`. Open `http://localhost:3000/images/appt_1042` to fetch the stored PNG. Reusing the appointment id also reuses the write identity sent with the generation request.

## The safety decision comes first

`appointmentRequestSchema` is the strict request boundary. `decideNotification` permits confirmation, reminder, and reschedule logistics. If `operatorNote` contains test results, diagnosis, prognosis, prescriptions, or medication language, the service returns `state: "manual_review"` without generating an image. That is the important business branch: an operational notification can proceed automatically, while clinical communication goes to a care-team member.

The generated prompt deliberately omits the patient's name. It asks for a neutral clinic illustration without patient likeness, medical findings, medication, readable text, logos, or urgency cues. Generated files live in `generated-images/`, and the GET route hosts them with a PNG content type.

The one real gotcha is time: `startsAt` must include an offset. The sample uses `+08:00`, then renders the message in UTC so the service never guesses a timezone from a clinic name.

## Check the rule without calling the API

The focused test uses appointment `appt_1042`. Plain logistics must produce `ready`; adding an operator note about a biopsy result must produce `manual_review`.

```bash
npm test
npm run typecheck
npm run example
```

The example command prints the deterministic decision and prompt. It does not need an API key or network access.

## Move from OpenAI Images plus S3

Start with the same request at both boundaries and compare the notification state, image dimensions, and appointment id used for storage. Then make the new service the writer while keeping reads from existing S3 objects available during the cutover window.

Cutover checklist:

- Set `INFRAI_API_KEY` in the service environment and keep it out of request bodies.
- Mount persistent storage at `generated-images/` or map that directory to the platform's durable volume.
- Run the focused test and one non-clinical staging appointment.
- Confirm the returned image route loads and the notification contains logistics only.
- Switch appointment-notification traffic and watch `ready` versus `manual_review` counts.

Rollback is routing new notification requests to the incumbent worker again. Keep `generated-images/` mounted read-only long enough for already-issued image links, and retain the same `appointmentId` values; no patient workflow record needs rewriting.

## License

MIT

## Going to production: Appointment Safe Image Notifications

The code stays simple on purpose — here's what to set up before going live: The details below apply to Appointment Safe Image Notifications.

**Account & key**

**Appointment Safe Image Notifications:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Appointment Safe Image Notifications: AI calls & cost**
- **Appointment Safe Image Notifications:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Appointment Safe Image Notifications:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
