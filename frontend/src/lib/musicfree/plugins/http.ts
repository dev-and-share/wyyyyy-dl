/**
 * 🌐 官方插件专用网络请求工具
 * 所有外发请求统一走 Spring Boot 中继代理 (/v3/plugin/proxy)
 * 自动解决跨域限制并附带国内高匿代理出口
 */

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
    const res = await fetch('/v3/plugin/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        method: options.method || 'GET',
        headers: options.headers,
        params: options.params,
        data: options.data
      })
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await res.json().catch(() => null);
    }
    const text = await res.text();
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
