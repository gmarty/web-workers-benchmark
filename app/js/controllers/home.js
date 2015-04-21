/* Main page to select a type of benchmark. */

import { Controller } from 'components/fxos-mvc/dist/mvc';

import HomeView from 'js/views/home';

export default class HomeController extends Controller {
  constructor(options) {
    this.view = new HomeView({
      el: document.getElementById('home')
    });
    super(options);
  }

  main() {
    this.view.setActive(true);
  }

  teardown() {
    this.view.setActive(false);
  }

  setActiveController(controllerName = 'home') {
    this.mainController.setActiveController(controllerName);
  }
}
