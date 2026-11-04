import { describe, expect, it } from 'vitest';
import { ITEMS } from '../data/items';
import type { Item, Level } from '../types';
import { initEngine, pickBlock, submitBlock } from './engine';

/** ability 급 이하 문항은 다 맞히고, 초과 문항은 다 틀리는 가상 응시자 */
function run(start: Level, answer: (item: Item) => boolean) {
  let s = initEngine(start);
  let guard = 0;
  while (!s.done && guard++ < 10) {
    const block = pickBlock(s, ITEMS);
    expect(block).toHaveLength(4);
    expect(new Set(block.map((b) => b.section)).size).toBe(4);
    s = submitBlock(s, block, block.filter(answer).length);
  }
  return s;
}

describe('adaptive engine', () => {
  it.each([1, 2, 3, 4, 5, 6] as Level[])('finds true level %i from every start level', (ability) => {
    for (const start of [1, 2, 3, 4] as Level[]) {
      const s = run(start, (i) => i.level <= ability);
      expect(s.done).toBe(true);
      expect(s.result).toBe(ability);
      expect(s.blocks.length).toBeLessThanOrEqual(6);
    }
  });

  it('stops at the level where the student gets half right', () => {
    let n = 0;
    const s = run(2, (i) => (i.level < 3 ? true : i.level === 3 ? n++ % 2 === 0 : false));
    expect(s.result).toBe(3);
  });

  it('avoids items from the previous attempt when possible', () => {
    const first = pickBlock(initEngine(3), ITEMS);
    const second = pickBlock(initEngine(3), ITEMS, new Set(first.map((i) => i.id)));
    expect(second.some((i) => first.includes(i))).toBe(false);
  });

  it('bank has 2 items per section per level', () => {
    for (let l = 1; l <= 6; l++)
      for (const sec of ['vocab', 'grammar', 'reading', 'listening'])
        expect(ITEMS.filter((i) => i.level === l && i.section === sec)).toHaveLength(2);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
  });
});
