// Proxy script that reuses docs assets
(function injectProxy() {
  var script = document.createElement('script');
  script.src = '../../docs/hen/assets/goldhen-host.js';
  document.head.appendChild(script);
})();
