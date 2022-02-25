import {
  DOMWidgetModel,
  DOMWidgetView,
  ISerializers,
} from '@jupyter-widgets/base';

import Graph from 'graphology';
import { SerializedGraph } from 'graphology-types';
import LayoutSupervisor from 'graphology-layout-forceatlas2/worker';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import Sigma from 'sigma';
import { Settings as SigmaSettings } from 'sigma/settings';
import seedrandom from 'seedrandom';
import type { Properties as CSSProperties } from 'csstype';
import comma from 'comma-number';

import { MODULE_NAME, MODULE_VERSION } from './version';
import saveAsPNG from './saveAsPNG';

import {
  zoomIcon,
  unzoomIcon,
  resetZoomIcon,
  playIcon,
  pauseIcon,
  resetLayoutIcon,
} from './icons';

import '../css/widget.css';

/**
 * Types.
 */
type RNGFunction = () => number;

/**
 * Model declaration.
 */
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
      snapshot: null,
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

/**
 * Helper functions.
 */
function isValidNumber(value: any): boolean {
  return typeof value === 'number' && !isNaN(value);
}

function buildGraph(data: SerializedGraph, rng: RNGFunction): Graph {
  const graph = Graph.from(data);

  graph.updateEachNodeAttributes((key, attr) => {
    // Random position for nodes without positions
    if (!isValidNumber(attr.x)) attr.x = rng();
    if (!isValidNumber(attr.y)) attr.y = rng();

    // If we don't have a label we keep the key instead
    if (!attr.label) attr.label = key;

    return attr;
  });

  return graph;
}

function selectSigmaSettings(graph: Graph): Partial<SigmaSettings> {
  const settings: Partial<SigmaSettings> = {};

  if (graph.type !== 'undirected') {
    settings.defaultEdgeType = 'arrow';
  }

  return settings;
}

function adjustDimensions(el: HTMLElement, height: number): void {
  el.style.height = height + 'px';
  el.style.width = '100%';
}

function createElement(
  tag: keyof HTMLElementTagNameMap,
  options?: {
    className?: string | null;
    style?: CSSProperties;
    innerHTML?: string;
    title?: string;
  }
): HTMLElement {
  const element = document.createElement(tag);

  const { className, style, innerHTML, title } = options || {};

  if (className) element.setAttribute('class', className);

  for (const prop in style) {
    (<any>element.style)[prop] = (<any>style)[prop];
  }

  if (innerHTML) element.innerHTML = innerHTML;

  if (title) element.setAttribute('title', title);

  return element;
}

const SPINNER_STATES = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];

function createSpinner(): [HTMLElement, () => void] {
  const span = createElement('span', { innerHTML: SPINNER_STATES[0] });

  let state = -1;
  let frame: ReturnType<typeof setTimeout> | null = null;

  const update = () => {
    state++;
    state %= SPINNER_STATES.length;
    span.innerHTML = SPINNER_STATES[state];

    frame = setTimeout(update, 80);
  };

  update();

  return [span, () => frame !== null && clearTimeout(frame)];
}

function createGraphDescription(graph: Graph): HTMLElement {
  let graphTitle = `${graph.multi ? 'Multi ' : ''}${
    graph.type === 'undirected' ? 'Undirected' : 'Directed'
  } Graph`;

  let innerHTML = `<u>${graphTitle}</u><br><b>${comma(
    graph.order
  )}</b> nodes<br><b>${comma(graph.size)}</b> edges`;

  return createElement('div', {
    className: 'ipysigma-graph-description',
    innerHTML,
  });
}

/**
 * View declaration.
 */
export class SigmaView extends DOMWidgetView {
  singleton: boolean = true;

  renderer: Sigma;
  rng: RNGFunction;
  layout: LayoutSupervisor;
  layoutSpinner: [HTMLElement, () => void] | null = null;

  zoomButton: HTMLElement;
  unzoomButton: HTMLElement;
  resetZoomButton: HTMLElement;
  layoutButton: HTMLElement;
  resetLayoutButton: HTMLElement;

  renderSingletonError() {
    this.el.innerHTML =
      '<i>You cannot render two independent views of the same Sigma widget, sorry...</i>';
  }

