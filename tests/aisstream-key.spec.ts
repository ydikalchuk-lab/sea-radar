import { expect, test } from '@playwright/test';

const environmentKey = 'AISSTREAM_API_KEY';

test('returns null when the AISStream key is missing', async () => {
  const originalValue = process.env[environmentKey];
  delete process.env[environmentKey];

  try {
    const { getAisstreamApiKey } = await import('../src/lib/aisstream/key');
    expect(getAisstreamApiKey()).toBeNull();
  } finally {
    if (originalValue === undefined) {
      delete process.env[environmentKey];
    } else {
      process.env[environmentKey] = originalValue;
    }
  }
});

test('returns null when the AISStream key is blank', async () => {
  const originalValue = process.env[environmentKey];
  process.env[environmentKey] = ' \t\n ';

  try {
    const { getAisstreamApiKey } = await import('../src/lib/aisstream/key');
    expect(getAisstreamApiKey()).toBeNull();
  } finally {
    if (originalValue === undefined) {
      delete process.env[environmentKey];
    } else {
      process.env[environmentKey] = originalValue;
    }
  }
});
