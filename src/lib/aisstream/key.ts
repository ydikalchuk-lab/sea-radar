export function getAisstreamApiKey(): string | null {
  const key = process.env.AISSTREAM_API_KEY?.trim();

  return key ? key : null;
}
