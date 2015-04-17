import { Controller } from 'components/fxos-mvc/dist/mvc';

import LatencyController from 'js/controllers/latency';

export default class MainController extends Controller {
  constructor() {
    this.init();
  }

  init() {
    this.controllers = {
      latency: new LatencyController()
    };
  }

  main() {
    this.setActiveController('latency');
  }

  setActiveController(controllerName) {
    if (this.activeController === this.controllers[controllerName]) {
      return;
    }

    if (this.activeController) {
      this.activeController.teardown();
    }

    this.activeController = this.controllers[controllerName];
    this.activeController.main();
  }
}
