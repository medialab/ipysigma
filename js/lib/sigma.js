var widgets = require('@jupyter-widgets/base');
var _ = require('lodash');

var Graph = require('graphology');
var WebGLRenderer = require('sigma/renderers/webgl').default;
var FA2Layout = require('graphology-layout-forceatlas2/worker');
var format = require('d3-format').format;


// Custom Model. Custom widgets models must at least provide default values
// for model attributes, including
//
//  - `_view_name`
//  - `_view_module`
//  - `_view_module_version`
//
//  - `_model_name`
//  - `_model_module`
//  - `_model_module_version`
//
//  when different from the base class.

var START_ICON = '▶';
var PAUSE_ICON = '❚❚';
var RESCALE_ICON = '⊙';
var ZOOM_ICON = '⊕';
var UNZOOM_ICON = '⊖';

var MUTED_COLOR = '#FBFBFB';

var NUMBER_FORMAT = format(',');

function toRGBString(element) {
  var a = element.a,
      r = element.r,
      g = element.g,
      b = element.b;

  return a ?
    ('rgba(' + r + ',' + g + ',' + b + ',' + a + ')') :
    ('rgb(' + r + ',' + g + ',' + b + ')');
}

var DESCRIPTORS = {
    'mixed': 'Mixed',
    'directed': 'Directed',
    'undirected': 'Undirected'
}

function getGraphDescription(graph) {
    return (
        '<b>' +
        (graph.multi ? 'Multi' : 'Simple') +
        ' ' + DESCRIPTORS[graph.type] + ' Graph' +
        '</b>' +
        '<br>' +
        NUMBER_FORMAT(graph.order) + ' nodes' +
        '<br>' +
        NUMBER_FORMAT(graph.size) + ' edges'
    );
}

function getFA2Settings(graph) {
    return {
        barnesHutOptimize: graph.order > 2000,
        strongGravityMode: true,
        gravity: 0.05,
        scalingRatio: 10,
        slowDown: 1 + Math.log(graph.order)
    };
}

function buildGraph(data) {
    var graph = new Graph({type: data.directed ? 'directed': 'undirected'});

    data.nodes.forEach(function(node) {
        var key = node[0];
        var attrs = node[1];

        attrs.z = 1;

        if (!attrs.viz)
            attrs.viz = {};

        if (!attrs.x)
            attrs.x = _.get(attrs, 'viz.position.x', Math.random());
        if (!attrs.y)
            attrs.y = _.get(attrs, 'viz.position.y', Math.random());

        if (!attrs.size)
            attrs.size = _.get(attrs, 'viz.size', 2);

        if (!attrs.color) {
            attrs.color = 'color' in attrs.viz ? toRGBString(attrs.viz.color) : '#333';
            attrs.originalColor = attrs.color;
        }

        if (!attrs.label)
            attrs.label = key;

        graph.addNode(key, attrs);
    });

    data.edges.forEach(function(edge) {
        var source = edge[0];
        var target = edge[1];
        var attrs = edge[2];

        attrs.z = 1;

        if (!attrs.viz)
            attrs.viz = {};

        if (!attrs.color) {
            attrs.color = '#CCC';
            attrs.originalColor = attrs.color;
        }

        if (graph.hasEdge(source, target))
            graph.upgradeToMulti();

        graph.addEdge(source, target, attrs);
    });

    return graph;
}

// When serialiazing the entire widget state for embedding, only values that
// differ from the defaults will be specified.
var SigmaModel = widgets.DOMWidgetModel.extend({
    defaults: _.extend(widgets.DOMWidgetModel.prototype.defaults(), {
        _model_name : 'SigmaModel',
        _view_name : 'SigmaView',
        _model_module : 'ipysigma',
        _view_module : 'ipysigma',
        _model_module_version : '0.1.0',
        _view_module_version : '0.1.0'
    })
});


