import { describe, it, expect } from 'vitest';
import {
  extractVariables,
  compareVariables,
  findBrokenPlaceholders,
  splitPlaceholders,
  findMatchingDiffRowIndices,
} from '../lib/variables';
import { buildDiffRows } from '../lib/diff';

describe('extractVariables', () => {
  it('extracts variable names, counts, and line numbers', () => {
    const prompt = 'Hello ${user_name}!\nThe weather in ${city} is ${weather}.\nSee you soon, ${user_name}.';
    const map = extractVariables(prompt);

    expect(map.get('user_name')).toEqual({
      name: 'user_name',
      count: 2,
      lines: [1, 3],
    });
    expect(map.get('city')).toEqual({
      name: 'city',
      count: 1,
      lines: [2],
    });
    expect(map.get('weather')).toEqual({
      name: 'weather',
      count: 1,
      lines: [2],
    });
  });

  it('ignores empty placeholders like ${}', () => {
    const prompt = 'Hello ${} and ${   }';
    const map = extractVariables(prompt);
    expect(map.size).toBe(0);
  });
});

describe('compareVariables', () => {
  it('correctly categorizes new, removed, changed, and same variables', () => {
    const prev = 'Hello ${user_name}, welcome to ${city}.\nToday the forecast is ${weather}.';
    const curr =
      'Hello ${user_name}, welcome!\nToday the forecast is ${weather} with high of ${temp}.\nReport: ${weather}.';

    const comparison = compareVariables(prev, curr);

    // Order: removed -> new -> changed -> same
    expect(comparison.map((c) => c.status)).toEqual(['removed', 'new', 'changed', 'same']);

    const city = comparison.find((c) => c.name === 'city');
    expect(city?.status).toBe('removed');
    expect(city?.beforeCount).toBe(1);
    expect(city?.afterCount).toBe(0);

    const temp = comparison.find((c) => c.name === 'temp');
    expect(temp?.status).toBe('new');
    expect(temp?.beforeCount).toBe(0);
    expect(temp?.afterCount).toBe(1);

    const weather = comparison.find((c) => c.name === 'weather');
    expect(weather?.status).toBe('changed');
    expect(weather?.beforeCount).toBe(1);
    expect(weather?.afterCount).toBe(2);

    const user = comparison.find((c) => c.name === 'user_name');
    expect(user?.status).toBe('same');
    expect(user?.beforeCount).toBe(1);
    expect(user?.afterCount).toBe(1);
  });
});

describe('findBrokenPlaceholders', () => {
  it('flags unclosed brace: ${weather', () => {
    const prompt = 'Forecast: ${weather\nEnd';
    const broken = findBrokenPlaceholders(prompt);
    expect(broken.some((b) => b.message.includes('Missing closing brace') && b.line === 1)).toBe(
      true
    );
  });

  it('flags ${broken and ${ok} on the first ${ (instruction 5)', () => {
    const prompt = 'Check: ${broken and ${ok}';
    const broken = findBrokenPlaceholders(prompt);
    expect(broken.some((b) => b.message.includes('Missing closing brace'))).toBe(true);
  });

  it('flags missing $ in {weather}', () => {
    const prompt = 'Hello {weather}';
    const broken = findBrokenPlaceholders(prompt);
    expect(broken.some((b) => b.message.includes("Missing '$' prefix"))).toBe(true);
  });

  it('flags space between $ and { in $ {weather}', () => {
    const prompt = 'Hello $ {weather}';
    const broken = findBrokenPlaceholders(prompt);
    expect(broken.some((b) => b.message.includes("Space between '$' and '{'"))).toBe(true);
  });

  it('flags empty placeholder ${}', () => {
    const prompt = 'Hello ${}';
    const broken = findBrokenPlaceholders(prompt);
    expect(broken.some((b) => b.message.includes("Empty placeholder '${}'"))).toBe(true);
  });

  it('flags extra spaces in ${ weather }', () => {
    const prompt = 'Hello ${ weather }';
    const broken = findBrokenPlaceholders(prompt);
    expect(broken.some((b) => b.message.includes('Extra spaces inside braces'))).toBe(true);
  });

  it('does NOT flag valid JSON like {"a": 1} or {"key": "val"}', () => {
    const prompt = 'Config: {"a": 1, "weather": "sunny"}\n{"city": "Paris"}';
    const broken = findBrokenPlaceholders(prompt);
    expect(broken.length).toBe(0);
  });

  it('does NOT flag valid variables ${weather}', () => {
    const prompt = 'Forecast: ${weather} in ${city}';
    const broken = findBrokenPlaceholders(prompt);
    expect(broken.length).toBe(0);
  });
});

describe('splitPlaceholders', () => {
  it('tokenizes plain text and variables', () => {
    const text = 'Hello ${name}, welcome to ${place}!';
    const tokens = splitPlaceholders(text);
    expect(tokens).toEqual([
      { text: 'Hello ', isVariable: false },
      { text: '${name}', isVariable: true },
      { text: ', welcome to ', isVariable: false },
      { text: '${place}', isVariable: true },
      { text: '!', isVariable: false },
    ]);
  });
});

describe('findMatchingDiffRowIndices for click-to-jump', () => {
  it('finds removed rows for removed variables and added rows for new variables', () => {
    const prev = 'Hello ${city}\nEnd';
    const curr = 'Hello ${temp}\nEnd';
    const rows = buildDiffRows(prev, curr);

    const removedMatches = findMatchingDiffRowIndices(rows, 'city', 'removed');
    expect(removedMatches.length).toBe(1);
    expect(rows[removedMatches[0]].type).toBe('removed');

    const newMatches = findMatchingDiffRowIndices(rows, 'temp', 'new');
    expect(newMatches.length).toBe(1);
    expect(rows[newMatches[0]].type).toBe('added');
  });
});

