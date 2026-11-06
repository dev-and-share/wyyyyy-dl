/**
 * 🌐 官方插件专用网络请求工具
 * 所有外发请求统一走 Spring Boot 中继代理 (/v3/plugin/proxy)
 * 自动解决跨域限制并附带国内高匿代理出口
 */

function getProxyEndpoint(): string {
  if (
    typeof window !== 'undefined' &&
    window.location &&
    window.location.origin &&
    window.location.origin !== 'null' &&
    !window.location.origin.startsWith('file:') &&
    !window.location.origin.includes('localhost:3000')
  ) {
    return '/v3/plugin/proxy';
  }
  return 'http://localhost:8080/v3/plugin/proxy';
}

export async function proxyRequest<T = any>(
  url: string,
  options: {
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    params?: Record<string, any>;
    data?: any;
    timeout?: number;
  } = {}
): Promise<T | null> {
  try {
    const timeoutMs = options.timeout || 12000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(getProxyEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        method: options.method || 'GET',
        headers: options.headers,
        params: options.params,
        data: options.data
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await res.json().catch(() => null);
    }
    const buffer = await res.arrayBuffer();
    const text = new TextDecoder('utf-8').decode(new Uint8Array(buffer));
    try {
      return JSON.parse(text);
    } catch {
      return text as unknown as T;
    }
  } catch (err) {
    console.warn(`[BuiltinPlugin] 请求异常: ${url}`, err);
    return null;
  }
}
