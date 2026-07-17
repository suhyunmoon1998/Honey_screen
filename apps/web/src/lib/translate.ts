// Free, keyless machine translation via MyMemory (https://mymemory.translated.net/).
// Best-effort only: used to help staff skim Spanish free-text answers, never
// stored as the answer of record.
export async function translateToEnglish(text: string): Promise<string | null> {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return null;
  }

  try {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", trimmed.slice(0, 500));
    url.searchParams.set("langpair", "es|en");

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      responseData?: { translatedText?: string };
    };

    return data.responseData?.translatedText?.trim() || null;
  } catch {
    return null;
  }
}
