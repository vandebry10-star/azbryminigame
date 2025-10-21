/* Loader engine — offline dulu (kalau ada), kalau tidak fallback CDN via chess.html */
(function(){
  if (typeof window.Chess === 'function') return; // sudah ada
  // coba muat vendor lokal kalau kamu punya: assets/js/vendor/chess.min.js
  var local = document.createElement('script');
  local.src = 'assets/js/vendor/chess.min.js';
  local.onload = function(){
    if (typeof window.Chess !== 'function' && window.chess?.Chess) {
      window.Chess = window.chess.Chess;
    }
  };
  local.onerror = function(){
    // biarkan chess.html yang fallback ke CDN
  };
  (document.head || document.body).appendChild(local);
})();
