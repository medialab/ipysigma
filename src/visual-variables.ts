/**
 * Code related to visual variables.
 */
import Graph, { Attributes } from 'graphology-types';
import MultiSet from 'mnemonist/multi-set';
import DefaultMap from 'mnemonist/default-map';
import Palette from 'iwanthue/palette';
import { scaleLinear } from 'd3-scale';
import chroma from 'chroma-js';

/**
 * Constants.
 */
const CATEGORY_MAX_COUNT = 10;

/**
 * Types.
 */
export type Bound = number | string;
export type Range = [Bound, Bound];
export type ColorEntries<T> = Array<[key: T, value: string]>;
export type EdgeColorDependency = 'source' | 'target';

export interface AttributeScale {
  (value: Attributes): string | number;
  summary?: CategorySummary;
}

export type RawVisualVariable = {
  type: 'raw';
  attribute: string;
  default?: string;
};

export type CategoryVisualVariable = {
  type: 'category';
  attribute: string;
  palette?: ColorEntries<string>;
  default?: string;
};

export type HierarchicalCategoryVisualVariable = {
  type: 'hierarchy';
  attribute: string;
  default?: string;
};

export type ContinuousVisualVariable = {
  type: 'continuous';
  attribute: string;
  range: Range;
};

export type DependentVisualVariable = {
  type: 'dependent';
  value: EdgeColorDependency;
};

export type DisabledVisualVariable = {
  type: 'disabled';
};

export type VisualVariable =
  | RawVisualVariable
  | CategoryVisualVariable
  | ContinuousVisualVariable
  | DependentVisualVariable
  | DisabledVisualVariable
  | HierarchicalCategoryVisualVariable;

export type VisualVariables = {
  nodeColor:
    | RawVisualVariable
    | ContinuousVisualVariable
    | CategoryVisualVariable
    | HierarchicalCategoryVisualVariable;
  nodeBorderColor:
    | RawVisualVariable
    | ContinuousVisualVariable
    | CategoryVisualVariable
    | DisabledVisualVariable;
  nodeSize: ContinuousVisualVariable;
  nodeLabel: RawVisualVariable;
  edgeColor:
    | RawVisualVariable
    | ContinuousVisualVariable
    | CategoryVisualVariable
    | DependentVisualVariable;
  edgeSize: ContinuousVisualVariable;
  edgeLabel: RawVisualVariable | DisabledVisualVariable;
  [name: string]: VisualVariable;
};

/**
 * Helper functions.
 */
function isValidNumber(value: any): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Helper classes.
 */
export class HierarchicalMultiSet {
  container: DefaultMap<string, MultiSet<string>>;

  constructor() {
    this.container = new DefaultMap(() => new MultiSet());
  }

  add(value: [string, string]): void {
    this.container.get(value[0]).add(value[1]);
  }

  firstLevel(): MultiSet<string> {
    const values: MultiSet<string> = new MultiSet();

    this.container.forEach((set, name) => {
      values.set(name, set.size);
    });

    return values;
  }
}

export class Extent {
  min = Infinity;
  max = -Infinity;

  add(value: number) {
    if (value < this.min) this.min = value;
    if (value > this.max) this.max = value;
  }

  isConstant(): boolean {
    return this.min === Infinity || this.min === this.max;
  }
}

export class AttributeExtents {
  attributes: Record<string, Extent> = {};

  constructor(names: Array<string>) {
    // NOTE: this naturally deduplicates names
    names.forEach((name) => (this.attributes[name] = new Extent()));
  }

  add(attributes: Attributes): void {
    for (const name in this.attributes) {
      const value = attributes[name];

      if (!isValidNumber(value)) continue;

      this.attributes[name].add(value);
    }
  }
}

export class AttributeCategories {
  attributes: Record<string, MultiSet<string>> = {};

  constructor(names: Array<string>) {
    // NOTE: this naturally deduplicates names
    names.forEach((name) => (this.attributes[name] = new MultiSet()));
  }

