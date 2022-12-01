import iwanthue from 'iwanthue';
import * as d3Chromatic from 'd3-scale-chromatic';
import { createShuffleInPlace } from 'pandemonium/shuffle-in-place';
import seedrandom from 'seedrandom';

import { USEFUL_SHAPES, UNKNOWN_SHAPE } from './shapes';

export type PaletteKind = 'color' | 'shape';
export type Entries<T> = Array<[key: T, value: string]>;

function getDefaultDefaultValue(kind: PaletteKind): string {
  if (kind === 'color') return '#ccc';
  else return UNKNOWN_SHAPE;
}

export default class Palette<K> {
  name: string;
  kind: PaletteKind;
  map: Map<K, string>;
  defaultValue: string;
  size: number;

  constructor(
    name: string,
    kind: PaletteKind,
    map: Map<K, string>,
    defaultValue: string
  ) {
    this.name = name;
    this.kind = kind;
    this.map = map;
    this.defaultValue = defaultValue;
    this.size = this.map.size;
  }

  get(key: K): string {
    const value = this.map.get(key);

    if (value === undefined) return this.defaultValue;

    return value;
  }

  forEach(callback: (value: string, key: K) => void): void {
    this.map.forEach(callback);
  }

  static getMacroDefault(kind: PaletteKind) {
    if (kind === 'color') return '#ccc';
    else return UNKNOWN_SHAPE;
  }

  static fromScheme<T>(
    name: string,
    kind: PaletteKind,
    scheme: string,
    values: Array<T>,
    defaultValue?: string
  ): Palette<T> {
    const target = (
      d3Chromatic as unknown as Record<
        string,
        Array<string> | Array<Array<string | undefined>>
      >
    )['scheme' + scheme];

    let colors: Array<string>;

    if (Array.isArray(target[target.length - 1])) {
      const firstValidCount = target.findIndex((c) => Array.isArray(c));
      colors = target[
        Math.min(Math.max(firstValidCount, values.length), target.length)
      ] as Array<string>;
    } else {
      colors = (target as Array<string>).slice();

      const shuffleInPlace = createShuffleInPlace(seedrandom(name));
      shuffleInPlace(colors);

      colors = colors.slice(0, Math.min(values.length, colors.length));
    }

    const map = new Map();

    values.slice(0, colors.length).forEach((v, i) => {
      map.set(v, colors[i]);
    });

    return new Palette(
      name,
      kind,
      map,
      defaultValue || getDefaultDefaultValue(kind)
    );
  }

  static fromEntries<T>(
    name: string,
    kind: PaletteKind,
    entries: Entries<T>,
    defaultValue?: string
  ): Palette<T> {
    return new Palette(
      name,
      kind,
      new Map(entries),
      defaultValue || getDefaultDefaultValue(kind)
    );
  }

  static generateFromValues<T>(
    name: string,
    kind: PaletteKind,
    values: Array<T>,
    defaultValue?: string
  ): Palette<T> {
    if (kind === 'color') {
      const settings = {
        colorSpace: 'sensible',
        seed: name,
        clustering: 'force-vector',
        attempts: 5,
      } as const;

      if (values.length === 0)
        return new Palette(
          name,
          kind,
          new Map(),
          defaultValue || getDefaultDefaultValue(kind)
        );

      const colors = iwanthue(values.length, settings);

      const map = new Map();

      values.forEach((v, i) => {
        map.set(v, colors[i]);
      });

      return new Palette(
        name,
        kind,
        map,
        defaultValue || getDefaultDefaultValue(kind)
      );
    } else {
      const map = new Map();

      USEFUL_SHAPES.slice(
        0,
        Math.min(values.length, USEFUL_SHAPES.length)
      ).forEach((shape, i) => {
        map.set(values[i], shape.name);
      });

      return new Palette(
        name,
        kind,
        map,
        defaultValue || getDefaultDefaultValue(kind)
      );
    }
  }
}
