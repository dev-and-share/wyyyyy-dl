import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';
import { setLocale } from './lib/i18n/index.svelte';

beforeEach(async () => {
  await setLocale('zh-CN');
});
