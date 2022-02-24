// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

// Add any needed widget imports here (or from controls)
// import {} from '@jupyter-widgets/base';

import { createTestModel } from './utils';

import { SigmaModel } from '..';

describe('Sigma', () => {
  describe('SigmaModel', () => {
    it('should be createable', () => {
      const model = createTestModel(SigmaModel);
      expect(model).toBeInstanceOf(SigmaModel);
      expect(model.get('height')).toEqual(500);
    });

    it('should be createable with a different height', () => {
      const state = { height: 300 };
      const model = createTestModel(SigmaModel, state);
      expect(model).toBeInstanceOf(SigmaModel);
      expect(model.get('height')).toEqual(300);
    });
  });
});
