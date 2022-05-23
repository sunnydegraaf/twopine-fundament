function noop() {
}
const identity = (x) => x;
function run(fn) {
  return fn();
}
function blank_object() {
  return /* @__PURE__ */ Object.create(null);
}
function run_all(fns) {
  fns.forEach(run);
}
function is_function(thing) {
  return typeof thing === "function";
}
function safe_not_equal(a, b) {
  return a != a ? b == b : a !== b || (a && typeof a === "object" || typeof a === "function");
}
function is_empty(obj) {
  return Object.keys(obj).length === 0;
}
const is_client = typeof window !== "undefined";
let now = is_client ? () => window.performance.now() : () => Date.now();
let raf = is_client ? (cb) => requestAnimationFrame(cb) : noop;
const tasks = /* @__PURE__ */ new Set();
function run_tasks(now2) {
  tasks.forEach((task) => {
    if (!task.c(now2)) {
      tasks.delete(task);
      task.f();
    }
  });
  if (tasks.size !== 0)
    raf(run_tasks);
}
function loop(callback) {
  let task;
  if (tasks.size === 0)
    raf(run_tasks);
  return {
    promise: new Promise((fulfill) => {
      tasks.add(task = { c: callback, f: fulfill });
    }),
    abort() {
      tasks.delete(task);
    }
  };
}
function append(target, node) {
  target.appendChild(node);
}
function get_root_for_style(node) {
  if (!node)
    return document;
  const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
  if (root && root.host) {
    return root;
  }
  return node.ownerDocument;
}
function append_empty_stylesheet(node) {
  const style_element = element("style");
  append_stylesheet(get_root_for_style(node), style_element);
  return style_element.sheet;
}
function append_stylesheet(node, style) {
  append(node.head || node, style);
}
function insert(target, node, anchor) {
  target.insertBefore(node, anchor || null);
}
function detach(node) {
  node.parentNode.removeChild(node);
}
function element(name2) {
  return document.createElement(name2);
}
function svg_element(name2) {
  return document.createElementNS("http://www.w3.org/2000/svg", name2);
}
function text(data) {
  return document.createTextNode(data);
}
function space() {
  return text(" ");
}
function empty() {
  return text("");
}
function listen(node, event, handler, options) {
  node.addEventListener(event, handler, options);
  return () => node.removeEventListener(event, handler, options);
}
function attr(node, attribute, value) {
  if (value == null)
    node.removeAttribute(attribute);
  else if (node.getAttribute(attribute) !== value)
    node.setAttribute(attribute, value);
}
function children(element2) {
  return Array.from(element2.childNodes);
}
function set_data(text2, data) {
  data = "" + data;
  if (text2.wholeText !== data)
    text2.data = data;
}
function set_style(node, key, value, important) {
  if (value === null) {
    node.style.removeProperty(key);
  } else {
    node.style.setProperty(key, value, important ? "important" : "");
  }
}
function toggle_class(element2, name2, toggle) {
  element2.classList[toggle ? "add" : "remove"](name2);
}
function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
  const e = document.createEvent("CustomEvent");
  e.initCustomEvent(type, bubbles, cancelable, detail);
  return e;
}
function attribute_to_object(attributes) {
  const result = {};
  for (const attribute of attributes) {
    result[attribute.name] = attribute.value;
  }
  return result;
}
const managed_styles = /* @__PURE__ */ new Map();
let active = 0;
function hash(str) {
  let hash2 = 5381;
  let i = str.length;
  while (i--)
    hash2 = (hash2 << 5) - hash2 ^ str.charCodeAt(i);
  return hash2 >>> 0;
}
function create_style_information(doc, node) {
  const info = { stylesheet: append_empty_stylesheet(node), rules: {} };
  managed_styles.set(doc, info);
  return info;
}
function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
  const step = 16.666 / duration;
  let keyframes = "{\n";
  for (let p = 0; p <= 1; p += step) {
    const t = a + (b - a) * ease(p);
    keyframes += p * 100 + `%{${fn(t, 1 - t)}}
`;
  }
  const rule = keyframes + `100% {${fn(b, 1 - b)}}
}`;
  const name2 = `__svelte_${hash(rule)}_${uid}`;
  const doc = get_root_for_style(node);
  const { stylesheet, rules } = managed_styles.get(doc) || create_style_information(doc, node);
  if (!rules[name2]) {
    rules[name2] = true;
    stylesheet.insertRule(`@keyframes ${name2} ${rule}`, stylesheet.cssRules.length);
  }
  const animation = node.style.animation || "";
  node.style.animation = `${animation ? `${animation}, ` : ""}${name2} ${duration}ms linear ${delay}ms 1 both`;
  active += 1;
  return name2;
}
function delete_rule(node, name2) {
  const previous = (node.style.animation || "").split(", ");
  const next = previous.filter(name2 ? (anim) => anim.indexOf(name2) < 0 : (anim) => anim.indexOf("__svelte") === -1);
  const deleted = previous.length - next.length;
  if (deleted) {
    node.style.animation = next.join(", ");
    active -= deleted;
    if (!active)
      clear_rules();
  }
}
function clear_rules() {
  raf(() => {
    if (active)
      return;
    managed_styles.forEach((info) => {
      const { stylesheet } = info;
      let i = stylesheet.cssRules.length;
      while (i--)
        stylesheet.deleteRule(i);
      info.rules = {};
    });
    managed_styles.clear();
  });
}
let current_component;
function set_current_component(component) {
  current_component = component;
}
function get_current_component() {
  if (!current_component)
    throw new Error("Function called outside component initialization");
  return current_component;
}
const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
  if (!update_scheduled) {
    update_scheduled = true;
    resolved_promise.then(flush);
  }
}
function add_render_callback(fn) {
  render_callbacks.push(fn);
}
const seen_callbacks = /* @__PURE__ */ new Set();
let flushidx = 0;
function flush() {
  const saved_component = current_component;
  do {
    while (flushidx < dirty_components.length) {
      const component = dirty_components[flushidx];
      flushidx++;
      set_current_component(component);
      update(component.$$);
    }
    set_current_component(null);
    dirty_components.length = 0;
    flushidx = 0;
    while (binding_callbacks.length)
      binding_callbacks.pop()();
    for (let i = 0; i < render_callbacks.length; i += 1) {
      const callback = render_callbacks[i];
      if (!seen_callbacks.has(callback)) {
        seen_callbacks.add(callback);
        callback();
      }
    }
    render_callbacks.length = 0;
  } while (dirty_components.length);
  while (flush_callbacks.length) {
    flush_callbacks.pop()();
  }
  update_scheduled = false;
  seen_callbacks.clear();
  set_current_component(saved_component);
}
function update($$) {
  if ($$.fragment !== null) {
    $$.update();
    run_all($$.before_update);
    const dirty = $$.dirty;
    $$.dirty = [-1];
    $$.fragment && $$.fragment.p($$.ctx, dirty);
    $$.after_update.forEach(add_render_callback);
  }
}
let promise;
function wait() {
  if (!promise) {
    promise = Promise.resolve();
    promise.then(() => {
      promise = null;
    });
  }
  return promise;
}
function dispatch(node, direction, kind) {
  node.dispatchEvent(custom_event(`${direction ? "intro" : "outro"}${kind}`));
}
const outroing = /* @__PURE__ */ new Set();
let outros;
function group_outros() {
  outros = {
    r: 0,
    c: [],
    p: outros
  };
}
function check_outros() {
  if (!outros.r) {
    run_all(outros.c);
  }
  outros = outros.p;
}
function transition_in(block, local) {
  if (block && block.i) {
    outroing.delete(block);
    block.i(local);
  }
}
function transition_out(block, local, detach2, callback) {
  if (block && block.o) {
    if (outroing.has(block))
      return;
    outroing.add(block);
    outros.c.push(() => {
      outroing.delete(block);
      if (callback) {
        if (detach2)
          block.d(1);
        callback();
      }
    });
    block.o(local);
  }
}
const null_transition = { duration: 0 };
function create_bidirectional_transition(node, fn, params, intro) {
  let config = fn(node, params);
  let t = intro ? 0 : 1;
  let running_program = null;
  let pending_program = null;
  let animation_name = null;
  function clear_animation() {
    if (animation_name)
      delete_rule(node, animation_name);
  }
  function init2(program, duration) {
    const d = program.b - t;
    duration *= Math.abs(d);
    return {
      a: t,
      b: program.b,
      d,
      duration,
      start: program.start,
      end: program.start + duration,
      group: program.group
    };
  }
  function go(b) {
    const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
    const program = {
      start: now() + delay,
      b
    };
    if (!b) {
      program.group = outros;
      outros.r += 1;
    }
    if (running_program || pending_program) {
      pending_program = program;
    } else {
      if (css) {
        clear_animation();
        animation_name = create_rule(node, t, b, duration, delay, easing, css);
      }
      if (b)
        tick(0, 1);
      running_program = init2(program, duration);
      add_render_callback(() => dispatch(node, b, "start"));
      loop((now2) => {
        if (pending_program && now2 > pending_program.start) {
          running_program = init2(pending_program, duration);
          pending_program = null;
          dispatch(node, running_program.b, "start");
          if (css) {
            clear_animation();
            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
          }
        }
        if (running_program) {
          if (now2 >= running_program.end) {
            tick(t = running_program.b, 1 - t);
            dispatch(node, running_program.b, "end");
            if (!pending_program) {
              if (running_program.b) {
                clear_animation();
              } else {
                if (!--running_program.group.r)
                  run_all(running_program.group.c);
              }
            }
            running_program = null;
          } else if (now2 >= running_program.start) {
            const p = now2 - running_program.start;
            t = running_program.a + running_program.d * easing(p / running_program.duration);
            tick(t, 1 - t);
          }
        }
        return !!(running_program || pending_program);
      });
    }
  }
  return {
    run(b) {
      if (is_function(config)) {
        wait().then(() => {
          config = config();
          go(b);
        });
      } else {
        go(b);
      }
    },
    end() {
      clear_animation();
      running_program = pending_program = null;
    }
  };
}
function mount_component(component, target, anchor, customElement) {
  const { fragment, on_mount, on_destroy, after_update } = component.$$;
  fragment && fragment.m(target, anchor);
  if (!customElement) {
    add_render_callback(() => {
      const new_on_destroy = on_mount.map(run).filter(is_function);
      if (on_destroy) {
        on_destroy.push(...new_on_destroy);
      } else {
        run_all(new_on_destroy);
      }
      component.$$.on_mount = [];
    });
  }
  after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
  const $$ = component.$$;
  if ($$.fragment !== null) {
    run_all($$.on_destroy);
    $$.fragment && $$.fragment.d(detaching);
    $$.on_destroy = $$.fragment = null;
    $$.ctx = [];
  }
}
function make_dirty(component, i) {
  if (component.$$.dirty[0] === -1) {
    dirty_components.push(component);
    schedule_update();
    component.$$.dirty.fill(0);
  }
  component.$$.dirty[i / 31 | 0] |= 1 << i % 31;
}
function init(component, options, instance2, create_fragment2, not_equal, props, append_styles, dirty = [-1]) {
  const parent_component = current_component;
  set_current_component(component);
  const $$ = component.$$ = {
    fragment: null,
    ctx: null,
    props,
    update: noop,
    not_equal,
    bound: blank_object(),
    on_mount: [],
    on_destroy: [],
    on_disconnect: [],
    before_update: [],
    after_update: [],
    context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
    callbacks: blank_object(),
    dirty,
    skip_bound: false,
    root: options.target || parent_component.$$.root
  };
  append_styles && append_styles($$.root);
  let ready = false;
  $$.ctx = instance2 ? instance2(component, options.props || {}, (i, ret, ...rest) => {
    const value = rest.length ? rest[0] : ret;
    if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
      if (!$$.skip_bound && $$.bound[i])
        $$.bound[i](value);
      if (ready)
        make_dirty(component, i);
    }
    return ret;
  }) : [];
  $$.update();
  ready = true;
  run_all($$.before_update);
  $$.fragment = create_fragment2 ? create_fragment2($$.ctx) : false;
  if (options.target) {
    if (options.hydrate) {
      const nodes = children(options.target);
      $$.fragment && $$.fragment.l(nodes);
      nodes.forEach(detach);
    } else {
      $$.fragment && $$.fragment.c();
    }
    if (options.intro)
      transition_in(component.$$.fragment);
    mount_component(component, options.target, options.anchor, options.customElement);
    flush();
  }
  set_current_component(parent_component);
}
let SvelteElement;
if (typeof HTMLElement === "function") {
  SvelteElement = class extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
    }
    connectedCallback() {
      const { on_mount } = this.$$;
      this.$$.on_disconnect = on_mount.map(run).filter(is_function);
      for (const key in this.$$.slotted) {
        this.appendChild(this.$$.slotted[key]);
      }
    }
    attributeChangedCallback(attr2, _oldValue, newValue) {
      this[attr2] = newValue;
    }
    disconnectedCallback() {
      run_all(this.$$.on_disconnect);
    }
    $destroy() {
      destroy_component(this, 1);
      this.$destroy = noop;
    }
    $on(type, callback) {
      const callbacks = this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
      callbacks.push(callback);
      return () => {
        const index = callbacks.indexOf(callback);
        if (index !== -1)
          callbacks.splice(index, 1);
      };
    }
    $set($$props) {
      if (this.$$set && !is_empty($$props)) {
        this.$$.skip_bound = true;
        this.$$set($$props);
        this.$$.skip_bound = false;
      }
    }
  };
}
function cubicOut(t) {
  const f = t - 1;
  return f * f * f + 1;
}
function fade(node, { delay = 0, duration = 400, easing = identity } = {}) {
  const o = +getComputedStyle(node).opacity;
  return {
    delay,
    duration,
    easing,
    css: (t) => `opacity: ${t * o}`
  };
}
function slide(node, { delay = 0, duration = 400, easing = cubicOut } = {}) {
  const style = getComputedStyle(node);
  const opacity = +style.opacity;
  const height = parseFloat(style.height);
  const padding_top = parseFloat(style.paddingTop);
  const padding_bottom = parseFloat(style.paddingBottom);
  const margin_top = parseFloat(style.marginTop);
  const margin_bottom = parseFloat(style.marginBottom);
  const border_top_width = parseFloat(style.borderTopWidth);
  const border_bottom_width = parseFloat(style.borderBottomWidth);
  return {
    delay,
    duration,
    easing,
    css: (t) => `overflow: hidden;opacity: ${Math.min(t * 20, 1) * opacity};height: ${t * height}px;padding-top: ${t * padding_top}px;padding-bottom: ${t * padding_bottom}px;margin-top: ${t * margin_top}px;margin-bottom: ${t * margin_bottom}px;border-top-width: ${t * border_top_width}px;border-bottom-width: ${t * border_bottom_width}px;`
  };
}
function create_if_block$1(ctx) {
  let div;
  let div_transition;
  let current;
  return {
    c() {
      div = element("div");
      div.innerHTML = `<slot></slot>`;
    },
    m(target, anchor) {
      insert(target, div, anchor);
      current = true;
    },
    i(local) {
      if (current)
        return;
      add_render_callback(() => {
        if (!div_transition)
          div_transition = create_bidirectional_transition(div, slide, { duration: 300 }, true);
        div_transition.run(1);
      });
      current = true;
    },
    o(local) {
      if (!div_transition)
        div_transition = create_bidirectional_transition(div, slide, { duration: 300 }, false);
      div_transition.run(0);
      current = false;
    },
    d(detaching) {
      if (detaching)
        detach(div);
      if (detaching && div_transition)
        div_transition.end();
    }
  };
}
function create_fragment$5(ctx) {
  let div;
  let button;
  let t0;
  let t1;
  let svg;
  let path;
  let t2;
  let current;
  let mounted;
  let dispose;
  let if_block = ctx[1] && create_if_block$1();
  return {
    c() {
      div = element("div");
      button = element("button");
      t0 = text(ctx[0]);
      t1 = space();
      svg = svg_element("svg");
      path = svg_element("path");
      t2 = space();
      if (if_block)
        if_block.c();
      this.c = noop;
      attr(path, "d", "M9 5l7 7-7 7");
      attr(svg, "style", "tran");
      attr(svg, "width", "20");
      attr(svg, "height", "20");
      attr(svg, "fill", "none");
      attr(svg, "stroke-linecap", "round");
      attr(svg, "stroke-linejoin", "round");
      attr(svg, "stroke-width", "2");
      attr(svg, "viewBox", "0 0 24 24");
      attr(svg, "stroke", "currentColor");
      attr(button, "aria-expanded", ctx[1]);
    },
    m(target, anchor) {
      insert(target, div, anchor);
      append(div, button);
      append(button, t0);
      append(button, t1);
      append(button, svg);
      append(svg, path);
      append(div, t2);
      if (if_block)
        if_block.m(div, null);
      current = true;
      if (!mounted) {
        dispose = listen(button, "click", ctx[2]);
        mounted = true;
      }
    },
    p(ctx2, [dirty]) {
      if (!current || dirty & 1)
        set_data(t0, ctx2[0]);
      if (!current || dirty & 2) {
        attr(button, "aria-expanded", ctx2[1]);
      }
      if (ctx2[1]) {
        if (if_block) {
          if (dirty & 2) {
            transition_in(if_block, 1);
          }
        } else {
          if_block = create_if_block$1();
          if_block.c();
          transition_in(if_block, 1);
          if_block.m(div, null);
        }
      } else if (if_block) {
        group_outros();
        transition_out(if_block, 1, 1, () => {
          if_block = null;
        });
        check_outros();
      }
    },
    i(local) {
      if (current)
        return;
      transition_in(if_block);
      current = true;
    },
    o(local) {
      transition_out(if_block);
      current = false;
    },
    d(detaching) {
      if (detaching)
        detach(div);
      if (if_block)
        if_block.d();
      mounted = false;
      dispose();
    }
  };
}
function instance$4($$self, $$props, $$invalidate) {
  let isOpen = false;
  const toggle = () => $$invalidate(1, isOpen = !isOpen);
  let { title } = $$props;
  $$self.$$set = ($$props2) => {
    if ("title" in $$props2)
      $$invalidate(0, title = $$props2.title);
  };
  return [title, isOpen, toggle];
}
class Accordion extends SvelteElement {
  constructor(options) {
    super();
    this.shadowRoot.innerHTML = `<style>button{width:100%;border:none;background:var(--color-neutral-tint-100);display:block;color:inherit;cursor:pointer;margin:0;padding-bottom:0.5em;padding-top:0.5em}svg{transition:transform 0.2s ease-in}[aria-expanded="true"] svg{transform:rotate(0.25turn)}</style>`;
    init(this, {
      target: this.shadowRoot,
      props: attribute_to_object(this.attributes),
      customElement: true
    }, instance$4, create_fragment$5, safe_not_equal, { title: 0 }, null);
    if (options) {
      if (options.target) {
        insert(options.target, this, options.anchor);
      }
      if (options.props) {
        this.$set(options.props);
        flush();
      }
    }
  }
  static get observedAttributes() {
    return ["title"];
  }
  get title() {
    return this.$$.ctx[0];
  }
  set title(title) {
    this.$$set({ title });
    flush();
  }
}
customElements.define("twopine-accordion", Accordion);
function create_fragment$4(ctx) {
  let button;
  let slot;
  let mounted;
  let dispose;
  return {
    c() {
      button = element("button");
      slot = element("slot");
      this.c = noop;
      attr(button, "class", ctx[0]);
      button.disabled = ctx[1];
    },
    m(target, anchor) {
      insert(target, button, anchor);
      append(button, slot);
      if (!mounted) {
        dispose = listen(button, "click", ctx[2]);
        mounted = true;
      }
    },
    p(ctx2, [dirty]) {
      if (dirty & 1) {
        attr(button, "class", ctx2[0]);
      }
      if (dirty & 2) {
        button.disabled = ctx2[1];
      }
    },
    i: noop,
    o: noop,
    d(detaching) {
      if (detaching)
        detach(button);
      mounted = false;
      dispose();
    }
  };
}
function instance$3($$self, $$props, $$invalidate) {
  let { type } = $$props;
  let { disabled = false } = $$props;
  const thisComponent = get_current_component();
  const dispatchEvent = (name2, detail) => {
    thisComponent.dispatchEvent(new CustomEvent(name2, { detail, composed: true }));
  };
  function handleClick(event) {
    event.preventDefault();
    dispatchEvent("customClick", name);
    console.log("log");
  }
  $$self.$$set = ($$props2) => {
    if ("type" in $$props2)
      $$invalidate(0, type = $$props2.type);
    if ("disabled" in $$props2)
      $$invalidate(1, disabled = $$props2.disabled);
  };
  return [type, disabled, handleClick];
}
class Button extends SvelteElement {
  constructor(options) {
    super();
    this.shadowRoot.innerHTML = `<style>button{transition:ease-in-out 0.2s all;box-sizing:content-box;padding:var(--padding);color:var(--color-neutral-10);font-size:var(--font-size);border-radius:var(--border-radius);border-width:var(--border-width);border-style:var(--border-style);border-color:var(--color-primary);background-color:var(--color-primary);cursor:pointer}button:hover{transition:ease-in-out 0.2s all}button:hover{background-color:var(--color-primary-hover)}button:active{background-color:var(--color-primary-pressed)}button:focus-visible{outline:var(--border-width) var(--border-style)
            var(--color-primary-focus)}button.outline:focus-visible{border-color:transparent}button:disabled,button.secondary:disabled,button.outline:disabled,button.text:disabled,button[disabled]{border:var(--border-width) var(--border-style) var(--color-neutral-20);background-color:var(--color-neutral-20);color:var(--color-neutral-50);cursor:not-allowed}button:disabled:hover,button.outline:disabled:hover{color:var(--color-neutral-50)}button.secondary:disabled:hover{border-color:var(--color-neutral-20)}button.secondary{color:var(--color-primary);background:var(--color-primary-bg);border-color:var(--color-primary-bg)}button.secondary:hover{transition:ease-in-out 0.2s all;border-color:var(--color-primary)}button.secondary:active{background-color:var(--color-primary-bg);border-color:var(--color-primary-bg)}button.outline{color:var(--color-primary);background:var(--color-primary-bg);border-color:var(--color-primary-border)}button.outline:hover{border-color:var(--color-primary-hover)}button.outline:active{color:var(--color-primary-pressed)}button.outline:disabled{border-color:var(--color-neutral-40)}button.text{color:var(--color-primary);background:transparent;border-color:transparent}button.text:hover{border-color:var(--color-primary-hover)}button.text:active{color:var(--color-primary-pressed);border-color:transparent}button.text:disabled{border-color:transparent;background-color:transparent}</style>`;
    init(this, {
      target: this.shadowRoot,
      props: attribute_to_object(this.attributes),
      customElement: true
    }, instance$3, create_fragment$4, safe_not_equal, { type: 0, disabled: 1 }, null);
    if (options) {
      if (options.target) {
        insert(options.target, this, options.anchor);
      }
      if (options.props) {
        this.$set(options.props);
        flush();
      }
    }
  }
  static get observedAttributes() {
    return ["type", "disabled"];
  }
  get type() {
    return this.$$.ctx[0];
  }
  set type(type) {
    this.$$set({ type });
    flush();
  }
  get disabled() {
    return this.$$.ctx[1];
  }
  set disabled(disabled) {
    this.$$set({ disabled });
    flush();
  }
}
customElements.define("twopine-button", Button);
function create_fragment$3(ctx) {
  let div2;
  return {
    c() {
      div2 = element("div");
      div2.innerHTML = `<slot name="badge" class="badge"></slot> 
    <div class="image-container"><slot name="image" class="image"></slot></div> 
    <div class="info"><slot name="title"></slot> 
        <slot name="button"></slot></div>`;
      this.c = noop;
      attr(div2, "class", "card");
    },
    m(target, anchor) {
      insert(target, div2, anchor);
    },
    p: noop,
    i: noop,
    o: noop,
    d(detaching) {
      if (detaching)
        detach(div2);
    }
  };
}
class Card extends SvelteElement {
  constructor(options) {
    super();
    this.shadowRoot.innerHTML = `<style>.card{background-color:var(--color-secundary);position:relative;border-radius:var(--border-radius);box-shadow:var(--box-shadow)}.card .image::slotted(img){width:100%;padding:15% 20%;transition:0.2s;transform:scale(1)}.card .image::slotted(img:hover){transform:scale(1.05)}.badge{position:absolute;top:5%;left:-10px}.info{width:100%;position:absolute;bottom:5%;left:-10px}.badge::slotted(twopine-badge){position:absolute;top:5%;left:-10px}</style>`;
    init(this, {
      target: this.shadowRoot,
      props: attribute_to_object(this.attributes),
      customElement: true
    }, null, create_fragment$3, safe_not_equal, {}, null);
    if (options) {
      if (options.target) {
        insert(options.target, this, options.anchor);
      }
    }
  }
}
customElements.define("twopine-card", Card);
function create_fragment$2(ctx) {
  let div2;
  let div0;
  let t1;
  let div1;
  let slot;
  let mounted;
  let dispose;
  return {
    c() {
      div2 = element("div");
      div0 = element("div");
      div0.textContent = "Dropdown";
      t1 = space();
      div1 = element("div");
      slot = element("slot");
      this.c = noop;
      attr(div0, "class", "button");
      toggle_class(div0, "open", ctx[0]);
      attr(slot, "class", "item " + divider);
      attr(slot, "name", "item");
      attr(div1, "class", "menu");
      attr(div2, "class", "dropdown");
    },
    m(target, anchor) {
      insert(target, div2, anchor);
      append(div2, div0);
      append(div2, t1);
      append(div2, div1);
      append(div1, slot);
      if (!mounted) {
        dispose = listen(div0, "click", ctx[1]);
        mounted = true;
      }
    },
    p(ctx2, [dirty]) {
      if (dirty & 1) {
        toggle_class(div0, "open", ctx2[0]);
      }
    },
    i: noop,
    o: noop,
    d(detaching) {
      if (detaching)
        detach(div2);
      mounted = false;
      dispose();
    }
  };
}
let divider = false;
function instance$2($$self, $$props, $$invalidate) {
  let open = false;
  const click_handler = () => $$invalidate(0, open = !open);
  return [open, click_handler];
}
class Dropdown extends SvelteElement {
  constructor(options) {
    super();
    this.shadowRoot.innerHTML = `<style>.dropdown{display:inline-block;position:relative}.button{display:inline-block;border:var(--border);border-radius:var(--border-radius);padding:10px 30px 10px 20px;background-color:var(--color-primary-20);cursor:pointer;white-space:nowrap}.button:after{transform:rotate(0deg);transition:transform .2s ease-in-out;content:'';position:absolute;top:50%;right:15px;transform:translateY(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:5px solid var(--color-neutral)}.button.open:after{transition:transform .2s ease-in-out;transform:rotate(180deg)}.button:hover{background-color:var(--color-primary-20)}.input{display:none}.menu{position:absolute;top:100%;border:1px solid #ccc;border-radius:var(--border-radius);padding:0;margin:2px 0 0 0;box-shadow:var(--box-shadow);background-color:#ffffff;list-style-type:none}.button~.menu{transition:all .2s ease-in-out;opacity:0;height:0;visibility:hidden;overflow:hidden}.button.open~.menu{transition:all .2s ease-in-out;opacity:1;height:fit-content;visibility:visible}.menu .item{padding:10px 20px;cursor:pointer;white-space:nowrap}.menu .item::slotted(*){display:block;margin:-10px -20px;padding:10px 20px}.menu .item::slotted(*:hover){background-color:var(--color-primary-20)}.menu .item::slotted(.divider){padding:0;border-bottom:1px solid var(--color-primary-20)
}</style>`;
    init(this, {
      target: this.shadowRoot,
      props: attribute_to_object(this.attributes),
      customElement: true
    }, instance$2, create_fragment$2, safe_not_equal, {}, null);
    if (options) {
      if (options.target) {
        insert(options.target, this, options.anchor);
      }
    }
  }
}
customElements.define("twopine-dropdown", Dropdown);
function create_if_block(ctx) {
  let div1;
  let div0;
  let t0;
  let span;
  let slot1;
  let svg;
  let g;
  let path;
  let div1_transition;
  let t1;
  let div2;
  let current;
  let mounted;
  let dispose;
  return {
    c() {
      div1 = element("div");
      div0 = element("div");
      div0.innerHTML = `<slot></slot>`;
      t0 = space();
      span = element("span");
      slot1 = element("slot");
      svg = svg_element("svg");
      g = svg_element("g");
      path = svg_element("path");
      t1 = space();
      div2 = element("div");
      attr(div0, "class", "modal-guts");
      attr(path, "d", ctx[2]);
      attr(svg, "height", "12px");
      attr(svg, "width", "12px");
      attr(svg, "viewBox", "0 0 47.971 47.971");
      set_style(svg, "enable-background", "new 0 0 47.971 47.971");
      attr(slot1, "name", "close");
      attr(span, "class", "close-button");
      attr(span, "role", "button");
      attr(div1, "class", "modal");
      attr(div1, "id", "modal");
      attr(div2, "class", "modal-overlay");
      attr(div2, "id", "modal-overlay");
    },
    m(target, anchor) {
      insert(target, div1, anchor);
      append(div1, div0);
      append(div1, t0);
      append(div1, span);
      append(span, slot1);
      append(slot1, svg);
      append(svg, g);
      append(g, path);
      insert(target, t1, anchor);
      insert(target, div2, anchor);
      current = true;
      if (!mounted) {
        dispose = [
          listen(span, "click", ctx[1]),
          listen(div2, "click", ctx[1])
        ];
        mounted = true;
      }
    },
    p: noop,
    i(local) {
      if (current)
        return;
      add_render_callback(() => {
        if (!div1_transition)
          div1_transition = create_bidirectional_transition(div1, fade, { duration: 200 }, true);
        div1_transition.run(1);
      });
      current = true;
    },
    o(local) {
      if (!div1_transition)
        div1_transition = create_bidirectional_transition(div1, fade, { duration: 200 }, false);
      div1_transition.run(0);
      current = false;
    },
    d(detaching) {
      if (detaching)
        detach(div1);
      if (detaching && div1_transition)
        div1_transition.end();
      if (detaching)
        detach(t1);
      if (detaching)
        detach(div2);
      mounted = false;
      run_all(dispose);
    }
  };
}
function create_fragment$1(ctx) {
  let if_block_anchor;
  let current;
  let if_block = ctx[0] && create_if_block(ctx);
  return {
    c() {
      if (if_block)
        if_block.c();
      if_block_anchor = empty();
      this.c = noop;
    },
    m(target, anchor) {
      if (if_block)
        if_block.m(target, anchor);
      insert(target, if_block_anchor, anchor);
      current = true;
    },
    p(ctx2, [dirty]) {
      if (ctx2[0]) {
        if (if_block) {
          if_block.p(ctx2, dirty);
          if (dirty & 1) {
            transition_in(if_block, 1);
          }
        } else {
          if_block = create_if_block(ctx2);
          if_block.c();
          transition_in(if_block, 1);
          if_block.m(if_block_anchor.parentNode, if_block_anchor);
        }
      } else if (if_block) {
        group_outros();
        transition_out(if_block, 1, 1, () => {
          if_block = null;
        });
        check_outros();
      }
    },
    i(local) {
      if (current)
        return;
      transition_in(if_block);
      current = true;
    },
    o(local) {
      transition_out(if_block);
      current = false;
    },
    d(detaching) {
      if (if_block)
        if_block.d(detaching);
      if (detaching)
        detach(if_block_anchor);
    }
  };
}
function dispatchCloseEvent(e) {
  const event = new CustomEvent("close", {
    detail: `modal-element was closed.`,
    bubbles: true,
    cancelable: true,
    composed: true
  });
  this.dispatchEvent(event);
}
function instance$1($$self, $$props, $$invalidate) {
  let { id = "" } = $$props;
  let { show = false } = $$props;
  function close(e) {
    dispatchCloseEvent.call(this, e);
    $$invalidate(0, show = false);
  }
  let closePath = `M28.228,23.986L47.092,5.122c1.172-1.171,1.172-3.071,0-4.242c-1.172-1.172-3.07-1.172-4.242,0L23.986,19.744L5.121,0.88
        c-1.172-1.172-3.07-1.172-4.242,0c-1.172,1.171-1.172,3.071,0,4.242l18.865,18.864L0.879,42.85c-1.172,1.171-1.172,3.071,0,4.242
        C1.465,47.677,2.233,47.97,3,47.97s1.535-0.293,2.121-0.879l18.865-18.864L42.85,47.091c0.586,0.586,1.354,0.879,2.121,0.879
        s1.535-0.293,2.121-0.879c1.172-1.171,1.172-3.071,0-4.242L28.228,23.986z`;
  $$self.$$set = ($$props2) => {
    if ("id" in $$props2)
      $$invalidate(3, id = $$props2.id);
    if ("show" in $$props2)
      $$invalidate(0, show = $$props2.show);
  };
  return [show, close, closePath, id];
}
class Modal extends SvelteElement {
  constructor(options) {
    super();
    this.shadowRoot.innerHTML = `<style>.modal{width:var(--size-x-large);height:var(--size-large);display:flex;max-width:100%;max-height:100%;position:fixed;z-index:100;left:50%;top:50%;transform:translate(-50%, -50%);background:var(--color-neutral-10);box-shadow:0 0 60px 10px rgba(0, 0, 0, 0.1)}.modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;z-index:50;background:rgba(64, 63, 63, 0.6)}.modal-guts{position:absolute;top:0;left:0;width:100%;height:100%;overflow:auto;padding:var(--padding-medium)}.modal .close-button{position:absolute;z-index:1;top:15px;right:15px;cursor:pointer}*{box-sizing:border-box;margin:0;padding:0}</style>`;
    init(this, {
      target: this.shadowRoot,
      props: attribute_to_object(this.attributes),
      customElement: true
    }, instance$1, create_fragment$1, safe_not_equal, { id: 3, show: 0 }, null);
    if (options) {
      if (options.target) {
        insert(options.target, this, options.anchor);
      }
      if (options.props) {
        this.$set(options.props);
        flush();
      }
    }
  }
  static get observedAttributes() {
    return ["id", "show"];
  }
  get id() {
    return this.$$.ctx[3];
  }
  set id(id) {
    this.$$set({ id });
    flush();
  }
  get show() {
    return this.$$.ctx[0];
  }
  set show(show) {
    this.$$set({ show });
    flush();
  }
}
customElements.define("twopine-modal", Modal);
function create_fragment(ctx) {
  let div1;
  let svg0;
  let g0;
  let path0;
  let t0;
  let svg1;
  let g1;
  let path1;
  let t1;
  let div0;
  let mounted;
  let dispose;
  return {
    c() {
      div1 = element("div");
      svg0 = svg_element("svg");
      g0 = svg_element("g");
      path0 = svg_element("path");
      t0 = space();
      svg1 = svg_element("svg");
      g1 = svg_element("g");
      path1 = svg_element("path");
      t1 = space();
      div0 = element("div");
      div0.innerHTML = `<slot name="message"></slot>`;
      this.c = noop;
      attr(path0, "d", "M421.428,72.476C374.868,25.84,312.86,0.104,246.724,0.044C110.792,0.044,0.112,110.624,0,246.548\n                c-0.068,65.912,25.544,127.944,72.1,174.584c46.564,46.644,108.492,72.46,174.4,72.46h0.58v-0.048\n                c134.956,0,246.428-110.608,246.556-246.532C493.7,181.12,468,119.124,421.428,72.476z M257.516,377.292\n                c-2.852,2.856-6.844,4.5-10.904,4.5c-4.052,0-8.044-1.66-10.932-4.516c-2.856-2.864-4.496-6.852-4.492-10.916\n                c0.004-4.072,1.876-8.044,4.732-10.884c2.884-2.86,7.218-4.511,11.047-4.542c3.992,0.038,7.811,1.689,10.677,4.562\n                c2.872,2.848,4.46,6.816,4.456,10.884C262.096,370.46,260.404,374.432,257.516,377.292z M262.112,304.692\n                c-0.008,8.508-6.928,15.404-15.448,15.404c-8.5-0.008-15.42-6.916-15.416-15.432L231.528,135\n                c0.004-8.484,3.975-15.387,15.488-15.414c4.093,0.021,7.895,1.613,10.78,4.522c2.912,2.916,4.476,6.788,4.472,10.912\n                L262.112,304.692z");
      attr(svg0, "class", "alert");
      attr(svg0, "version", "1.1");
      attr(svg0, "x", "0px");
      attr(svg0, "y", "0px");
      attr(svg0, "viewBox", "0 0 493.636 493.636");
      set_style(svg0, "enable-background", "new 0 0 493.636 493.636");
      attr(svg0, "xml:space", "preserve");
      attr(path1, "id", "XMLID_29_");
      attr(path1, "d", "M165,0C120.926,0,79.492,17.163,48.328,48.327c-64.334,64.333-64.334,169.011-0.002,233.345\n                C79.49,312.837,120.926,330,165,330c44.072,0,85.508-17.163,116.672-48.328c64.334-64.334,64.334-169.012,0-233.345\n                C250.508,17.163,209.072,0,165,0z M239.246,239.245c-2.93,2.929-6.768,4.394-10.607,4.394c-3.838,0-7.678-1.465-10.605-4.394\n                L165,186.213l-53.033,53.033c-2.93,2.929-6.768,4.394-10.607,4.394c-3.838,0-7.678-1.465-10.605-4.394\n                c-5.859-5.857-5.859-15.355,0-21.213L143.787,165l-53.033-53.033c-5.859-5.857-5.859-15.355,0-21.213\n                c5.857-5.857,15.355-5.857,21.213,0L165,143.787l53.031-53.033c5.857-5.857,15.355-5.857,21.213,0\n                c5.859,5.857,5.859,15.355,0,21.213L186.213,165l53.033,53.032C245.104,223.89,245.104,233.388,239.246,239.245z");
      attr(svg1, "class", "cancel");
      attr(svg1, "version", "1.1");
      attr(svg1, "x", "0px");
      attr(svg1, "y", "0px");
      attr(svg1, "viewBox", "0 0 330 330");
      set_style(svg1, "enable-background", "new 0 0 330 330");
      attr(svg1, "xml:space", "preserve");
      attr(div0, "class", "notify-container");
      attr(div1, "class", "tooltip-container");
      toggle_class(div1, "open", ctx[0]);
    },
    m(target, anchor) {
      insert(target, div1, anchor);
      append(div1, svg0);
      append(svg0, g0);
      append(g0, path0);
      append(div1, t0);
      append(div1, svg1);
      append(svg1, g1);
      append(g1, path1);
      append(div1, t1);
      append(div1, div0);
      if (!mounted) {
        dispose = [
          listen(svg0, "click", ctx[1]),
          listen(svg1, "click", ctx[2])
        ];
        mounted = true;
      }
    },
    p(ctx2, [dirty]) {
      if (dirty & 1) {
        toggle_class(div1, "open", ctx2[0]);
      }
    },
    i: noop,
    o: noop,
    d(detaching) {
      if (detaching)
        detach(div1);
      mounted = false;
      run_all(dispose);
    }
  };
}
function instance($$self, $$props, $$invalidate) {
  let open = false;
  const click_handler = () => $$invalidate(0, open = !open);
  const click_handler_1 = () => $$invalidate(0, open = !open);
  return [open, click_handler, click_handler_1];
}
class Tooltip extends SvelteElement {
  constructor(options) {
    super();
    this.shadowRoot.innerHTML = `<style>.cancel{display:none}.open .cancel{display:block}.open .alert{display:none}svg{width:1em;cursor:pointer;fill:var(--color-primary)}.tooltip-container{display:inline-block;position:relative;z-index:2}.notify-container{position:absolute;bottom:125%;z-index:9;width:var(--size-medium);background:var(--color-primary);color:var(--color-neutral-light);border-radius:var(--border-radius);padding:var(--padding);transform:scale(0);transform-origin:bottom left;transition:transform .5s cubic-bezier(0.860, 0.000, 0.070, 1.000)}.open .notify-container{transform:scale(1)}</style>`;
    init(this, {
      target: this.shadowRoot,
      props: attribute_to_object(this.attributes),
      customElement: true
    }, instance, create_fragment, safe_not_equal, {}, null);
    if (options) {
      if (options.target) {
        insert(options.target, this, options.anchor);
      }
    }
  }
}
customElements.define("twopine-tooltip", Tooltip);
