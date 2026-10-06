import type { AIProvider, PostInput, PostOutput } from "./provider";

const schema = {
  type: "object",
  properties: {
    title: { type: "string" },
    body: { type: "string" },
    hook: { type: "string" },
    platform: { type: "string" },
    style: { type: "string" },
    length: { type: "string" }
  },
  required: ["title", "body", "hook", "platform", "style", "length"],
  additionalProperties: false
};

export class OpenAIProvider implements AIProvider {
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async createPost(input: PostInput) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        instructions:
          "You are Creator AI. Create publish-ready social content. Preserve the user's requested language. Follow the requested platform, style, and length. Return only the structured object.",
        input: [
          {
            role: "user",
            content: `Topic: ${input.topic}\nPlatform: ${input.platform}\nStyle: ${input.style}\nLength: ${input.length}`,
          },
        ],
        text: { format: { type: "json_schema", name: "creator_post", strict: true, schema } },
      }),
    });

    if (!response.ok) throw new Error(`openai_http_${response.status}`);
    const data = (await response.json()) as {
      output_text?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    if (!data.output_text) throw new Error("openai_empty_output");

    const output = JSON.parse(data.output_text) as PostOutput;
    return {
      output,
      model: this.model,
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
    };
  }
}
