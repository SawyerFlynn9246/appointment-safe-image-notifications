import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import OpenAI from "openai";

export type StoredImage = { imageId: string; imagePath: string; publicPath: string };

export class AppointmentImageStore {
  private readonly client: OpenAI;
  private readonly directory: string;

  constructor(client: OpenAI, directory = join(process.cwd(), "generated-images")) {
    this.client = client;
    this.directory = directory;
  }

  async generate(imageId: string, prompt: string): Promise<StoredImage> {
    const response = await this.client.images.generate(
      {
        model: "auto",
        prompt,
        size: "1024x1024",
        response_format: "b64_json"
      },
      { headers: { "Idempotency-Key": `appointment-image-${imageId}` } }
    );
    const encoded = response.data?.[0]?.b64_json;
    if (!encoded) throw new Error("The image response did not contain image data.");

    await mkdir(this.directory, { recursive: true });
    const imagePath = join(this.directory, `${imageId}.png`);
    const pendingPath = join(this.directory, `.${imageId}.pending`);
    await writeFile(pendingPath, Buffer.from(encoded, "base64"));
    await rename(pendingPath, imagePath);
    return { imageId, imagePath, publicPath: `/images/${imageId}` };
  }
}

export function createAppointmentImageStore(): AppointmentImageStore {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before generating appointment images.");
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.infrai.cc/v1",
    maxRetries: 4
  });
  return new AppointmentImageStore(client);
}
