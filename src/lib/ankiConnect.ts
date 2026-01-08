export type AnkiConnectNote = {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags: string[];
};

type AnkiConnectResponse<T> = {
  result: T;
  error: string | null;
};

const ANKI_CONNECT_URL = "http://127.0.0.1:8765";
const ANKI_CONNECT_VERSION = 5;

async function invokeAnkiConnect<T>(action: string, params?: Record<string, unknown>): Promise<T> {
  const response = await fetch(ANKI_CONNECT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, version: ANKI_CONNECT_VERSION, params }),
  });

  if (!response.ok) {
    throw new Error(`AnkiConnect HTTP ${response.status}: ${response.statusText}`);
  }

  const payload = (await response.json()) as AnkiConnectResponse<T>;

  if (payload.error) {
    throw new Error(payload.error);
  }

  return payload.result;
}

export async function fetchDeckNames(): Promise<string[]> {
  return invokeAnkiConnect<string[]>("deckNames");
}

export async function fetchModelNames(): Promise<string[]> {
  return invokeAnkiConnect<string[]>("modelNames");
}

export async function fetchModelFieldNames(modelName: string): Promise<string[]> {
  return invokeAnkiConnect<string[]>("modelFieldNames", { modelName });
}

export async function addNotes(notes: AnkiConnectNote[]): Promise<Array<number | null>> {
  return invokeAnkiConnect<Array<number | null>>("addNotes", { notes });
}
