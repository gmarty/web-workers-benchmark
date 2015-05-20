import { Controller } from 'components/fxos-mvc/dist/mvc';

import HomeController from 'js/controllers/home';
import LatencyController from 'js/controllers/latency';
import MessageController from 'js/controllers/message';
import CreationController from 'js/controllers/creation';

export default class MainController extends Controller {
  constructor() {
    this.init();
  }

  init() {
    var options = {
      mainController: this
    };

    this.controllers = {
      home: new HomeController(options),
      latency: new LatencyController(options),
      message: new MessageController(options),
      creation: new CreationController(options)
    };
  }

  main() {
    this.setActiveController('home');
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
