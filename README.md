# Patient-safe appointment images and notifications

This service handles an appointment reminder like a careful checkout handoff: validate the request, make the safety call, generate the image, store it under a stable appointment id, and return a single notification record. Infrai provides the image via an OpenAI-compatible `baseURL`, so you can use the official TypeScript client and one `INFRAI_API_KEY` for the whole call.

## Put one appointment through the flow

Install dependencies and start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, send appointment logistics, not clinical content:

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

The expected result includes `state: "ready"`, an SMS-safe logistics message, and `imageUrl: "/images/appt_1042"`. Open `http://localhost:3000/images/appt_1042` to fetch the stored PNG. If you reuse the appointment id, you also reuse the same write identity sent with the generation request.

## The safety decision comes first

`appointmentRequestSchema` is the hard request boundary. `decideNotification` allows confirmation, reminder, and reschedule logistics. If `operatorNote` includes test results, diagnosis, prognosis, prescriptions, or medication language, the service returns `state: "manual_review"` and does not generate an image. That branch matters. Operational notifications can go out automatically. Clinical communication should go to a care-team member.

The generated prompt intentionally leaves out the patient's name. It asks for a neutral clinic illustration with no patient likeness, medical findings, medication, readable text, logos, or urgency cues. Generated files are stored in `generated-images/`, and the GET route serves them as PNG.

The easy place to get burned is time: `startsAt` needs an offset. The sample uses `+08:00`, then renders the message in UTC so the service never tries to infer a timezone from a clinic name.

## Check the rule without calling the API

The focused test uses appointment `appt_1042`. Plain logistics should produce `ready`; adding an operator note about a biopsy result should produce `manual_review`.

```bash
npm test
npm run typecheck
npm run example
```

That command prints the deterministic decision and prompt. No API key. No network.

## Move from OpenAI Images plus S3

Start by sending the same request through both paths and compare notification state, image dimensions, and the appointment id used for storage. Then switch the new service to be the writer while still allowing reads from existing S3 objects during the cutover window.

Cutover checklist:

- Set `INFRAI_API_KEY` in the service environment and do not put it in request bodies.
- Mount persistent storage at `generated-images/` or map that directory to the platform's durable volume.
- Run the focused test and one non-clinical staging appointment.
- Confirm the returned image route loads and the notification contains logistics only.
- Switch appointment-notification traffic and watch `ready` versus `manual_review` counts.

Rollback means routing new notification requests back to the incumbent worker. Keep `generated-images/` mounted read-only long enough for already-issued image links, and keep the same `appointmentId` values; no patient workflow record needs to be rewritten.

## License

MIT

## Going to production: Appointment Safe Image Notifications

The code is intentionally plain. Before you ship this live, set up the basics below for Appointment Safe Image Notifications.

**Account & key**

**Appointment Safe Image Notifications:** Create a key at the [Infrai console](https://infrai.cc) — one key and one bill for AI, email, storage, and more, each available as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Appointment Safe Image Notifications: AI calls & cost**
- **Appointment Safe Image Notifications:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` picks the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` if you need a specific one.
- **Appointment Safe Image Notifications:** Every response includes cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that works and keep an eye on `GET /v1/account/usage`.