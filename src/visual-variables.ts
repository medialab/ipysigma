/**
 * Code related to visual variables.
 */
import Graph, { Attributes } from 'graphology-types';
import PaletteBuilder from 'iwanthue/palette-builder';
import Palette from 'iwanthue/palette';
import { scaleLinear } from 'd3-scale';

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
  palette?: AnyPalette<string>;
}

export type RawVisualVariable = {
  type: 'raw';
  attribute: string;
};

export type CategoryVisualVariable = {
  type: 'category';
  attribute: string;
  palette?: ColorEntries<string>;
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
  | DisabledVisualVariable;

export type VisualVariables = {
  nodeColor:
    | RawVisualVariable
    | ContinuousVisualVariable
    | CategoryVisualVariable;
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
export class RawPalette<T> {
  map: Map<T, string>;
  defaultColor: string;
  overflowing = true;
  size: number;

  constructor(entries: ColorEntries<T>, defaultColor: string) {
    this.map = new Map(entries);
    this.size = this.map.size;
    this.defaultColor = defaultColor;
  }

  get(value: T): string {
    return this.map.get(value) || this.defaultColor;
  }

  forEach(callback: (value: string, key: T) => void): void {
    this.map.forEach(callback);
  }
}

export type AnyPalette<T> = RawPalette<T> | Palette<T>;

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
  attributes: Record<string, PaletteBuilder<string>>;
  palettes: Record<string, Palette<string>>;

  constructor(names: Array<string>, defaultColor: string) {
    // NOTE: this naturally deduplicates names
    names.forEach(
      (name) =>
        (this.attributes[name] = new PaletteBuilder(name, CATEGORY_MAX_COUNT, {
          defaultColor,
        }))
    );
  }

  add(attributes: Attributes): void {
    for (const name in this.attributes) {
      const value = attributes[name];

      this.attributes[name].add(value);
    }
  }

  finalize(): void {
    for (const name in this.attributes) {
      const builder = this.attributes[name];
      this.palettes[name] = builder.build();
    }
  }
}

export type VisualVariableScalesBuilderOptions = {
  defaultNodeColor: string;
  defaultEdgeColor: string;
};

export type VisualVariableScales = {
  [name: keyof VisualVariables]: AttributeScale;
};

export class VisualVariableScalesBuilder {
  variables: VisualVariables;
  options: VisualVariableScalesBuilderOptions;
  nodeExtents: AttributeExtents;
  edgeExtents: AttributeExtents;
  nodeCategories: AttributeCategories;
  edgeCategories: AttributeCategories;

  constructor(
    visualVariables: VisualVariables,
    options: VisualVariableScalesBuilderOptions
  ) {
    this.variables = visualVariables;
    this.options = options;

    const nodeExtentAttributes: Array<string> = [];
    const nodeCategoryAttributes: Array<string> = [];
    const edgeExtentAttributes: Array<string> = [];
    const edgeCategoryAttributes: Array<string> = [];

    for (const variableName in visualVariables) {
      const variable = visualVariables[variableName];

      if (variableName.startsWith('node')) {
        if (variable.type === 'category') {
          if (!variable.palette)
            nodeCategoryAttributes.push(variable.attribute);
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
    this.nodeCategories = new AttributeCategories(
      nodeCategoryAttributes,
      options.defaultNodeColor
    );
    this.edgeCategories = new AttributeCategories(
      edgeCategoryAttributes,
      options.defaultEdgeColor
    );
  }

  readGraph(graph: Graph): void {
    graph.forEachNode((node, attr) => {
      this.nodeExtents.add(attr);
      this.nodeCategories.add(attr);
    });

    graph.forEachEdge((edge, attr) => {
      this.edgeExtents.add(attr);
      this.edgeCategories.add(attr);
    });

    this.nodeCategories.finalize();
    this.edgeCategories.finalize();
  }

  build(): VisualVariableScales {
    const scales: VisualVariableScales = {};

    for (const variableName in this.variables) {
      const variable = this.variables[variableName];
      let scale: AttributeScale | null = null;

      // Raw variables
      if (variable.type === 'raw') {
        scale = (attr) => attr[variable.attribute];
      }

      // Category variables
      else if (variable.type === 'category') {
        const categories = variableName.startsWith('node')
          ? this.nodeCategories
          : this.edgeCategories;

        const palette: AnyPalette<string> = variable.palette
          ? new RawPalette(variable.palette, this.options.defaultNodeColor)
          : categories.palettes[variable.attribute];

        scale = (attr) => palette.get(attr[variable.attribute]);
        scale.palette = palette;
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
