/** Cross-origin `download` is ignored by browsers, so fetch to a blob (needs bucket CORS); otherwise open the image in a tab. */
export async function downloadUrl(url: string, name: string) {
  try {
    downloadBlob(await (await fetch(url)).blob(), name);
  } catch {
    window.open(url, "_blank");
  }
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
