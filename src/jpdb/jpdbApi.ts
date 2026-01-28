
const BASE_URL = "https://jpdb.io/api/v1";

export type JpdbDeck = { id: number, name: string };


type RowObject = Record<string, unknown>;

function rowsToObjects(
  fields: readonly string[],
  rows: readonly unknown[][],
  opts?: { rename?: Record<string, string> }
): RowObject[] {

  const rename = opts?.rename ?? {};
  return rows.map((row) => {
    const obj: RowObject = {};
    const n = Math.min(fields.length, row.length);

    for (let i = 0; i < n; i++) {
      const fieldId = fields[i];
      const key = rename[fieldId] ?? fieldId;
      obj[key] = row[i];
    }
    // If JPDB ever returns more values than requested fields, keep them in a bucket.
    if (row.length > fields.length) {
      obj.__extra = row.slice(fields.length);
    }
    return obj;
  });
}
export async function jpdbParse(
	apiKey: string,
	text: string,
	tokenFields: string[],
	vocabFields: string[],
): Promise<{ tokens: RowObject[], vocabulary: RowObject[] }> {

	const response = await fetch(`${BASE_URL}/parse`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: text,
      token_fields: tokenFields,
      vocabulary_fields: vocabFields,
      position_length_encoding: "utf16",
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as any;
    const msg = body?.error_message ?? body?.message ?? `Request failed`;
    throw new Error(`(${response.status}) ${msg}`);
  }
  const payload = (await response.json()) as { tokens: unknown[][], vocabulary: unknown[][] };
  return {
    tokens: rowsToObjects(tokenFields, payload.tokens),
    vocabulary: rowsToObjects(vocabFields, payload.vocabulary),
  };
}

export async function jpdbListUserDecks(apiKey: string): Promise<JpdbDeck[]> {

  const response = await fetch(`${BASE_URL}/list-user-decks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: ["id", "name"],
    }),
  });

  if (!response.ok) {
    throw new Error(`JPDB request failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    decks?: [number, string][];
  };
  return (payload.decks ?? []).map(([id, name]) => ({ id, name }));
}

export async function jpdbAddVocabulary(apiKey: string, deckId: number, vidSidPairs: [number, number][]) {

  const response = await fetch(`${BASE_URL}/deck/add-vocabulary`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: deckId,
      vocabulary: vidSidPairs,
      replace_existing_occurences: true, // Re-attempting this shouldn't add more to the deck,
    }),                                  // esp. since coverage bar will appear when unwanted.
  });

  if (!response.ok) {
    const body = await response.json();
    throw new Error(`(${response.status}) ${body.error_message}`);
  }
}