// Custom View. Renders the widget model.
var SigmaView = widgets.DOMWidgetView.extend({
    initialize: function() {
        this.renderSigma = this.renderSigma.bind(this);
    },

    render: function() {
        var self = this;

        var height = this.model.get('height');
        var data = this.model.get('data');

        this.graph = buildGraph(data);

        var el = this.el;
        el.style.height = height + 'px';

        var container = document.createElement('div');
        container.style.width = '100%';
        container.style.height = height + 'px';

        el.appendChild(container);

        var description = document.createElement('div');
        description.style.position = 'absolute';
        description.style.top = '10px';
        description.style.left = '10px';
        description.style.background = 'rgb(247, 247, 247)';
        description.style.border = '1px solid rgb(207, 207, 207)';
        description.style.padding = '5px';
        description.style.fontSize = '0.8em';
        description.style.fontStyle = 'italic';
        description.style.zIndex = '10';
        description.innerHTML = getGraphDescription(this.graph);

        container.appendChild(description);

        var layoutButton = document.createElement('button');
        layoutButton.style.position = 'absolute';
        layoutButton.style.bottom = '10px';
        layoutButton.style.right = '10px';
        layoutButton.textContent = START_ICON;
        layoutButton.style.zIndex = '10';
        layoutButton.style.width = '28px';
        layoutButton.style.height = '28px';
        layoutButton.style.textAlign = 'center';
        layoutButton.style.backgroundColor = '#fffffe';
        layoutButton.style.paddingTop = '3px';
        layoutButton.style.outline = '0';
        layoutButton.setAttribute('title', 'Start layout');

        layoutButton.onclick = function() {
            if (self.layout && self.layout.running) {
                layoutButton.textContent = START_ICON;
                layoutButton.setAttribute('title', 'Start layout');
                self.layout.stop();
            }
            else {
                layoutButton.textContent = PAUSE_ICON;
                layoutButton.setAttribute('title', 'Stop layout');
                self.layout.start();
            }
        };

        this.layoutButton = layoutButton;

        var unzoomButton = document.createElement('button');

        unzoomButton.style.position = 'absolute';
        unzoomButton.style.bottom = (28 + 5 + 28) + 'px';
        unzoomButton.style.right = '10px';
        unzoomButton.style.zIndex = '10';
        unzoomButton.style.width = '28px';
        unzoomButton.style.height = '28px';
        unzoomButton.style.fontSize = '24px';
        unzoomButton.style.textAlign = 'center';
        unzoomButton.style.backgroundColor = '#fffffe';
        unzoomButton.style.outline = '0';
        unzoomButton.setAttribute('title', 'Unzoom');

        var innerUnzoomButton = document.createElement('div');

        innerUnzoomButton.style.margin = '-11px';
        innerUnzoomButton.textContent = UNZOOM_ICON;

        unzoomButton.appendChild(innerUnzoomButton);

        unzoomButton.onclick = function() {
            var state = self.camera.getState();

            self.camera.animate({ratio: state.ratio * 1.5}, {duration: 150});
        };

        var zoomButton = document.createElement('button');

        zoomButton.style.position = 'absolute';
        zoomButton.style.bottom = (28 + 5 + 28 + 5 + 28) + 'px';
        zoomButton.style.right = '10px';
        zoomButton.style.zIndex = '10';
        zoomButton.style.width = '28px';
        zoomButton.style.height = '28px';
        zoomButton.style.fontSize = '24px';
        zoomButton.style.textAlign = 'center';
        zoomButton.style.backgroundColor = '#fffffe';
        zoomButton.style.outline = '0';
        zoomButton.setAttribute('title', 'Zoom');

        var innerZoomButton = document.createElement('div');

        innerZoomButton.style.margin = '-11px';
        innerZoomButton.textContent = ZOOM_ICON;

        zoomButton.appendChild(innerZoomButton);

        zoomButton.onclick = function() {
            var state = self.camera.getState();

            self.camera.animate({ratio: state.ratio / 1.5}, {duration: 150});
        };

        var rescaleButton = document.createElement('button');

        rescaleButton.style.position = 'absolute';
        rescaleButton.style.bottom = (28 + 5 + 28 + 5 + 28 + 5 + 28) + 'px';
        rescaleButton.style.right = '10px';
        rescaleButton.style.zIndex = '10';
        rescaleButton.style.width = '28px';
        rescaleButton.style.height = '28px';
        rescaleButton.style.fontSize = '24px';
        rescaleButton.style.textAlign = 'center';
        rescaleButton.style.backgroundColor = '#fffffe';
        rescaleButton.style.outline = '0';
        rescaleButton.setAttribute('title', 'Reset camera');

        var innerRescaleButton = document.createElement('div');

        innerRescaleButton.style.margin = '-11px';
        innerRescaleButton.textContent = RESCALE_ICON;

        rescaleButton.appendChild(innerRescaleButton);

        rescaleButton.onclick = function() {
            self.camera.animate({x: 0.5, y: 0.5, ratio: 1});
        };

        container.appendChild(layoutButton);
        container.appendChild(zoomButton);
        container.appendChild(unzoomButton);
        container.appendChild(rescaleButton);

        this.container = container;

        this.dataChanged();
        this.model.on('change:value', this.dataChanged, this);
    },

    dataChanged: function() {
        requestAnimationFrame(this.renderSigma);
    },

    renderSigma: function() {
        var g = this.graph;

        this.renderer = new WebGLRenderer(g, this.container, {
            zIndex: true
        });
        this.camera = this.renderer.getCamera();
        this.layout = new FA2Layout(this.graph, {settings: getFA2Settings(this.graph)});

        var highlightedNodes = new Set(),
            highlightedEdges = new Set();

        function highlightNode(h) {
            highlightedNodes.clear();
            highlightedEdges.clear();
            highlightedNodes.add(h);

            g.forEachNeighbor(h, function(neighbor) {
                highlightedNodes.add(neighbor);
            });

            g.forEachEdge(h, function(edge) {
                highlightedEdges.add(edge);
            });

            g.forEachNode(function(node, attrs) {
                if (highlightedNodes.has(node)) {
                    g.setNodeAttribute(node, 'color', attrs.originalColor);
                    g.setNodeAttribute(node, 'z', 1);
                }
                else {
                    g.setNodeAttribute(node, 'color', MUTED_COLOR);
                    g.setNodeAttribute(node, 'z', 0);
                }
            });

            g.forEachEdge(function(edge, attrs) {
                if (highlightedEdges.has(edge)) {
                    g.setEdgeAttribute(edge, 'color', attrs.originalColor);
                    g.setEdgeAttribute(edge, 'z', 1);
                }
                else {
                    g.setEdgeAttribute(edge, 'color', MUTED_COLOR);
                    g.setEdgeAttribute(edge, 'z', 0);
                }
            });
        }

        function unhighlightNode() {
            if (!highlightedNodes.size)
                return;

            highlightedNodes.clear();
            highlightedEdges.clear();

            g.forEachNode(function(node, attrs) {
                g.setNodeAttribute(node, 'color', attrs.originalColor);
                g.setNodeAttribute(node, 'z', 1);
            });

            g.forEachEdge(function(edge, attrs) {
                g.setEdgeAttribute(edge, 'color', attrs.originalColor);
                g.setEdgeAttribute(edge, 'z', 1);
            });
        }

        this.renderer.on('clickNode', function(data) {
            var node = data.node;

            highlightNode(node);
        });

        this.renderer.on('clickStage', function() {
            unhighlightNode();
        });

        if (this.model.get('start_layout'))
            this.layoutButton.click();
    }
});


module.exports = {
    SigmaModel : SigmaModel,
    SigmaView : SigmaView
};
