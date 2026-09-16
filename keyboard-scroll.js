/* Shared keyboard handling for the page and its embedded garage. */
(() => {
  'use strict';
  const arrows = new Set(['ArrowUp', 'ArrowDown']);
  const controls = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="listbox"], [role="slider"], [role="spinbutton"], [role="menu"], [role="menubar"], [role="tree"], [role="grid"], [role="tablist"], audio, video, [data-lenis-prevent], [data-lenis-prevent-keyboard]';
  function ownsArrow(event) {
    for (const element of event.composedPath()) {
      if (!(element instanceof Element)) continue;
      if (element.matches(controls)) return true;
      if (element === document.body || element === document.documentElement) continue;
      if (element.scrollHeight > element.clientHeight + 1 && /^(auto|scroll)$/.test(getComputedStyle(element).overflowY)) return true;
    }
    return false;
  }
  function listen({down, up, reset}) {
    const pressed = new Set();
    const release = () => { pressed.clear(); reset(); };
    document.addEventListener('keydown', event => {
      if (!arrows.has(event.key) || event.defaultPrevented || event.isComposing ||
          event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || ownsArrow(event)) return;
      if (down(event)) {
        pressed.add(event.key);
        event.preventDefault();
      }
    });
    document.addEventListener('keyup', event => {
      if (!pressed.delete(event.key)) return;
      up(event.key);
    });
    window.addEventListener('blur', release);
    window.addEventListener('pagehide', release);
    document.addEventListener('focusin', release);
    document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
  }
  window.PixKeyboard = {listen};
  if (document.currentScript?.hasAttribute('data-forward-to-parent') && parent !== window) {
    const origin = document.referrer ? new URL(document.referrer).origin : '*';
    const send = data => parent.postMessage(data, origin);
    listen({
      down: event => { send({type:'pix3lware:page-key',key:event.key,pressed:true,repeat:event.repeat}); return true; },
      up: key => send({type:'pix3lware:page-key',key,pressed:false}),
      reset: () => send({type:'pix3lware:page-key-reset'})
    });
  }
})();
