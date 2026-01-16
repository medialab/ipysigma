import Graph from 'graphology';

/**
 * To be able to display parallel edges, this helper will compute an index for
 * each edge of the graph. This index will then be usable by the edge's reducer
 * to map to a custom "type" and "curvature".
 *
 * @param graph
 * @param options
 */
export default function indexParallelEdgesIndex<
  NodeAttributes extends { [key: string]: unknown } = { [key: string]: unknown },
  EdgeAttributes extends { [key: string]: unknown } = { [key: string]: unknown },
>(
  graph: Graph<NodeAttributes, EdgeAttributes>,
  options?: {
    edgeIndexAttribute?: string;
    edgeMinIndexAttribute?: string;
    edgeMaxIndexAttribute?: string;
  },
) {
  const {
    edgeIndexAttribute = "parallelIndex",
    edgeMinIndexAttribute = "parallelMinIndex",
    edgeMaxIndexAttribute = "parallelMaxIndex",
  } = options || {};

  const edgeIndices: Record<string, number> = {};

  graph.forEachEdge(
    (
      edge: string,
      _attributes: EdgeAttributes,
      source: string,
      target: string,
      _sourceAttributes: NodeAttributes,
      _targetAttributes: NodeAttributes,
      undirected: boolean,
    ) => {
      const [min, max] = source < target ? [source, target] : [target, source];
      const id = undirected ? `${min}|${max}` : `${source}|${target}`;

      let parallelIndex = 0;
      if (edgeIndices[id]) {
        parallelIndex = edgeIndices[id];
      }
      edgeIndices[id] = parallelIndex + 1;

      graph.setEdgeAttribute(edge, edgeIndexAttribute, parallelIndex as any);
    },
  );

  const parallelEdges: Record<string, number> = {};
  graph.forEachEdge(
    (
      edge: string,
      _attributes: EdgeAttributes,
      source: string,
      target: string,
      _sourceAttributes: NodeAttributes,
      _targetAttributes: NodeAttributes,
      undirected: boolean,
    ) => {
      const [min, max] = source < target ? [source, target] : [target, source];
      const id = undirected ? `${min}|${max}` : `${source}|${target}`;

      if (edgeIndices[id] > 1) {
        parallelEdges[id] = edgeIndices[id];
      }
    },
  );

  graph.forEachEdge(
    (
      edge: string,
      _attributes: EdgeAttributes,
      source: string,
      target: string,
      _sourceAttributes: NodeAttributes,
      _targetAttributes: NodeAttributes,
      undirected: boolean,
    ) => {
      const [min, max] = source < target ? [source, target] : [target, source];
      const id = undirected ? `${min}|${max}` : `${source}|${target}`;

      if (parallelEdges[id]) {
        graph.setEdgeAttribute(edge, edgeMinIndexAttribute, 0 as any);
        graph.setEdgeAttribute(
          edge,
          edgeMaxIndexAttribute,
          (parallelEdges[id] - 1) as any,
        );
      }
    },
  );
}

export function getCurvature(index: number, maxIndex: number): number {
  if (maxIndex === 0) {
    return 0;
  }
  const amplitude = 3.5;
  const sign = index % 2 === 0 ? 1 : -1;
  if (index % 2 === 0) {
    return sign * Math.pow((index + 2) / 2, 0.8) * amplitude;
  }
  return sign * Math.pow((index + 1) / 2, 0.8) * amplitude;
}
