// Copyright (c) Yomguithereal
// Distributed under the terms of the Modified BSD License.

import {
  DOMWidgetModel,
  DOMWidgetView,
  ISerializers,
} from '@jupyter-widgets/base';

import Graph from 'graphology';
import { SerializedGraph } from 'graphology-types';
import Sigma from 'sigma';

import { MODULE_NAME, MODULE_VERSION } from './version';

// Import the CSS
import '../css/widget.css';

export class SigmaModel extends DOMWidgetModel {
  defaults() {
    return {
      ...super.defaults(),
      _model_name: SigmaModel.model_name,
      _model_module: SigmaModel.model_module,
      _model_module_version: SigmaModel.model_module_version,
      _view_name: SigmaModel.view_name,
      _view_module: SigmaModel.view_module,
      _view_module_version: SigmaModel.view_module_version,
      data: { nodes: [], edges: [] },
      height: 500,
      start_layout: false,
    };
  }

  static serializers: ISerializers = {
    ...DOMWidgetModel.serializers,
    // Add any extra serializers here
  };

  static model_name = 'SigmaModel';
  static model_module = MODULE_NAME;
  static model_module_version = MODULE_VERSION;
  static view_name = 'SigmaView'; // Set to null if no view
  static view_module = MODULE_NAME; // Set to null if no view
  static view_module_version = MODULE_VERSION;
}

function isValidNumber(value: any): boolean {
  return typeof value === 'number' && !isNaN(value);
}

function buildGraph(data: SerializedGraph): Graph {
  const graph = Graph.from(data);

  graph.updateEachNodeAttributes((_, attr) => {
    // Random position for nodes without positions
    if (!isValidNumber(attr.x)) attr.x = Math.random();
    if (!isValidNumber(attr.y)) attr.y = Math.random();

    return attr;
  });

  return graph;
}

function adjustDimensions(el: HTMLElement, height: number): void {
  el.style.height = height + 'px';
  el.style.width = '100%';
}

export class SigmaView extends DOMWidgetView {
  renderer: Sigma;

  render() {
    super.render();

    this.el.classList.add('ipysigma-widget');

    var height = this.model.get('height');
    var data = this.model.get('data');

    var graph = buildGraph(data);

    adjustDimensions(this.el, height);

    var container = document.createElement('div');
    this.el.appendChild(container);
    adjustDimensions(container, height);

    this.displayed.then(() => {
      this.renderer = new Sigma(graph, container);
    });
  }

  remove() {
    // Cleanup to avoid leaks and free GPU slots
    if (this.renderer) this.renderer.kill();
    super.remove();
  }
}