  add(attributes: Attributes): void {
    for (const name in this.attributes) {
      // TODO: this is ungodly
      const value = Array.isArray(attributes[name])
        ? attributes[name][0]
        : attributes[name];

      this.attributes[name].add(value);
    }
  }
}

export class AttributeHierarchicalCategories {
  attributes: Record<string, HierarchicalMultiSet> = {};

  constructor(names: Array<string>) {
    // NOTE: this naturally deduplicates names
    names.forEach(
      (name) => (this.attributes[name] = new HierarchicalMultiSet())
    );
  }

  add(attributes: Attributes): void {
    for (const name in this.attributes) {
      const value = attributes[name];

      if (!value) return;

      this.attributes[name].add(value);
    }
  }
}

export class CategorySummary {
  name: string;
  palette: Palette<string>;
  overflowing: boolean;

  constructor(
    name: string,
    palette: Palette<string>,
    overflowing: boolean = false
  ) {
    this.name = name;
    this.palette = palette;
    this.overflowing = overflowing;
  }

  static fromTopValues(
    name: string,
    frequencies: MultiSet<string>,
    defaultColor: string
  ) {
    const count = Math.min(CATEGORY_MAX_COUNT, frequencies.dimension);
    const topValues = frequencies.top(count);
    const overflowing = count < frequencies.dimension;

    const values = topValues.map((item) => item[0]);
    const palette = Palette.generateFromValues(name, values, { defaultColor });

    return new CategorySummary(name, palette, overflowing);
  }

  static fromColorEntries(
    name: string,
    entries: ColorEntries<string>,
    defaultColor: string
  ) {
    const palette = Palette.fromEntries(name, entries, defaultColor);

    return new CategorySummary(name, palette);
  }
}

export type VisualVariableScales = {
  [name: keyof VisualVariables]: AttributeScale;
};

export class VisualVariableScalesBuilder {
  variables: VisualVariables;
  nodeExtents: AttributeExtents;
  edgeExtents: AttributeExtents;
  nodeCategories: AttributeCategories;
  edgeCategories: AttributeCategories;
  nodeHierarchicalCategories: AttributeHierarchicalCategories;

  constructor(visualVariables: VisualVariables) {
    this.variables = visualVariables;

    const nodeExtentAttributes: Array<string> = [];
    const nodeCategoryAttributes: Array<string> = [];
    const nodeHierarchicalCategoryAttributes: Array<string> = [];
    const edgeExtentAttributes: Array<string> = [];
    const edgeCategoryAttributes: Array<string> = [];

    for (const variableName in visualVariables) {
      const variable = visualVariables[variableName];

      if (variableName.startsWith('node')) {
        if (variable.type === 'category') {
          if (!variable.palette)
            nodeCategoryAttributes.push(variable.attribute);
        } else if (variable.type === 'hierarchy') {
          nodeHierarchicalCategoryAttributes.push(variable.attribute);
        } else if (variable.type === 'continuous') {
          nodeExtentAttributes.push(variable.attribute);
        }
      } else if (variableName.startsWith('edge')) {
        if (variable.type === 'category') {
          if (!variable.palette)
            edgeCategoryAttributes.push(variable.attribute);
        } else if (variable.type === 'continuous') {
          if (variable.range[0] !== variable.range[1])
            edgeExtentAttributes.push(variable.attribute);
        }
      }
    }

    this.nodeExtents = new AttributeExtents(nodeExtentAttributes);
    this.edgeExtents = new AttributeExtents(edgeExtentAttributes);
    this.nodeCategories = new AttributeCategories(nodeCategoryAttributes);
    this.edgeCategories = new AttributeCategories(edgeCategoryAttributes);
    this.nodeHierarchicalCategories = new AttributeHierarchicalCategories(
      nodeHierarchicalCategoryAttributes
    );
  }

