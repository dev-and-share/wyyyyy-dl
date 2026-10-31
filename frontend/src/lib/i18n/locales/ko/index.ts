import type { TranslationDictionary } from '../../types';
import common from './common';
import player from './player';
import playlist from './playlist';
import search from './search';
import download from './download';
import settings from './settings';
import comment from './comment';
import toast from './toast';
import error from './error';

export const ko: TranslationDictionary = {
  ...common,
  ...player,
  ...playlist,
  ...search,
  ...download,
  ...settings,
  ...comment,
  ...toast,
  ...error,
};

export default ko;
