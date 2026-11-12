import './style.css';
import { startApp } from './app';
import type { Episode } from './types';

const SUPPORTED_SCHEMA = 1;

async function boot(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app が見つかりません');
  const base = new URL(document.body.dataset.episode ?? './', location.href);
  const response = await fetch(new URL('episode.json', base));
  if (!response.ok) throw new Error(`episode.json を読めませんでした（${response.status}）`);
  const episode = (await response.json()) as Episode;
  if (episode.schema !== SUPPORTED_SCHEMA) throw new Error(`対応していない形式です（schema ${episode.schema}）`);
  document.title = `${episode.title} | 谷ラジオ`;
  await startApp(root, episode, base);
}

boot().catch((error: unknown) => {
  console.error(error);
  const message = document.createElement('p');
  message.className = 'fatal';
  message.textContent = `番組を読み込めませんでした。${error instanceof Error ? error.message : ''}`;
  document.body.replaceChildren(message);
});