  readGraph(graph: Graph): void {
    graph.forEachNode((node, attr) => {
      this.nodeExtents.add(attr);
      this.nodeCategories.add(attr);
      this.nodeHierarchicalCategories.add(attr);
    });

    graph.forEachEdge((edge, attr) => {
      this.edgeExtents.add(attr);
      this.edgeCategories.add(attr);
    });
  }

  build(): VisualVariableScales {
    const scales: VisualVariableScales = {};

    for (const variableName in this.variables) {
      const variable = this.variables[variableName];
      let scale: AttributeScale | null = null;

      // Raw variables
      if (variable.type === 'raw') {
        scale = (attr) => attr[variable.attribute] || variable.default;
      }

      // Category variables
      else if (variable.type === 'category') {
        const categories = variableName.startsWith('node')
          ? this.nodeCategories
          : this.edgeCategories;

        const summary = variable.palette
          ? CategorySummary.fromColorEntries(
              variable.attribute,
              variable.palette,
              variable.default || '#ccc'
            )
          : CategorySummary.fromTopValues(
              variable.attribute,
              categories.attributes[variable.attribute],
              variable.default || '#ccc'
            );

        const palette = summary.palette;

        // TODO: this is ungodly
        scale = (attr) =>
          palette.get(
            Array.isArray(attr[variable.attribute])
              ? attr[variable.attribute][0]
              : attr[variable.attribute]
          );
        scale.summary = summary;
      }

      // Hierarchical category
      else if (variable.type === 'hierarchy') {
        const hierarchy =
          this.nodeHierarchicalCategories.attributes[variable.attribute];

        const summary = CategorySummary.fromTopValues(
          variable.attribute,
          hierarchy.firstLevel(),
          variable.default || '#ccc'
        );

        const firstLevelPalette = summary.palette;

        const secondLevelPalettes: Map<string, Palette<string>> = new Map();

        firstLevelPalette.forEach((color, firstLevelValue) => {
          const secondLevel = hierarchy.container.get(firstLevelValue);
          const count = Math.min(CATEGORY_MAX_COUNT, secondLevel.dimension);
          const values = Array.from(
            secondLevel.top(count).map((item) => item[0])
          );

          const lightColor = chroma(color).mix('#fff', 0.7).hex();

          const subScale = scaleLinear()
            .domain([0, values.length - 1])
            .range([color, count > 1 ? lightColor : color] as unknown as [
              number,
              number
            ]);

          const colors = values.map((_, i) =>
            subScale(i)
          ) as unknown as string[];

          const mapping: Map<string, string> = new Map();

          values.forEach((value, i) => {
            mapping.set(value, colors[i]);
          });

          const secondLevelPalette = Palette.fromMapping(
            firstLevelValue,
            mapping,
            '#999'
          );

          secondLevelPalettes.set(firstLevelValue, secondLevelPalette);
        });

        const defaultColor = variable.default || '#ccc';

        scale = (attr) => {
          const value = attr[variable.attribute];

          if (!value) return defaultColor;

          const secondLevelPalette = secondLevelPalettes.get(value[0]);

          if (!secondLevelPalette) return defaultColor;

          return secondLevelPalette.get(value[1]);
        };

        scale.summary = summary;
      }

      // Continuous variables
      else if (variable.type === 'continuous') {
        const extents = variableName.startsWith('node')
          ? this.nodeExtents
          : this.edgeExtents;

        const extent = extents.attributes[variable.attribute];

        if (variable.range[0] === variable.range[1] || extent.isConstant()) {
          scale = () => variable.range[0];
        } else {
          const continuousScale = scaleLinear()
            .domain([extent.min as number, extent.max as number])
            .range(variable.range as [number, number]);

          scale = (attr) => continuousScale(attr[variable.attribute]);
        }
      }

      if (scale) scales[variableName] = scale;
    }

    return scales;
  }

  inferLabelRenderedSizeThreshold(): number {
    const attribute = this.variables.nodeSize.attribute;
    const extent = this.nodeExtents.attributes[attribute];

    return Math.min(6, extent.max);
  }
}
