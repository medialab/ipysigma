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
import Choices from 'choices.js';

import { MODULE_NAME, MODULE_VERSION } from './version';
import saveAsPNG from './saveAsPNG';

import {
  zoomIcon,
  unzoomIcon,
  resetZoomIcon,
  playIcon,
  pauseIcon,
} from './icons';

import 'choices.js/public/assets/styles/choices.min.css';
import '../css/widget.css';

/**
 * Types.
 */
type RNGFunction = () => number;

/**
 * Template.
 */
const TEMPLATE = `
<div id="ipysigma-container"></div>
<div id="ipysigma-left-panel">
  <div id="ipysigma-graph-description"></div>
  <div id="ipysigma-zoom-button" class="ipysigma-button ipysigma-svg-icon" title="zoom">
    ${zoomIcon}
  </div>
  <div id="ipysigma-unzoom-button" class="ipysigma-button ipysigma-svg-icon" title="unzoom">
    ${unzoomIcon}
  </div>
  <div id="ipysigma-reset-zoom-button" class="ipysigma-button ipysigma-svg-icon" title="reset zoom">
    ${resetZoomIcon}
  </div>
  <div id="ipysigma-layout-controls">
    <div id="ipysigma-layout-button" class="ipysigma-button ipysigma-svg-icon" title="start layout">
      ${playIcon}
    </div>
  </div>
</div>
<div id="ipysigma-right-panel">
  <select id="ipysigma-search"></select>
</div>
`;

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
  const span = createElement('span', {
    className: 'ipysigma-spinner',
    innerHTML: SPINNER_STATES[0],
  });

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

function getGraphDescription(graph: Graph): string {
  let graphTitle = `${graph.multi ? 'Multi ' : ''}${
    graph.type === 'undirected' ? 'Undirected' : 'Directed'
  } Graph`;

  let html = `<u>${graphTitle}</u><br><b>${comma(
    graph.order
  )}</b> nodes<br><b>${comma(graph.size)}</b> edges`;

  return html;
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

  layoutControls: HTMLElement;

  zoomButton: HTMLElement;
  unzoomButton: HTMLElement;
  resetZoomButton: HTMLElement;
  layoutButton: HTMLElement;

  choices: Choices;

  renderSingletonError() {
    this.el.innerHTML =
      '<i>You cannot render two independent views of the same Sigma widget, sorry...</i>';
  }

  render() {
    super.render();

    // Lock management
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

    this.el.insertAdjacentHTML('beforeend', TEMPLATE);
    adjustDimensions(this.el, height);

    const container = this.el.querySelector(
      '#ipysigma-container'
    ) as HTMLElement;
    adjustDimensions(container, height);

    // Description
    const description = this.el.querySelector(
      '#ipysigma-graph-description'
    ) as HTMLElement;
    description.innerHTML = getGraphDescription(graph);

    // Camera controls
    this.zoomButton = this.el.querySelector(
      '#ipysigma-zoom-button'
    ) as HTMLElement;
    this.unzoomButton = this.el.querySelector(
      '#ipysigma-unzoom-button'
    ) as HTMLElement;
    this.resetZoomButton = this.el.querySelector(
      '#ipysigma-reset-zoom-button'
    ) as HTMLElement;

    // Layout controls
    this.layoutControls = this.el.querySelector(
      '#ipysigma-layout-controls'
    ) as HTMLElement;
    this.layoutButton = this.el.querySelector(
      '#ipysigma-layout-button'
    ) as HTMLElement;

    // Search
    var searchContainer = this.el.querySelector(
      '#ipysigma-search'
    ) as HTMLElement;

    this.choices = new Choices(searchContainer, {
      items: [{ label: 'apple', value: 'Apple' }],
    });

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
        this.layoutControls.removeChild(this.layoutSpinner[0]);
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
      this.layoutControls.appendChild(this.layoutSpinner[0]);
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
