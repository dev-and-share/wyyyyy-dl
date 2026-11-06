import { describe, it, expect, vi } from 'vitest';
import { executePluginScript } from './sandbox';

describe('MusicFree Sandbox execution', () => {
  it('executes a basic plugin script and exports platform definition', () => {
    const mockCode = `
      "use strict";
      const he = require("he");
      module.exports = {
        platform: "TestPlatform",
        author: "Tester",
        version: "1.0.0",
        search: async (keyword) => {
          return { data: [{ id: "1", title: he.decode(keyword + " &amp; song") }] };
        }
      };
    `;

    const plugin = executePluginScript(mockCode);
    expect(plugin.platform).toBe('TestPlatform');
    expect(plugin.author).toBe('Tester');
    expect(plugin.version).toBe('1.0.0');
    expect(typeof plugin.search).toBe('function');
  });

  it('provides crypto-js and dayjs in the sandbox', () => {
    const mockCode = `
      "use strict";
      const CryptoJS = require("crypto-js");
      const dayjs = require("dayjs");
      module.exports = {
        platform: "CryptoDayPlatform",
        hash: (text) => CryptoJS.MD5(text).toString(),
        formatDate: (timestamp) => dayjs(timestamp).format("YYYY-MM-DD")
      };
    `;

    const plugin = executePluginScript(mockCode) as any;
    expect(plugin.hash('hello')).toBe('5d41402abc4b2a76b9719d911017c592');
    expect(plugin.formatDate(1700000000000)).toBe('2023-11-15');
  });

  it('throws an error when an unsupported module is required', () => {
    const badCode = `
      const fs = require("fs");
      module.exports = { platform: "Bad" };
    `;

    expect(() => executePluginScript(badCode)).toThrow(/Unsupported module/);
  });

  it('safely handles empty strings and jsonp strings in JSON.parse without crashing, and keeps JSON.stringify functional', () => {
    const jsonpCode = `
      "use strict";
      module.exports = {
        platform: "JsonpTest",
        parseEmpty: () => JSON.parse(""),
        parseJsonp: (str) => JSON.parse(str),
        stringifyData: (obj) => JSON.stringify(obj)
      };
    `;

    const plugin = executePluginScript(jsonpCode) as any;
    expect(plugin.parseEmpty()).toEqual({});
    expect(plugin.parseJsonp('MusicJsonCallback({"code":0,"data":{"id":123}})')).toEqual({
      code: 0,
      data: { id: 123 }
    });
    expect(plugin.stringifyData({ foo: 'bar', num: 42 })).toBe('{"foo":"bar","num":42}');
  });
});
