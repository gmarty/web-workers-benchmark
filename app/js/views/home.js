import { View } from 'components/fxos-mvc/dist/mvc';

var template = `
  <gaia-header>
    <h1>Web workers benchmark</h1>
  </gaia-header>

  <button class="creation">
    <h2>Creation time</h2>
  </button>
  <button class="latency">
    <h2>Latency</h2>
  </button>
  <button class="message">
    <h2>Transfer speed</h2>
  </button>
  `;

export default class HomeView extends View {
  constructor(options) {
    this.graph = {};

    super(options);
  }

  init(controller) {
    super(controller);

    this.render();

    this.on('click', 'button', (evt) => {
      controller.setActiveController(evt.target.className);
    });
  }

  template() {
    return template;
  }

  setActive(active) {
    this.el.classList.toggle('active', active);
  }
}
