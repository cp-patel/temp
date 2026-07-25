/* ============================================================
   Icon set — 20x20 stroke icons, inlined (zero network deps)
   ============================================================ */
(function (global) {
  "use strict";

  var P =
    'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"';

  var D = {
    // ---- brand / nav ----
    bolt: "<path " + P + ' d="M13 2 4.5 12.5h5L9 18l8.5-10.5h-5L13 2Z"/>',
    map:
      "<path " +
      P +
      ' d="M2.5 5.5 7 3.5l6 2 4.5-2v11l-4.5 2-6-2-4.5 2v-11Z"/><path ' +
      P +
      ' d="M7 3.5v11M13 5.5v11"/>',
    home:
      "<path " +
      P +
      ' d="M3.5 8.5 10 3l6.5 5.5V16a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V8.5Z"/><path ' +
      P +
      ' d="M8 17v-5h4v5"/>',
    grid:
      "<rect " +
      P +
      ' x="3" y="3" width="6" height="6" rx="1.5"/><rect ' +
      P +
      ' x="11" y="3" width="6" height="6" rx="1.5"/><rect ' +
      P +
      ' x="3" y="11" width="6" height="6" rx="1.5"/><rect ' +
      P +
      ' x="11" y="11" width="6" height="6" rx="1.5"/>',
    book:
      "<path " +
      P +
      ' d="M3.5 4.5A1.5 1.5 0 0 1 5 3h4.5v14H5a1.5 1.5 0 0 1-1.5-1.5v-11Z"/><path ' +
      P +
      ' d="M16.5 4.5A1.5 1.5 0 0 0 15 3h-4.5v14H15a1.5 1.5 0 0 0 1.5-1.5v-11Z"/>',
    cards:
      "<rect " +
      P +
      ' x="2.5" y="6" width="11" height="11" rx="2"/><path ' +
      P +
      ' d="M6 3.5h8.5A2 2 0 0 1 16.5 5.5V14"/>',
    beaker:
      "<path " +
      P +
      ' d="M7 2.5h6M8 2.5v5.2L3.8 15A1.6 1.6 0 0 0 5.2 17.5h9.6A1.6 1.6 0 0 0 16.2 15L12 7.7V2.5"/><path ' +
      P +
      ' d="M5.4 12.5h9.2"/>',
    hammer:
      "<path " +
      P +
      ' d="M11.5 5.5 8 2 3 7l3.5 3.5L8 9l2.5 2.5"/><path ' +
      P +
      ' d="m10 11.5 5 5a1.8 1.8 0 0 0 2.5-2.5l-5-5"/>',
    settings:
      "<circle " +
      P +
      ' cx="10" cy="10" r="2.6"/><path ' +
      P +
      ' d="M10 2.5v2M10 15.5v2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M2.5 10h2M15.5 10h2M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/>',

    // ---- state ----
    check: "<path " + P + ' d="m4.5 10.5 3.5 3.5 7.5-8"/>',
    checkCircle:
      "<circle " +
      P +
      ' cx="10" cy="10" r="7.5"/><path ' +
      P +
      ' d="m6.8 10.2 2.2 2.2 4.4-4.6"/>',
    x: "<path " + P + ' d="m5 5 10 10M15 5 5 15"/>',
    xCircle:
      "<circle " +
      P +
      ' cx="10" cy="10" r="7.5"/><path ' +
      P +
      ' d="m7.5 7.5 5 5M12.5 7.5l-5 5"/>',
    lock:
      "<rect " +
      P +
      ' x="4" y="8.5" width="12" height="8.5" rx="2"/><path ' +
      P +
      ' d="M6.8 8.5V6.4a3.2 3.2 0 0 1 6.4 0v2.1"/>',
    play: "<path " + P + ' d="M6.5 4.2v11.6l9-5.8-9-5.8Z"/>',
    pause: "<path " + P + ' d="M7 4.5v11M13 4.5v11"/>',
    reset:
      "<path " +
      P +
      ' d="M3.5 10a6.5 6.5 0 1 0 2.1-4.8"/><path ' +
      P +
      ' d="M3 3.5v3h3"/>',
    spark:
      "<path " +
      P +
      ' d="M10 2.5 11.6 7 16 8.6 11.6 10.2 10 14.7 8.4 10.2 4 8.6 8.4 7 10 2.5Z"/><path ' +
      P +
      ' d="M15.5 13.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z"/>',
    flame:
      "<path " +
      P +
      ' d="M10 17.5c3 0 5-2 5-4.8 0-3.6-3.4-4.9-3.4-8.2C11.6 3 10.6 2.5 10 2.5c0 2.6-2 3.6-2 6 0 1 .5 1.7.5 1.7S7.2 9.6 6.4 8.6C5.4 9.8 5 11.2 5 12.7c0 2.8 2 4.8 5 4.8Z"/>',
    trophy:
      "<path " +
      P +
      ' d="M6 3.5h8v3.8a4 4 0 0 1-8 0V3.5Z"/><path ' +
      P +
      ' d="M6 5H4a1.5 1.5 0 0 0 0 3h2M14 5h2a1.5 1.5 0 0 1 0 3h-2"/><path ' +
      P +
      ' d="M10 11.3v2.7M7 16.5h6"/>',
    target:
      "<circle " +
      P +
      ' cx="10" cy="10" r="7.2"/><circle ' +
      P +
      ' cx="10" cy="10" r="3.8"/><circle cx="10" cy="10" r="1.3" fill="currentColor"/>',
    star:
      "<path " +
      P +
      ' d="m10 2.8 2.3 4.9 5.2.7-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2L2.5 8.4l5.2-.7L10 2.8Z"/>',

    // ---- ui ----
    search:
      "<circle " +
      P +
      ' cx="8.8" cy="8.8" r="5.6"/><path ' +
      P +
      ' d="m13 13 4 4"/>',
    chevDown: "<path " + P + ' d="m5 7.5 5 5 5-5"/>',
    chevRight: "<path " + P + ' d="m7.5 5 5 5-5 5"/>',
    chevLeft: "<path " + P + ' d="m12.5 5-5 5 5 5"/>',
    arrowRight: "<path " + P + ' d="M3.5 10h13M11.5 5l5 5-5 5"/>',
    arrowLeft: "<path " + P + ' d="M16.5 10h-13M8.5 5l-5 5 5 5"/>',
    arrowDown: "<path " + P + ' d="M10 3.5v13M5 11.5l5 5 5-5"/>',
    menu: "<path " + P + ' d="M3 6h14M3 10h14M3 14h14"/>',
    copy:
      "<rect " +
      P +
      ' x="7" y="7" width="9.5" height="9.5" rx="1.8"/><path ' +
      P +
      ' d="M13 7V5.2A1.7 1.7 0 0 0 11.3 3.5H5.2A1.7 1.7 0 0 0 3.5 5.2v6.1A1.7 1.7 0 0 0 5.2 13H7"/>',
    ext:
      "<path " +
      P +
      ' d="M11 3.5h5.5V9"/><path ' +
      P +
      ' d="M16.5 3.5 9 11"/><path ' +
      P +
      ' d="M14 12v3.5a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 3 15.5v-8A1.5 1.5 0 0 1 4.5 6H8"/>',
    sun:
      "<circle " +
      P +
      ' cx="10" cy="10" r="3.6"/><path ' +
      P +
      ' d="M10 2v1.8M10 16.2V18M3.4 3.4l1.3 1.3M15.3 15.3l1.3 1.3M2 10h1.8M16.2 10H18M3.4 16.6l1.3-1.3M15.3 4.7l1.3-1.3"/>',
    moon:
      "<path " + P + ' d="M16.5 12.4A7 7 0 0 1 7.6 3.5a7 7 0 1 0 8.9 8.9Z"/>',
    clock:
      "<circle " +
      P +
      ' cx="10" cy="10" r="7.4"/><path ' +
      P +
      ' d="M10 5.8V10l3 1.8"/>',
    layers:
      "<path " +
      P +
      ' d="m10 2.5 7 3.6-7 3.6-7-3.6 7-3.6Z"/><path ' +
      P +
      ' d="m3 10.4 7 3.6 7-3.6"/><path ' +
      P +
      ' d="m3 14.2 7 3.6 7-3.6"/>',
    info:
      "<circle " +
      P +
      ' cx="10" cy="10" r="7.5"/><path ' +
      P +
      ' d="M10 9v4.5M10 6.6h.01"/>',
    alert:
      "<path " +
      P +
      ' d="M10 3.2 2.8 16.2h14.4L10 3.2Z"/><path ' +
      P +
      ' d="M10 8v3.4M10 13.8h.01"/>',
    bulb:
      "<path " +
      P +
      ' d="M7.2 12.4a5 5 0 1 1 5.6 0V14a1 1 0 0 1-1 1H8.2a1 1 0 0 1-1-1v-1.6Z"/><path ' +
      P +
      ' d="M8.4 17.4h3.2"/>',
    shield:
      "<path " +
      P +
      ' d="M10 2.6 4 4.8v5.1c0 3.4 2.4 6.4 6 7.5 3.6-1.1 6-4.1 6-7.5V4.8L10 2.6Z"/><path ' +
      P +
      ' d="m7.6 10 1.8 1.8 3.2-3.4"/>',
    bug:
      "<path " +
      P +
      ' d="M7 5.5a3 3 0 0 1 6 0"/><rect ' +
      P +
      ' x="6.5" y="7" width="7" height="8.5" rx="3.5"/><path ' +
      P +
      ' d="M3.5 9h3M13.5 9h3M3.5 13h3M13.5 13h3M5.5 5.5 7 7M14.5 5.5 13 7M6.5 16.5 8 15M13.5 16.5 12 15"/>',
    brain:
      "<path " +
      P +
      ' d="M8.5 3.5A2.5 2.5 0 0 0 6 6v.4A2.6 2.6 0 0 0 4 9c0 .9.4 1.6 1 2.1-.3.4-.5 1-.5 1.6A2.8 2.8 0 0 0 7.3 15.5c.4.9 1.2 1.5 2.2 1.5V3.5h-1Z"/><path ' +
      P +
      ' d="M11.5 3.5A2.5 2.5 0 0 1 14 6v.4A2.6 2.6 0 0 1 16 9c0 .9-.4 1.6-1 2.1.3.4.5 1 .5 1.6a2.8 2.8 0 0 1-2.8 2.8c-.4.9-1.2 1.5-2.2 1.5"/>',
    db:
      "<ellipse " +
      P +
      ' cx="10" cy="5" rx="6.2" ry="2.5"/><path ' +
      P +
      ' d="M3.8 5v10c0 1.4 2.8 2.5 6.2 2.5s6.2-1.1 6.2-2.5V5"/><path ' +
      P +
      ' d="M3.8 10c0 1.4 2.8 2.5 6.2 2.5s6.2-1.1 6.2-2.5"/>',
    code: "<path " + P + ' d="m7 6.5-4 3.5 4 3.5M13 6.5l4 3.5-4 3.5"/>',
    terminal:
      "<rect " +
      P +
      ' x="2.5" y="3.5" width="15" height="13" rx="2"/><path ' +
      P +
      ' d="m6 8 2 2-2 2M10.5 12.5h3.5"/>',
    tool:
      "<path " +
      P +
      ' d="M11.6 5.6a3.4 3.4 0 0 0 4.5 4.5l1.4 1.4a5 5 0 0 1-7.3-7.3l1.4 1.4Z"/><path ' +
      P +
      ' d="m10 10-6 6M4.5 13.5 6.5 15.5"/>',
    robot:
      "<rect " +
      P +
      ' x="3.5" y="6.5" width="13" height="9.5" rx="2.5"/><path ' +
      P +
      ' d="M10 3v3.5M7.5 11h.01M12.5 11h.01M8 13.8h4"/>',
    chat:
      "<path " +
      P +
      ' d="M17 9.5c0 3.3-3.1 6-7 6-.9 0-1.7-.1-2.5-.4L3.5 16.5l1-3A5.7 5.7 0 0 1 3 9.5c0-3.3 3.1-6 7-6s7 2.7 7 6Z"/>',
    gauge:
      "<path " +
      P +
      ' d="M3.2 14.5a8 8 0 1 1 13.6 0"/><path ' +
      P +
      ' d="m10 10.5 3.2-3.2"/><circle cx="10" cy="11.4" r="1.2" fill="currentColor"/>',
    graph:
      "<path " + P + ' d="M3.5 16.5v-5M8 16.5V6.5M12.5 16.5v-7M17 16.5v-11"/>',
    filter: "<path " + P + ' d="M3 4.5h14l-5.4 6.4v5.1l-3.2-1.8v-3.3L3 4.5Z"/>',
    link:
      "<path " +
      P +
      ' d="M8.2 11.8a3.5 3.5 0 0 1 0-5l1.5-1.5a3.5 3.5 0 0 1 5 5L13.6 11.6"/><path ' +
      P +
      ' d="M11.8 8.2a3.5 3.5 0 0 1 0 5l-1.5 1.5a3.5 3.5 0 0 1-5-5L6.4 8.4"/>',
    doc:
      "<path " +
      P +
      ' d="M11.5 2.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 17.5h8a1.5 1.5 0 0 0 1.5-1.5V6.5l-4-4Z"/><path ' +
      P +
      ' d="M11.5 2.5v4h4M7.5 10.5h5M7.5 13.5h5"/>',
    video:
      "<rect " +
      P +
      ' x="2.5" y="4.5" width="11" height="11" rx="2"/><path ' +
      P +
      ' d="m13.5 9 4-2.5v7L13.5 11"/>',
    grip: '<circle cx="7" cy="5" r="1.3" fill="currentColor"/><circle cx="13" cy="5" r="1.3" fill="currentColor"/><circle cx="7" cy="10" r="1.3" fill="currentColor"/><circle cx="13" cy="10" r="1.3" fill="currentColor"/><circle cx="7" cy="15" r="1.3" fill="currentColor"/><circle cx="13" cy="15" r="1.3" fill="currentColor"/>',
    eye:
      "<path " +
      P +
      ' d="M1.8 10S4.9 4.5 10 4.5 18.2 10 18.2 10 15.1 15.5 10 15.5 1.8 10 1.8 10Z"/><circle ' +
      P +
      ' cx="10" cy="10" r="2.6"/>',
    scissors:
      "<circle " +
      P +
      ' cx="5.5" cy="5.5" r="2.2"/><circle ' +
      P +
      ' cx="5.5" cy="14.5" r="2.2"/><path ' +
      P +
      ' d="m7.4 6.8 9.1 8.4M16.5 4.8 7.4 13.2"/>',
    compass:
      "<circle " +
      P +
      ' cx="10" cy="10" r="7.5"/><path ' +
      P +
      ' d="m12.8 7.2-1.6 4-4 1.6 1.6-4 4-1.6Z"/>',
    rocket:
      "<path " +
      P +
      ' d="M9 12.5 7.5 11c0-4 2.5-7.5 6.5-8.5.5 4-.5 7-4 9.5-.5.4-1 .5-1 .5Z"/><path ' +
      P +
      ' d="M7.5 11 5 11.5c-.5-2 0-3 1.5-3.5M9 12.5l-.5 2.5c2 .5 3 0 3.5-1.5"/><path ' +
      P +
      ' d="M6 14c-1 1-1.2 2.5-1.2 2.5S6.3 16.3 7.3 15.3"/>',
    layersAlt:
      "<rect " +
      P +
      ' x="3" y="3" width="14" height="5" rx="1.5"/><rect ' +
      P +
      ' x="3" y="12" width="14" height="5" rx="1.5"/>',
    scale:
      "<path " +
      P +
      ' d="M10 3v14M5 6h10M4 6 2 11h4L4 6ZM16 6l-2 5h4l-2-5Z"/><path ' +
      P +
      ' d="M7 17h6"/>',
    trash:
      "<path " +
      P +
      ' d="M3.5 5.5h13M7 5.5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5"/><path ' +
      P +
      ' d="M5 5.5 5.8 16a1.5 1.5 0 0 0 1.5 1.4h5.4A1.5 1.5 0 0 0 14.2 16L15 5.5"/>',
    down: "<path " + P + ' d="M10 3v10M6 9.5l4 4 4-4M4 16.5h12"/>',
    up: "<path " + P + ' d="M10 17V7M6 10.5l4-4 4 4M4 3.5h12"/>',
    dollar:
      "<path " +
      P +
      ' d="M10 2.5v15"/><path ' +
      P +
      ' d="M13.5 6.2C13.5 4.7 12 3.8 10 3.8s-3.5.9-3.5 2.4c0 3.8 7 1.9 7 5.6 0 1.6-1.5 2.5-3.5 2.5s-3.5-.9-3.5-2.5"/>',
    split:
      "<path " +
      P +
      ' d="M3.5 5.5h3l4 9h6M16.5 14.5l-2-2M16.5 14.5l-2 2"/><path ' +
      P +
      ' d="M10.5 5.5h6M16.5 5.5l-2-2M16.5 5.5l-2 2"/>',
    zap: "<path " + P + ' d="M11 2.5 5 11h4l-1 6.5 6-8.5h-4l1-6.5Z"/>',
    inbox:
      "<path " +
      P +
      ' d="M2.5 10.5h4l1.5 2.5h4l1.5-2.5h4"/><path ' +
      P +
      ' d="M4.6 4h10.8l2.1 6.5v5A1.5 1.5 0 0 1 16 17H4a1.5 1.5 0 0 1-1.5-1.5v-5L4.6 4Z"/>',
  };

  function svg(name, size) {
    var d = D[name];
    if (!d) d = D.info;
    var s = size || 20;
    return (
      '<svg viewBox="0 0 20 20" width="' +
      s +
      '" height="' +
      s +
      '" aria-hidden="true" focusable="false">' +
      d +
      "</svg>"
    );
  }

  global.Icons = {
    get: svg,
    has: function (n) {
      return !!D[n];
    },
  };
})(window);
