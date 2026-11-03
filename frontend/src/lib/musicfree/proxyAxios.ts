import axios, { type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

/**
 * 🌐 构造一个请求自动走 Spring Boot 通用中继代理 (/v3/plugin/proxy) 的 Axios 实例
 * 拦截所有外发请求，彻底粉碎浏览器 CORS 跨域拦截
 */
export function createProxiedAxios() {
  const instance = axios.create({
    timeout: 25000
  });

  instance.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const method = (config.method || 'GET').toUpperCase();
    const targetUrl = config.url || '';

    // 过滤并处理 headers
    const headersObj: Record<string, string> = {};
    if (config.headers) {
      if (typeof config.headers.toJSON === 'function') {
        const raw = config.headers.toJSON();
        for (const [k, v] of Object.entries(raw)) {
          if (v != null) headersObj[k] = String(v);
        }
      } else {
        for (const [k, v] of Object.entries(config.headers)) {
          if (v != null) headersObj[k] = String(v);
        }
      }
    }

    try {
      const res = await fetch('/v3/plugin/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: targetUrl,
          method,
          headers: headersObj,
          params: config.params,
          data: config.data
        })
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any;

      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => null);
      } else {
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      if (!res.ok && res.status >= 400) {
        const error: any = new Error(`Request failed with status code ${res.status}`);
        error.response = {
          data,
          status: res.status,
          statusText: res.statusText,
          headers: {},
          config
        };
        throw error;
      }

      return {
        data,
        status: res.status,
        statusText: res.statusText,
        headers: {},
        config,
        request: {}
      };
    } catch (err: any) {
      if (err.response) throw err;
      const error: any = new Error(err.message || 'Network Error via Plugin Proxy');
      error.config = config;
      throw error;
    }
  };

  return instance;
}