  render() {
    super.render();

    if (this.model.get('singleton_lock')) {
      this.renderSingletonError();
      this.singleton = false;
      return;
    }

    this.model.set('singleton_lock', true);
    this.touch();

    this.rng = seedrandom('ipysigma');
    this.el.classList.add('ipysigma-widget');

    const height = this.model.get('height');
    const data = this.model.get('data');

    const graph = buildGraph(data, this.rng);

    this.layout = new LayoutSupervisor(graph, {
      settings: forceAtlas2.inferSettings(graph),
    });

    adjustDimensions(this.el, height);

    const container = document.createElement('div');
    this.el.appendChild(container);
    adjustDimensions(container, height);

    // Description
    this.el.appendChild(createGraphDescription(graph));

    // Camera controls
    this.zoomButton = createElement('div', {
      className: 'ipysigma-button ipysigma-zoom-button ipysigma-svg-icon',
      innerHTML: zoomIcon,
      title: 'zoom',
    });
    this.unzoomButton = createElement('div', {
      className: 'ipysigma-button ipysigma-unzoom-button ipysigma-svg-icon',
      innerHTML: unzoomIcon,
      title: 'unzoom',
    });
    this.resetZoomButton = createElement('div', {
      className: 'ipysigma-button ipysigma-reset-zoom-button ipysigma-svg-icon',
      innerHTML: resetZoomIcon,
      title: 'reset zoom',
    });

    this.el.appendChild(this.zoomButton);
    this.el.appendChild(this.unzoomButton);
    this.el.appendChild(this.resetZoomButton);

    // Layout controls
    this.layoutButton = createElement('div', {
      className: 'ipysigma-button ipysigma-layout-button ipysigma-svg-icon',
      innerHTML: playIcon,
      title: 'start layout',
    });
    this.resetLayoutButton = createElement('div', {
      className:
        'ipysigma-button ipysigma-reset-layout-button ipysigma-svg-icon',
      innerHTML: resetLayoutIcon,
      title: 'reset layout',
    });

    this.el.appendChild(this.layoutButton);
    this.el.appendChild(this.resetLayoutButton);

    // TODO: code button, show/hide function
    this.resetLayoutButton.style.display = 'none';

    // Waiting for widget to be mounted to register events
    this.displayed.then(() => {
      this.renderer = new Sigma(graph, container, selectSigmaSettings(graph));

      this.bindMessageHandlers();
      this.bindCameraHandlers();
      this.bindLayoutHandlers();
    });
  }

  renderSnapshot() {
    this.model.set('snapshot', saveAsPNG(this.renderer));
    this.touch();
  }

  bindMessageHandlers() {
    this.model.on('msg:custom', (content) => {
      if (content.msg === 'render_snapshot') {
        this.renderSnapshot();
      }
    });
  }

  bindCameraHandlers() {
    this.zoomButton.onclick = () => {
      this.renderer.getCamera().animatedZoom();
    };

    this.unzoomButton.onclick = () => {
      this.renderer.getCamera().animatedUnzoom();
    };

    this.resetZoomButton.onclick = () => {
      this.renderer.getCamera().animatedReset();
    };
  }

  bindLayoutHandlers() {
    const stopLayout = () => {
      if (this.layoutSpinner) {
        this.layoutSpinner[1]();
        this.layoutSpinner = null;
      }
      this.layoutButton.innerHTML = playIcon;
      this.layoutButton.setAttribute('title', 'start layout');
      this.layout.stop();
    };

    const startLayout = () => {
      this.layoutSpinner = createSpinner();
      this.layoutButton.innerHTML = pauseIcon;
      this.layoutButton.appendChild(this.layoutSpinner[0]);
      this.layoutButton.setAttribute('title', 'stop layout');
      this.layout.start();
    };

    if (this.model.get('start_layout')) startLayout();

    this.layoutButton.onclick = () => {
      if (this.layout.isRunning()) {
        stopLayout();
      } else {
        startLayout();
      }
    };
  }

  remove() {
    // Cleanup to avoid leaks and free GPU slots
    if (this.renderer) this.renderer.kill();

    if (this.singleton) {
      this.model.set('singleton_lock', false);
      this.touch();
    }

    super.remove();
  }
}
