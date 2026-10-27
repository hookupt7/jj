// Home is one full screen: the hero film (autoplayed by fx.autoplayVideos) and embers. Nothing else.
import { $ } from '../core.js';
import { embers } from '../fx.js';

export default function home() {
  embers($('[data-embers]'));
}
