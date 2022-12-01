const USEFUL_SHAPES = [
  { name: 'circle', pictogram: 'circle' },
  { name: 'triangle', pictogram: 'change_history' },
  { name: 'square', pictogram: 'square' },
  { name: 'pentagon', pictogram: 'pentagon' },
  { name: 'hexagon', pictogram: 'hexagon' },
  { name: 'star', pictogram: 'star' },
  { name: 'heart', pictogram: 'favorite' },
  { name: 'cloud', pictogram: 'cloudy' },
];

const UNKNOWN_SHAPE = 'help';

const SHAPES_MAP = new Map();

USEFUL_SHAPES.forEach(({ name, pictogram }) => {
  SHAPES_MAP.set(name, pictogram);
});

export function shapeToPicto(shape: string): string | undefined {
  return SHAPES_MAP.get(shape) || shape;
}

export default class ShapePalette<V> {
  name: string;
  map: Map<V, string>;

  constructor(name: string, map: Map<V, string>) {
    this.name = name;
    this.map = map;
  }

  get(value: V): string {
    return this.map.get(value) || UNKNOWN_SHAPE;
  }

  static fromEntries<T>(
    name: string,
    entries: Array<[key: T, value: string]>
  ): ShapePalette<T> {
    return new ShapePalette(name, new Map(entries));
  }

  static generateFromValues<T>(
    name: string,
    values: Array<T>
  ): ShapePalette<T> {
    const map: Map<T, string> = new Map();

    let i = 0;

    values.slice(0, USEFUL_SHAPES.length).forEach((v) => {
      map.set(v, USEFUL_SHAPES[i++].name);
    });

    return new ShapePalette(name, map);
  }
}
