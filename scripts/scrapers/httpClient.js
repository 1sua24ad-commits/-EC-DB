const USER_AGENT = 'cactus-db-research/0.1 (+personal non-commercial cactus conservation database project)';
const DEFAULT_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 20000; // これが無いとサーバー側がハングした際に処理全体が止まってしまう

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 相手サイトに配慮し、リクエスト間に一定間隔を空けつつ取得する共通処理。
 * タイムアウトした場合は1回だけ再試行し、それでも失敗したら例外を投げる
 * (呼び出し元のサイト単位のtry/catchでスキップされる)。
 * @param {string} url
 * @param {{ delayMs?: number }} [options]
 * @param {(res: Response) => Promise<T>} readBody
 * @returns {Promise<T>}
 * @template T
 */
async function fetchWithRetry(url, options, readBody) {
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;

  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} while fetching ${url}`);
      }
      const body = await readBody(res);
      if (delayMs > 0) await sleep(delayMs);
      return body;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`fetch failed after retry: ${url} (${lastError?.message ?? lastError})`);
}

/**
 * HTML・テキストの取得用。
 * @param {string} url
 * @param {{ delayMs?: number }} [options]
 */
export function fetchText(url, options = {}) {
  return fetchWithRetry(url, options, (res) => res.text());
}

/**
 * JSON APIエンドポイント用。
 */
export async function fetchJson(url, options = {}) {
  const text = await fetchText(url, options);
  return JSON.parse(text);
}

/**
 * xlsx等のバイナリファイル取得用。ArrayBufferを返す。
 * @param {string} url
 * @param {{ delayMs?: number }} [options]
 */
export function fetchArrayBuffer(url, options = {}) {
  return fetchWithRetry(url, options, (res) => res.arrayBuffer());
}
