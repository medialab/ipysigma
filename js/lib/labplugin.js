var ipysigma = require('./index');
var base = require('@jupyter-widgets/base');

module.exports = {
  id: 'ipysigma',
  requires: [base.IJupyterWidgetRegistry],
  activate: function(app, widgets) {
      widgets.registerWidget({
          name: 'ipysigma',
          version: ipysigma.version,
          exports: ipysigma
      });
  },
  autoStart: true
};

