import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import LocalSearchBox from './LocalSearchBox.svelte';

describe('LocalSearchBox Component', () => {
  it('renders input with default placeholder and search type', () => {
    const { getByPlaceholderText } = render(LocalSearchBox, {
      props: {
        value: '',
        placeholder: '搜索本地测试...'
      }
    });
    const input = getByPlaceholderText('搜索本地测试...') as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.type).toBe('search');
  });

  it('shows single clear button when value is present and clears on click', async () => {
    const onClear = vi.fn();
    const { getByPlaceholderText, getByTitle, queryByTitle } = render(LocalSearchBox, {
      props: {
        value: '周杰伦',
        placeholder: '搜索...',
        clearTitle: '清空测试',
        onClear
      }
    });

    const clearBtn = getByTitle('清空测试');
    expect(clearBtn).toBeDefined();

    await fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalled();
  });

  it('supports search history pills and click to autofill', async () => {
    const STORAGE_KEY = 'test_local_search_history';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['晴天', '周杰伦']));

    const onSearch = vi.fn();
    const { getByText } = render(LocalSearchBox, {
      props: {
        value: '',
        historyKey: STORAGE_KEY,
        showHistory: true,
        onSearch
      }
    });

    const pill = getByText('晴天');
    expect(pill).toBeDefined();

    await fireEvent.click(pill);
    expect(onSearch).toHaveBeenCalledWith('晴天');

    localStorage.removeItem(STORAGE_KEY);
  });
});
