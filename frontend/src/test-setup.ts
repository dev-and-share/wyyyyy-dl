import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';
import { setLocale } from './lib/i18n/index.svelte';

if (typeof Blob !== 'undefined' && !Blob.prototype.stream) {
  Blob.prototype.stream = function () {
    return new ReadableStream({
      start: async (controller) => {
        const buf = await this.arrayBuffer();
        controller.enqueue(new Uint8Array(buf));
        controller.close();
      }
    });
  };
}

beforeEach(async () => {
  await setLocale('zh-CN');
});
