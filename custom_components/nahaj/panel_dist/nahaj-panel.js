var Y, v, Se, F, de, $e, Pe, ze, ie, ae, re, O = {}, Ne = [], Oe = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i, J = Array.isArray;
function D(e, a) {
  for (var r in a) e[r] = a[r];
  return e;
}
function se(e) {
  e && e.parentNode && e.parentNode.removeChild(e);
}
function Ie(e, a, r) {
  var t, l, i, o = {};
  for (i in a) i == "key" ? t = a[i] : i == "ref" ? l = a[i] : o[i] = a[i];
  if (arguments.length > 2 && (o.children = arguments.length > 3 ? Y.call(arguments, 2) : r), typeof e == "function" && e.defaultProps != null) for (i in e.defaultProps) o[i] === void 0 && (o[i] = e.defaultProps[i]);
  return B(e, o, t, l, null);
}
function B(e, a, r, t, l) {
  var i = { type: e, props: a, key: r, ref: t, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: l ?? ++Se, __i: -1, __u: 0 };
  return l == null && v.vnode != null && v.vnode(i), i;
}
function H(e) {
  return e.children;
}
function Q(e, a) {
  this.props = e, this.context = a;
}
function E(e, a) {
  if (a == null) return e.__ ? E(e.__, e.__i + 1) : null;
  for (var r; a < e.__k.length; a++) if ((r = e.__k[a]) != null && r.__e != null) return r.__e;
  return typeof e.type == "function" ? E(e) : null;
}
function Te(e) {
  var a, r;
  if ((e = e.__) != null && e.__c != null) {
    for (e.__e = e.__c.base = null, a = 0; a < e.__k.length; a++) if ((r = e.__k[a]) != null && r.__e != null) {
      e.__e = e.__c.base = r.__e;
      break;
    }
    return Te(e);
  }
}
function _e(e) {
  (!e.__d && (e.__d = !0) && F.push(e) && !K.__r++ || de != v.debounceRendering) && ((de = v.debounceRendering) || $e)(K);
}
function K() {
  for (var e, a, r, t, l, i, o, d = 1; F.length; ) F.length > d && F.sort(Pe), e = F.shift(), d = F.length, e.__d && (r = void 0, t = void 0, l = (t = (a = e).__v).__e, i = [], o = [], a.__P && ((r = D({}, t)).__v = t.__v + 1, v.vnode && v.vnode(r), le(a.__P, r, t, a.__n, a.__P.namespaceURI, 32 & t.__u ? [l] : null, i, l ?? E(t), !!(32 & t.__u), o), r.__v = t.__v, r.__.__k[r.__i] = r, Ce(i, r, o), t.__e = t.__ = null, r.__e != l && Te(r)));
  K.__r = 0;
}
function De(e, a, r, t, l, i, o, d, h, c, p) {
  var s, m, _, w, k, b, u, f = t && t.__k || Ne, $ = a.length;
  for (h = Ue(r, a, f, h, $), s = 0; s < $; s++) (_ = r.__k[s]) != null && (m = _.__i == -1 ? O : f[_.__i] || O, _.__i = s, b = le(e, _, m, l, i, o, d, h, c, p), w = _.__e, _.ref && m.ref != _.ref && (m.ref && ce(m.ref, null, _), p.push(_.ref, _.__c || w, _)), k == null && w != null && (k = w), (u = !!(4 & _.__u)) || m.__k === _.__k ? h = Re(_, h, e, u) : typeof _.type == "function" && b !== void 0 ? h = b : w && (h = w.nextSibling), _.__u &= -7);
  return r.__e = k, h;
}
function Ue(e, a, r, t, l) {
  var i, o, d, h, c, p = r.length, s = p, m = 0;
  for (e.__k = new Array(l), i = 0; i < l; i++) (o = a[i]) != null && typeof o != "boolean" && typeof o != "function" ? (typeof o == "string" || typeof o == "number" || typeof o == "bigint" || o.constructor == String ? o = e.__k[i] = B(null, o, null, null, null) : J(o) ? o = e.__k[i] = B(H, { children: o }, null, null, null) : o.constructor === void 0 && o.__b > 0 ? o = e.__k[i] = B(o.type, o.props, o.key, o.ref ? o.ref : null, o.__v) : e.__k[i] = o, h = i + m, o.__ = e, o.__b = e.__b + 1, d = null, (c = o.__i = Ge(o, r, h, s)) != -1 && (s--, (d = r[c]) && (d.__u |= 2)), d == null || d.__v == null ? (c == -1 && (l > p ? m-- : l < p && m++), typeof o.type != "function" && (o.__u |= 4)) : c != h && (c == h - 1 ? m-- : c == h + 1 ? m++ : (c > h ? m-- : m++, o.__u |= 4))) : e.__k[i] = null;
  if (s) for (i = 0; i < p; i++) (d = r[i]) != null && (2 & d.__u) == 0 && (d.__e == t && (t = E(d)), Me(d, d));
  return t;
}
function Re(e, a, r, t) {
  var l, i;
  if (typeof e.type == "function") {
    for (l = e.__k, i = 0; l && i < l.length; i++) l[i] && (l[i].__ = e, a = Re(l[i], a, r, t));
    return a;
  }
  e.__e != a && (t && (a && e.type && !a.parentNode && (a = E(e)), r.insertBefore(e.__e, a || null)), a = e.__e);
  do
    a = a && a.nextSibling;
  while (a != null && a.nodeType == 8);
  return a;
}
function Ge(e, a, r, t) {
  var l, i, o, d = e.key, h = e.type, c = a[r], p = c != null && (2 & c.__u) == 0;
  if (c === null && d == null || p && d == c.key && h == c.type) return r;
  if (t > (p ? 1 : 0)) {
    for (l = r - 1, i = r + 1; l >= 0 || i < a.length; ) if ((c = a[o = l >= 0 ? l-- : i++]) != null && (2 & c.__u) == 0 && d == c.key && h == c.type) return o;
  }
  return -1;
}
function he(e, a, r) {
  a[0] == "-" ? e.setProperty(a, r ?? "") : e[a] = r == null ? "" : typeof r != "number" || Oe.test(a) ? r : r + "px";
}
function W(e, a, r, t, l) {
  var i, o;
  e: if (a == "style") if (typeof r == "string") e.style.cssText = r;
  else {
    if (typeof t == "string" && (e.style.cssText = t = ""), t) for (a in t) r && a in r || he(e.style, a, "");
    if (r) for (a in r) t && r[a] == t[a] || he(e.style, a, r[a]);
  }
  else if (a[0] == "o" && a[1] == "n") i = a != (a = a.replace(ze, "$1")), o = a.toLowerCase(), a = o in e || a == "onFocusOut" || a == "onFocusIn" ? o.slice(2) : a.slice(2), e.l || (e.l = {}), e.l[a + i] = r, r ? t ? r.u = t.u : (r.u = ie, e.addEventListener(a, i ? re : ae, i)) : e.removeEventListener(a, i ? re : ae, i);
  else {
    if (l == "http://www.w3.org/2000/svg") a = a.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
    else if (a != "width" && a != "height" && a != "href" && a != "list" && a != "form" && a != "tabIndex" && a != "download" && a != "rowSpan" && a != "colSpan" && a != "role" && a != "popover" && a in e) try {
      e[a] = r ?? "";
      break e;
    } catch {
    }
    typeof r == "function" || (r == null || r === !1 && a[4] != "-" ? e.removeAttribute(a) : e.setAttribute(a, a == "popover" && r == 1 ? "" : r));
  }
}
function pe(e) {
  return function(a) {
    if (this.l) {
      var r = this.l[a.type + e];
      if (a.t == null) a.t = ie++;
      else if (a.t < r.u) return;
      return r(v.event ? v.event(a) : a);
    }
  };
}
function le(e, a, r, t, l, i, o, d, h, c) {
  var p, s, m, _, w, k, b, u, f, $, N, C, T, A, P, R, M, q = a.type;
  if (a.constructor !== void 0) return null;
  128 & r.__u && (h = !!(32 & r.__u), i = [d = a.__e = r.__e]), (p = v.__b) && p(a);
  e: if (typeof q == "function") try {
    if (u = a.props, f = "prototype" in q && q.prototype.render, $ = (p = q.contextType) && t[p.__c], N = p ? $ ? $.props.value : p.__ : t, r.__c ? b = (s = a.__c = r.__c).__ = s.__E : (f ? a.__c = s = new q(u, N) : (a.__c = s = new Q(u, N), s.constructor = q, s.render = Be), $ && $.sub(s), s.state || (s.state = {}), s.__n = t, m = s.__d = !0, s.__h = [], s._sb = []), f && s.__s == null && (s.__s = s.state), f && q.getDerivedStateFromProps != null && (s.__s == s.state && (s.__s = D({}, s.__s)), D(s.__s, q.getDerivedStateFromProps(u, s.__s))), _ = s.props, w = s.state, s.__v = a, m) f && q.getDerivedStateFromProps == null && s.componentWillMount != null && s.componentWillMount(), f && s.componentDidMount != null && s.__h.push(s.componentDidMount);
    else {
      if (f && q.getDerivedStateFromProps == null && u !== _ && s.componentWillReceiveProps != null && s.componentWillReceiveProps(u, N), a.__v == r.__v || !s.__e && s.shouldComponentUpdate != null && s.shouldComponentUpdate(u, s.__s, N) === !1) {
        for (a.__v != r.__v && (s.props = u, s.state = s.__s, s.__d = !1), a.__e = r.__e, a.__k = r.__k, a.__k.some(function(z) {
          z && (z.__ = a);
        }), C = 0; C < s._sb.length; C++) s.__h.push(s._sb[C]);
        s._sb = [], s.__h.length && o.push(s);
        break e;
      }
      s.componentWillUpdate != null && s.componentWillUpdate(u, s.__s, N), f && s.componentDidUpdate != null && s.__h.push(function() {
        s.componentDidUpdate(_, w, k);
      });
    }
    if (s.context = N, s.props = u, s.__P = e, s.__e = !1, T = v.__r, A = 0, f) {
      for (s.state = s.__s, s.__d = !1, T && T(a), p = s.render(s.props, s.state, s.context), P = 0; P < s._sb.length; P++) s.__h.push(s._sb[P]);
      s._sb = [];
    } else do
      s.__d = !1, T && T(a), p = s.render(s.props, s.state, s.context), s.state = s.__s;
    while (s.__d && ++A < 25);
    s.state = s.__s, s.getChildContext != null && (t = D(D({}, t), s.getChildContext())), f && !m && s.getSnapshotBeforeUpdate != null && (k = s.getSnapshotBeforeUpdate(_, w)), R = p, p != null && p.type === H && p.key == null && (R = Ae(p.props.children)), d = De(e, J(R) ? R : [R], a, r, t, l, i, o, d, h, c), s.base = a.__e, a.__u &= -161, s.__h.length && o.push(s), b && (s.__E = s.__ = null);
  } catch (z) {
    if (a.__v = null, h || i != null) if (z.then) {
      for (a.__u |= h ? 160 : 128; d && d.nodeType == 8 && d.nextSibling; ) d = d.nextSibling;
      i[i.indexOf(d)] = null, a.__e = d;
    } else {
      for (M = i.length; M--; ) se(i[M]);
      ne(a);
    }
    else a.__e = r.__e, a.__k = r.__k, z.then || ne(a);
    v.__e(z, a, r);
  }
  else i == null && a.__v == r.__v ? (a.__k = r.__k, a.__e = r.__e) : d = a.__e = We(r.__e, a, r, t, l, i, o, h, c);
  return (p = v.diffed) && p(a), 128 & a.__u ? void 0 : d;
}
function ne(e) {
  e && e.__c && (e.__c.__e = !0), e && e.__k && e.__k.forEach(ne);
}
function Ce(e, a, r) {
  for (var t = 0; t < r.length; t++) ce(r[t], r[++t], r[++t]);
  v.__c && v.__c(a, e), e.some(function(l) {
    try {
      e = l.__h, l.__h = [], e.some(function(i) {
        i.call(l);
      });
    } catch (i) {
      v.__e(i, l.__v);
    }
  });
}
function Ae(e) {
  return typeof e != "object" || e == null || e.__b && e.__b > 0 ? e : J(e) ? e.map(Ae) : D({}, e);
}
function We(e, a, r, t, l, i, o, d, h) {
  var c, p, s, m, _, w, k, b = r.props || O, u = a.props, f = a.type;
  if (f == "svg" ? l = "http://www.w3.org/2000/svg" : f == "math" ? l = "http://www.w3.org/1998/Math/MathML" : l || (l = "http://www.w3.org/1999/xhtml"), i != null) {
    for (c = 0; c < i.length; c++) if ((_ = i[c]) && "setAttribute" in _ == !!f && (f ? _.localName == f : _.nodeType == 3)) {
      e = _, i[c] = null;
      break;
    }
  }
  if (e == null) {
    if (f == null) return document.createTextNode(u);
    e = document.createElementNS(l, f, u.is && u), d && (v.__m && v.__m(a, i), d = !1), i = null;
  }
  if (f == null) b === u || d && e.data == u || (e.data = u);
  else {
    if (i = i && Y.call(e.childNodes), !d && i != null) for (b = {}, c = 0; c < e.attributes.length; c++) b[(_ = e.attributes[c]).name] = _.value;
    for (c in b) if (_ = b[c], c != "children") {
      if (c == "dangerouslySetInnerHTML") s = _;
      else if (!(c in u)) {
        if (c == "value" && "defaultValue" in u || c == "checked" && "defaultChecked" in u) continue;
        W(e, c, null, _, l);
      }
    }
    for (c in u) _ = u[c], c == "children" ? m = _ : c == "dangerouslySetInnerHTML" ? p = _ : c == "value" ? w = _ : c == "checked" ? k = _ : d && typeof _ != "function" || b[c] === _ || W(e, c, _, b[c], l);
    if (p) d || s && (p.__html == s.__html || p.__html == e.innerHTML) || (e.innerHTML = p.__html), a.__k = [];
    else if (s && (e.innerHTML = ""), De(a.type == "template" ? e.content : e, J(m) ? m : [m], a, r, t, f == "foreignObject" ? "http://www.w3.org/1999/xhtml" : l, i, o, i ? i[0] : r.__k && E(r, 0), d, h), i != null) for (c = i.length; c--; ) se(i[c]);
    d || (c = "value", f == "progress" && w == null ? e.removeAttribute("value") : w != null && (w !== e[c] || f == "progress" && !w || f == "option" && w != b[c]) && W(e, c, w, b[c], l), c = "checked", k != null && k != e[c] && W(e, c, k, b[c], l));
  }
  return e;
}
function ce(e, a, r) {
  try {
    if (typeof e == "function") {
      var t = typeof e.__u == "function";
      t && e.__u(), t && a == null || (e.__u = e(a));
    } else e.current = a;
  } catch (l) {
    v.__e(l, r);
  }
}
function Me(e, a, r) {
  var t, l;
  if (v.unmount && v.unmount(e), (t = e.ref) && (t.current && t.current != e.__e || ce(t, null, a)), (t = e.__c) != null) {
    if (t.componentWillUnmount) try {
      t.componentWillUnmount();
    } catch (i) {
      v.__e(i, a);
    }
    t.base = t.__P = null;
  }
  if (t = e.__k) for (l = 0; l < t.length; l++) t[l] && Me(t[l], a, r || typeof e.type != "function");
  r || se(e.__e), e.__c = e.__ = e.__e = void 0;
}
function Be(e, a, r) {
  return this.constructor(e, r);
}
function Qe(e, a, r) {
  var t, l, i, o;
  a == document && (a = document.documentElement), v.__ && v.__(e, a), l = (t = !1) ? null : a.__k, i = [], o = [], le(a, e = a.__k = Ie(H, null, [e]), l || O, O, a.namespaceURI, l ? null : a.firstChild ? Y.call(a.childNodes) : null, i, l ? l.__e : a.firstChild, t, o), Ce(i, e, o);
}
Y = Ne.slice, v = { __e: function(e, a, r, t) {
  for (var l, i, o; a = a.__; ) if ((l = a.__c) && !l.__) try {
    if ((i = l.constructor) && i.getDerivedStateFromError != null && (l.setState(i.getDerivedStateFromError(e)), o = l.__d), l.componentDidCatch != null && (l.componentDidCatch(e, t || {}), o = l.__d), o) return l.__E = l;
  } catch (d) {
    e = d;
  }
  throw e;
} }, Se = 0, Q.prototype.setState = function(e, a) {
  var r;
  r = this.__s != null && this.__s != this.state ? this.__s : this.__s = D({}, this.state), typeof e == "function" && (e = e(D({}, r), this.props)), e && D(r, e), e != null && this.__v && (a && this._sb.push(a), _e(this));
}, Q.prototype.forceUpdate = function(e) {
  this.__v && (this.__e = !0, e && this.__h.push(e), _e(this));
}, Q.prototype.render = H, F = [], $e = typeof Promise == "function" ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, Pe = function(e, a) {
  return e.__v.__b - a.__v.__b;
}, K.__r = 0, ze = /(PointerCapture)$|Capture$/i, ie = 0, ae = pe(!1), re = pe(!0);
var Ve = 0;
function n(e, a, r, t, l, i) {
  a || (a = {});
  var o, d, h = a;
  if ("ref" in h) for (d in h = {}, a) d == "ref" ? o = a[d] : h[d] = a[d];
  var c = { type: e, props: h, key: r, ref: o, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: --Ve, __i: -1, __u: 0, __source: l, __self: i };
  if (typeof e == "function" && (o = e.defaultProps)) for (d in o) h[d] === void 0 && (h[d] = o[d]);
  return v.vnode && v.vnode(c), c;
}
var te, S, ee, ue, me = 0, Fe = [], x = v, fe = x.__b, ge = x.__r, ve = x.diffed, be = x.__c, ye = x.unmount, we = x.__;
function Ke(e, a) {
  x.__h && x.__h(S, e, me || a), me = 0;
  var r = S.__H || (S.__H = { __: [], __h: [] });
  return e >= r.__.length && r.__.push({}), r.__[e];
}
function Ye(e, a) {
  var r = Ke(te++, 7);
  return Ze(r.__H, a) && (r.__ = e(), r.__H = a, r.__h = e), r.__;
}
function Je() {
  for (var e; e = Fe.shift(); ) if (e.__P && e.__H) try {
    e.__H.__h.forEach(V), e.__H.__h.forEach(oe), e.__H.__h = [];
  } catch (a) {
    e.__H.__h = [], x.__e(a, e.__v);
  }
}
x.__b = function(e) {
  S = null, fe && fe(e);
}, x.__ = function(e, a) {
  e && a.__k && a.__k.__m && (e.__m = a.__k.__m), we && we(e, a);
}, x.__r = function(e) {
  ge && ge(e), te = 0;
  var a = (S = e.__c).__H;
  a && (ee === S ? (a.__h = [], S.__h = [], a.__.forEach(function(r) {
    r.__N && (r.__ = r.__N), r.u = r.__N = void 0;
  })) : (a.__h.forEach(V), a.__h.forEach(oe), a.__h = [], te = 0)), ee = S;
}, x.diffed = function(e) {
  ve && ve(e);
  var a = e.__c;
  a && a.__H && (a.__H.__h.length && (Fe.push(a) !== 1 && ue === x.requestAnimationFrame || ((ue = x.requestAnimationFrame) || Xe)(Je)), a.__H.__.forEach(function(r) {
    r.u && (r.__H = r.u), r.u = void 0;
  })), ee = S = null;
}, x.__c = function(e, a) {
  a.some(function(r) {
    try {
      r.__h.forEach(V), r.__h = r.__h.filter(function(t) {
        return !t.__ || oe(t);
      });
    } catch (t) {
      a.some(function(l) {
        l.__h && (l.__h = []);
      }), a = [], x.__e(t, r.__v);
    }
  }), be && be(e, a);
}, x.unmount = function(e) {
  ye && ye(e);
  var a, r = e.__c;
  r && r.__H && (r.__H.__.forEach(function(t) {
    try {
      V(t);
    } catch (l) {
      a = l;
    }
  }), r.__H = void 0, a && x.__e(a, r.__v));
};
var xe = typeof requestAnimationFrame == "function";
function Xe(e) {
  var a, r = function() {
    clearTimeout(t), xe && cancelAnimationFrame(a), setTimeout(e);
  }, t = setTimeout(r, 35);
  xe && (a = requestAnimationFrame(r));
}
function V(e) {
  var a = S, r = e.__c;
  typeof r == "function" && (e.__c = void 0, r()), S = a;
}
function oe(e) {
  var a = S;
  e.__c = e.__(), S = a;
}
function Ze(e, a) {
  return !e || e.length !== a.length || a.some(function(r, t) {
    return r !== e[t];
  });
}
const j = {
  brandTeal: "#1b4d5a",
  brandTealDeep: "#103840",
  brandGold: "#c69426",
  // leaf-500
  brandGoldSoft: "#e2b46a",
  // leaf-300
  brandGoldDeep: "#8a6614",
  // leaf-700
  paper100: "#fbf9f4",
  paper200: "#f3eee2",
  paper300: "#e8dfc8",
  surfaceDark: "#0d1417",
  surfaceDarkRaised: "#1a262b",
  inkDark: "#04181d",
  inkLight: "#f0eee7"
}, ea = `
  :host { display: block; height: 100%; container-type: inline-size; }
  /* Brand-fallback variables — HA's variables take precedence at runtime. */
  :host {
    --q-bg: var(--primary-background-color, ${j.paper100});
    --q-bg-soft: var(--secondary-background-color, ${j.paper200});
    --q-bg-deep: ${j.paper300};
    --q-card: var(--card-background-color, var(--ha-card-background, #ffffff));
    --q-text: var(--primary-text-color, ${j.brandTealDeep});
    --q-text-strong: ${j.inkDark};
    --q-text-muted: var(--secondary-text-color, rgba(16, 56, 64, 0.65));
    --q-accent: var(--accent-color, ${j.brandGold});
    --q-accent-soft: ${j.brandGoldSoft};
    --q-accent-deep: ${j.brandGoldDeep};
    --q-radius: var(--ha-card-border-radius, 16px);
    --q-shadow: 0 1px 3px rgba(16, 56, 64, 0.05), 0 14px 32px -16px rgba(16, 56, 64, 0.08);
    --q-shadow-card: var(--ha-card-box-shadow, var(--q-shadow));
    --q-divider: var(--divider-color, rgba(16, 56, 64, 0.1));
    --q-rule-strong: rgba(16, 56, 64, 0.18);
    /* Subtle gold gradient used by hero illumination + accent stat */
    --q-gold-grad: linear-gradient(
      135deg,
      color-mix(in srgb, var(--q-accent-soft) 22%, transparent) 0%,
      color-mix(in srgb, var(--q-accent) 8%, transparent) 35%,
      transparent 70%
    );
  }
  @media (prefers-color-scheme: dark) {
    :host {
      --q-bg: var(--primary-background-color, ${j.surfaceDark});
      --q-bg-soft: var(--secondary-background-color, ${j.surfaceDarkRaised});
      --q-bg-deep: #1a262b;
      --q-card: var(--card-background-color, ${j.surfaceDarkRaised});
      --q-text: var(--primary-text-color, ${j.inkLight});
      --q-text-strong: #ffffff;
      --q-text-muted: var(--secondary-text-color, rgba(240, 238, 231, 0.62));
      --q-accent: var(--accent-color, #e8c478);
      --q-accent-soft: #d6a657;
      --q-accent-deep: #b6862c;
      --q-divider: var(--divider-color, rgba(255, 255, 255, 0.08));
      --q-rule-strong: rgba(255, 255, 255, 0.16);
    }
  }

  /* Custom property animation registration — needed for the soft pulse
   * on the prayer card to interpolate cleanly. */
  @property --q-pulse {
    syntax: '<number>';
    initial-value: 0;
    inherits: false;
  }

  main {
    font-family: var(--paper-font-body1_-_font-family, 'IBM Plex Sans', -apple-system, system-ui, sans-serif);
    padding: clamp(1.1rem, 4vw, 2.4rem) clamp(1rem, 4vw, 2.4rem);
    background: var(--q-bg);
    color: var(--q-text);
    min-height: 100vh;
    box-sizing: border-box;
    /* Subtle paper grain — barely visible, just enough to avoid the
     * "flat tech app" feel. SVG noise embedded as data URI so we don't
     * need a network request. 2% opacity on light paper, 4% on dark. */
    background-image: var(--q-bg-noise, none),
      radial-gradient(at 12% 0%, color-mix(in srgb, var(--q-accent-soft) 6%, transparent) 0%, transparent 60%);
  }
  @media (prefers-color-scheme: light) {
    main {
      --q-bg-noise: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.025'/></svg>");
    }
  }

  header {
    margin-bottom: clamp(1.25rem, 4vw, 2rem);
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding-bottom: 1.1rem;
    border-bottom: 1px solid var(--q-divider);
    /* Tiny gold tick at left edge — illuminated-manuscript flourish */
    position: relative;
  }
  header::before {
    content: '';
    position: absolute;
    left: -0.4rem;
    top: 0.4rem;
    bottom: 1.2rem;
    width: 3px;
    border-radius: 2px;
    background: linear-gradient(180deg, var(--q-accent) 0%, transparent 100%);
    opacity: 0.55;
  }
  h1 {
    font-family: 'Fraunces', 'Times New Roman', Georgia, serif;
    font-size: clamp(1.5rem, 3vw, 1.95rem);
    font-weight: 600;
    margin: 0 0 0.25rem;
    letter-spacing: -0.014em;
    line-height: 1.1;
    color: var(--q-text-strong);
  }
  header .lede {
    font-size: 0.92rem;
    line-height: 1.55;
    opacity: 0.92;
    color: var(--q-text-muted);
    margin: 0;
    max-width: 60ch;
  }
  .ramadan-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.7rem;
    padding: 0.32rem 0.85rem;
    border-radius: 999px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    background: var(--q-gold-grad), var(--q-card);
    color: var(--q-accent-deep);
    border: 1px solid color-mix(in srgb, var(--q-accent) 40%, transparent);
    box-shadow: 0 1px 2px color-mix(in srgb, var(--q-accent) 20%, transparent);
    align-self: center;
    animation: q-fade-in 600ms ease-out 200ms backwards;
  }
  .ramadan-pill::before {
    content: '';
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: var(--q-accent);
    box-shadow: inset -0.2rem -0.05rem 0 var(--q-accent-deep);
    /* CSS-only crescent: a circle with an inset shadow that occludes one side */
  }

  /* Hero — Word + Topic of the day. The most editorial element. */
  .hero {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
    margin-bottom: 1.4rem;
    animation: q-fade-up 540ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
  }
  @container (min-width: 720px) { .hero { grid-template-columns: 1.4fr 1fr; } }
  @media (min-width: 720px) { .hero { grid-template-columns: 1.4fr 1fr; } }
  .hero-card {
    position: relative;
    background: var(--q-card);
    border-radius: var(--q-radius);
    padding: clamp(1.4rem, 3vw, 1.8rem) clamp(1.4rem, 3vw, 1.8rem);
    box-shadow: var(--q-shadow-card);
    border: 1px solid var(--q-divider);
    overflow: hidden;
    isolation: isolate;
  }
  /* Gold illumination on the word-of-day hero — mimics gilded margin
   * decoration on a fine printed mushaf. Pure CSS (no images). */
  .hero-card.illuminated::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--q-gold-grad);
    pointer-events: none;
    z-index: 0;
  }
  /* Decorative corner crest — abstract geometric Islamic-pattern motif.
   * Three rotated squares form an 8-point star, painted in gold.
   * Pure CSS, no SVG dependency. */
  .hero-card.illuminated::after {
    content: '';
    position: absolute;
    top: 1.1rem;
    right: 1.1rem;
    width: 1.6rem;
    height: 1.6rem;
    background:
      conic-gradient(
        from 22.5deg,
        var(--q-accent) 0deg 45deg,
        transparent 45deg 90deg,
        var(--q-accent) 90deg 135deg,
        transparent 135deg 180deg,
        var(--q-accent) 180deg 225deg,
        transparent 225deg 270deg,
        var(--q-accent) 270deg 315deg,
        transparent 315deg 360deg
      );
    mask: radial-gradient(circle at center, black 50%, transparent 51%);
    -webkit-mask: radial-gradient(circle at center, black 50%, transparent 51%);
    opacity: 0.65;
    z-index: 0;
  }
  .hero-card > * { position: relative; z-index: 1; }

  .smallcaps {
    font-size: 0.68rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--q-accent-deep);
    font-weight: 700;
    font-family: 'Fraunces', Georgia, serif;
  }
  .smallcaps.muted { color: var(--q-text-muted); font-weight: 600; }
  .arabic {
    font-family: 'Amiri Quran', 'KFGQPC HAFS Uthmanic Script V2', 'Noto Naskh Arabic', serif;
    direction: rtl;
    unicode-bidi: plaintext;
    color: var(--q-accent-deep);
    font-weight: 600;
    line-height: 1.6;
    margin: 0.7rem 0 0.4rem;
  }
  .arabic.huge { font-size: clamp(2.2rem, 5vw, 2.85rem); letter-spacing: 0; }
  .gloss {
    font-family: 'Fraunces', Georgia, serif;
    font-size: clamp(1.15rem, 2.4vw, 1.45rem);
    font-weight: 600;
    margin: 0.4rem 0 0.3rem;
    line-height: 1.25;
    color: var(--q-text-strong);
  }
  .meta {
    font-size: 0.85rem;
    line-height: 1.55;
    color: var(--q-text-muted);
    margin: 0.5rem 0 0;
  }
  .meta code {
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    background: var(--q-bg-soft);
    padding: 0.1rem 0.4rem;
    border-radius: 0.3rem;
    font-size: 0.85em;
    color: var(--q-accent-deep);
  }

  .topic-card h2 {
    font-family: 'Fraunces', Georgia, serif;
    font-size: clamp(1.15rem, 2.4vw, 1.4rem);
    font-weight: 600;
    margin: 0.55rem 0 0.4rem;
    line-height: 1.25;
    color: var(--q-text-strong);
  }
  .topic-card .summary {
    font-size: 0.92rem;
    line-height: 1.55;
    color: var(--q-text-muted);
    margin: 0.4rem 0 1rem;
  }

  /* Stat grid — every sensor a chip. */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 0.85rem;
    margin-bottom: 1.4rem;
    animation: q-fade-up 540ms 80ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
  }
  .stat {
    background: var(--q-card);
    border-radius: 14px;
    padding: 1rem 1.1rem;
    border: 1px solid var(--q-divider);
    transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms ease;
    position: relative;
  }
  .stat:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--q-accent) 35%, var(--q-divider)); }
  .stat .label {
    color: var(--q-text-muted);
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-weight: 700;
  }
  .stat .value {
    display: block;
    margin-top: 0.4rem;
    font-family: 'Fraunces', Georgia, serif;
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.1;
    color: var(--q-text-strong);
    font-variant-numeric: tabular-nums;
  }
  .stat .sub {
    display: block;
    margin-top: 0.25rem;
    color: var(--q-text-muted);
    font-size: 0.78rem;
    line-height: 1.45;
  }
  .stat.accent {
    background:
      var(--q-gold-grad),
      var(--q-card);
    border-color: color-mix(in srgb, var(--q-accent) 28%, var(--q-divider));
  }
  .stat.accent .value { color: var(--q-accent-deep); }
  .stat.imminent {
    /* Used when the next-prayer is < 10 min away. Soft heartbeat. */
    animation: q-prayer-pulse 2.4s ease-in-out infinite;
  }

  .row-section { margin-bottom: 1.4rem; animation: q-fade-up 540ms 160ms cubic-bezier(0.16, 1, 0.3, 1) backwards; }
  .row-section h2 {
    font-size: 0.7rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--q-text-muted);
    font-weight: 700;
    margin: 0 0 0.7rem;
    font-family: 'Fraunces', Georgia, serif;
  }
  .row-card {
    background: var(--q-card);
    border-radius: var(--q-radius);
    border: 1px solid var(--q-divider);
    box-shadow: var(--q-shadow-card);
    overflow: hidden;
  }
  .row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.95rem 1.3rem;
    border-bottom: 1px solid var(--q-divider);
  }
  .row:last-child { border-bottom: none; }
  .row .label { color: var(--q-text-muted); font-size: 0.875rem; }
  .row .value { font-weight: 600; font-size: 0.95rem; text-align: right; font-variant-numeric: tabular-nums; }
  .row .hint { color: var(--q-text-muted); font-size: 0.78rem; display: block; margin-top: 0.2rem; max-width: 36ch; }
  .row .value.idle { color: var(--q-text-muted); font-weight: 500; }
  .row.entity .label {
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    font-size: 0.78rem;
    color: var(--q-text);
  }
  .live-dot {
    display: inline-block;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    margin-right: 0.4em;
    background: var(--q-accent);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--q-accent) 40%, transparent);
    animation: q-live-dot 1.4s ease-in-out infinite;
    vertical-align: 0.075em;
  }

  .actions { display: flex; flex-wrap: wrap; gap: 0.65rem; margin-top: 1.1rem; }
  button.nahaj {
    background: var(--primary-color, ${j.brandTeal});
    color: var(--text-primary-color, #fff);
    border: none;
    padding: 0.65rem 1.05rem;
    border-radius: 0.7rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: filter 120ms ease, transform 120ms ease, box-shadow 120ms ease;
    font-family: inherit;
    box-shadow: 0 1px 2px rgba(16, 56, 64, 0.12);
  }
  button.nahaj:hover {
    filter: brightness(1.08);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px -2px rgba(16, 56, 64, 0.2);
  }
  button.nahaj:active { transform: translateY(0); filter: brightness(0.96); }
  button.nahaj:focus-visible {
    outline: 2px solid var(--q-accent);
    outline-offset: 3px;
  }
  button.nahaj.secondary {
    background: transparent;
    color: var(--q-text);
    border: 1px solid var(--q-divider);
    box-shadow: none;
  }
  button.nahaj.secondary:hover { border-color: var(--q-accent); color: var(--q-accent-deep); transform: translateY(-1px); }
  button.nahaj.gold { background: var(--q-accent); color: var(--q-bg); }
  button.nahaj.gold:hover { background: var(--q-accent-soft); }
  .empty { color: var(--q-text-muted); font-size: 0.9rem; padding: 0.4rem 0 0.2rem; line-height: 1.55; max-width: 56ch; }

  footer.nahaj-footer {
    margin-top: 2.2rem;
    padding-top: 1.3rem;
    border-top: 1px dashed var(--q-divider);
    font-size: 0.78rem;
    color: var(--q-text-muted);
    line-height: 1.6;
    max-width: 64ch;
  }
  footer.nahaj-footer .smallcaps-foot {
    color: var(--q-accent-deep);
    margin-right: 0.55rem;
    font-size: 0.68rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    font-weight: 700;
    font-family: 'Fraunces', Georgia, serif;
  }

  /* Ramadan strip — soft gold gradient marker for the day-shape phase. */
  .ramadan-strip {
    background: var(--q-gold-grad), var(--q-card);
    border: 1px solid color-mix(in srgb, var(--q-accent) 24%, var(--q-divider));
    border-radius: var(--q-radius);
    padding: 1rem 1.2rem;
    margin-bottom: 1.4rem;
    animation: q-fade-up 540ms 100ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
  }
  .ramadan-pill-row { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; }
  .phase-pill {
    display: inline-flex;
    align-items: center;
    padding: 0.35rem 0.85rem;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    background: color-mix(in srgb, var(--q-accent) 15%, var(--q-card));
    color: var(--q-accent-deep);
    border: 1px solid color-mix(in srgb, var(--q-accent) 35%, transparent);
  }
  .phase-pill.phase-suhoor { background: color-mix(in srgb, #f4c97a 18%, var(--q-card)); }
  .phase-pill.phase-iftar { background: color-mix(in srgb, #ff9a55 18%, var(--q-card)); }
  .phase-pill.phase-taraweeh { background: color-mix(in srgb, #6f8ec0 18%, var(--q-card)); }
  .phase-pill.phase-odd_night {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--q-accent) 28%, var(--q-card)) 0%,
      color-mix(in srgb, var(--q-accent-soft) 18%, var(--q-card)) 100%
    );
    color: var(--q-accent-deep);
    border-color: color-mix(in srgb, var(--q-accent) 60%, transparent);
  }
  .last-ten-pill {
    display: inline-flex;
    padding: 0.32rem 0.8rem;
    border-radius: 999px;
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--q-accent-deep);
    background: transparent;
    border: 1px dashed color-mix(in srgb, var(--q-accent) 50%, transparent);
  }
  .ramadan-hint { margin: 0.55rem 0 0; font-size: 0.83rem; color: var(--q-text-muted); line-height: 1.5; }
  .ramadan-hint code {
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    background: var(--q-bg-soft);
    padding: 0.05rem 0.35rem;
    border-radius: 0.25rem;
    font-size: 0.85em;
    color: var(--q-accent-deep);
  }

  /* Prayer-window heartbeat strip — single calm line, soft pulse. */
  .prayer-strip {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    background: color-mix(in srgb, var(--q-accent) 8%, var(--q-card));
    border: 1px solid color-mix(in srgb, var(--q-accent) 18%, var(--q-divider));
    border-radius: var(--q-radius);
    padding: 0.8rem 1.2rem;
    margin-bottom: 1.4rem;
    font-size: 0.9rem;
    color: var(--q-text);
    animation: q-fade-in 540ms ease-out backwards;
  }
  .prayer-dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: var(--q-accent);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--q-accent) 50%, transparent);
    animation: q-prayer-pulse 2.4s ease-in-out infinite;
    flex-shrink: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .prayer-dot { animation: none; }
    .ramadan-strip { animation: none; }
  }

  @keyframes q-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes q-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes q-prayer-pulse {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--q-accent) 0%, transparent); }
    50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--q-accent) 18%, transparent); }
  }
  @keyframes q-live-dot {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--q-accent) 40%, transparent); }
    70% { box-shadow: 0 0 0 6px transparent; }
  }
  @media (prefers-reduced-motion: reduce) {
    .hero, .stat-grid, .row-section, .ramadan-pill { animation: none; }
    .stat:hover { transform: none; }
    button.nahaj { transition: none; }
    button.nahaj:hover { transform: none; }
    .stat.imminent { animation: none; }
    .live-dot { animation: none; }
  }
`;
function g(e, a) {
  return e?.states?.[a];
}
function y(e, a = "—") {
  return !e || e.state === "unavailable" || e.state === "unknown" || !e.state ? a : e.state;
}
function L(e, a) {
  const r = e?.attributes?.[a];
  return typeof r == "string" ? r : void 0;
}
function aa(e, a) {
  const r = e?.attributes?.[a];
  return typeof r == "number" ? r : void 0;
}
function ra(e) {
  if (!e || e === "—" || e === "unknown" || e === "unavailable") return !1;
  try {
    const a = new Date(e).getTime() - Date.now();
    return a > 0 && a <= 600 * 1e3;
  } catch {
    return !1;
  }
}
function na({ hass: e, narrow: a, webUrl: r }) {
  const t = r?.trim(), l = t && t.length > 0 ? t : "https://nahaj.app", i = (G) => {
    const Ee = G.startsWith("/") ? "" : "/", Le = `${l.replace(/\/+$/, "")}${Ee}${G}`;
    typeof window < "u" && window.open(Le, "_blank", "noopener,noreferrer");
  }, o = Ye(() => ({
    currentVerse: g(e, "sensor.nahaj_current_verse"),
    streak: g(e, "sensor.nahaj_streak_days"),
    todaysSession: g(e, "sensor.nahaj_today_session_count"),
    grace: g(e, "sensor.nahaj_grace_days_remaining"),
    currentSabqi: g(e, "sensor.nahaj_current_sabqi"),
    nextPrayer: g(e, "sensor.nahaj_next_prayer"),
    nextPrayerName: g(e, "sensor.nahaj_next_prayer_name"),
    wordOfDay: g(e, "sensor.nahaj_word_of_day"),
    topicOfDay: g(e, "sensor.nahaj_topic_of_day"),
    hijri: g(e, "sensor.nahaj_hijri_date"),
    mutashabihat: g(e, "sensor.nahaj_mutashabihat_count"),
    activeReciter: g(e, "sensor.nahaj_active_reciter"),
    isReciting: g(e, "binary_sensor.nahaj_is_reciting"),
    inSession: g(e, "binary_sensor.nahaj_in_session"),
    ramadan: g(e, "binary_sensor.nahaj_ramadan"),
    lastTenNights: g(e, "binary_sensor.nahaj_last_ten_nights"),
    fridayKahf: g(e, "binary_sensor.nahaj_friday_kahf_window"),
    inPrayerWindow: g(e, "binary_sensor.nahaj_in_prayer_window"),
    ramadanPhase: g(e, "sensor.nahaj_ramadan_phase"),
    familyKhatm: g(e, "sensor.nahaj_family_khatm_juz_completed"),
    // v0.4 deep-Hifdh sensors
    lastRatedAt: g(e, "sensor.nahaj_last_rated_at"),
    nextReviewDue: g(e, "sensor.nahaj_next_review_due"),
    weakestPage: g(e, "sensor.nahaj_weakest_page"),
    // v0.4.2 — interactive daily-quota number
    dailyQuota: g(e, "number.nahaj_daily_pages_quota"),
    mediaPlayer: g(e, "media_player.nahaj"),
    reciterSelect: g(e, "select.nahaj_reciter"),
    mushafSelect: g(e, "select.nahaj_mushaf")
  }), [e]), d = e?.user?.name ? `As-salāmu ʿalaykum, ${e.user.name}` : "As-salāmu ʿalaykum", h = o.ramadan?.state === "on", c = o.lastTenNights?.state === "on", p = o.fridayKahf?.state === "on", s = o.inPrayerWindow?.state === "on", m = y(o.ramadanPhase, "none"), _ = Number(y(o.familyKhatm, "0")), w = L(o.wordOfDay, "arabic") ?? o.wordOfDay?.state ?? "—", k = L(o.wordOfDay, "translation") ?? "", b = L(o.wordOfDay, "root"), u = aa(o.wordOfDay, "occurrences"), f = L(o.topicOfDay, "summary"), $ = L(o.topicOfDay, "slug"), N = o.topicOfDay?.state && o.topicOfDay.state !== "unknown" ? o.topicOfDay.state.replace(/[-_]/g, " ").replace(/\b\w/g, (G) => G.toUpperCase()) : null, C = Number(y(o.mutashabihat, "0")), T = o.inSession?.state === "on", A = o.isReciting?.state === "on", P = y(o.nextPrayer, "—"), R = ra(P), M = y(o.nextPrayerName, ""), q = M && M !== "unknown" ? M : "", z = y(o.lastRatedAt, ""), X = y(o.nextReviewDue, ""), I = y(o.weakestPage, ""), U = y(o.dailyQuota, ""), Z = Number(U), He = U !== "" && U !== "unknown" && U !== "unavailable";
  return /* @__PURE__ */ n("main", { children: [
    /* @__PURE__ */ n("style", { children: ea }),
    /* @__PURE__ */ n("header", { children: [
      /* @__PURE__ */ n("div", { children: [
        /* @__PURE__ */ n("h1", { children: d }),
        /* @__PURE__ */ n("p", { class: "lede", children: [
          "Today's Quranic moment, your hifdh state, and quick actions for every speaker in the house. Family-private — never shared.",
          a ? " · compact view" : ""
        ] })
      ] }),
      h ? /* @__PURE__ */ n("span", { class: "ramadan-pill", children: "Ramadan" }) : null
    ] }),
    /* @__PURE__ */ n("section", { class: "hero", children: [
      /* @__PURE__ */ n("article", { class: "hero-card illuminated", "aria-label": "Word of the day", children: [
        /* @__PURE__ */ n("span", { class: "smallcaps", children: "Word of the day" }),
        /* @__PURE__ */ n("p", { class: "arabic huge", lang: "ar", children: w }),
        k ? /* @__PURE__ */ n("h2", { class: "gloss", children: k }) : null,
        /* @__PURE__ */ n("p", { class: "meta", children: [
          b ? /* @__PURE__ */ n(H, { children: [
            "Root ",
            /* @__PURE__ */ n("code", { children: b })
          ] }) : null,
          b && u ? " · " : null,
          u ? /* @__PURE__ */ n(H, { children: [
            u,
            " occurrence",
            u === 1 ? "" : "s",
            " across the Quran"
          ] }) : null
        ] })
      ] }),
      /* @__PURE__ */ n("article", { class: "hero-card topic-card", "aria-label": "Topic of the day", children: [
        /* @__PURE__ */ n("span", { class: "smallcaps muted", children: "Topic of the day" }),
        /* @__PURE__ */ n("h2", { children: N ?? "—" }),
        f ? /* @__PURE__ */ n("p", { class: "summary", children: f }) : null,
        $ ? /* @__PURE__ */ n("div", { class: "actions", children: /* @__PURE__ */ n(
          "button",
          {
            type: "button",
            class: "nahaj secondary",
            onClick: () => {
              i(`/topics/${$}`);
            },
            children: "Read every verse on this topic →"
          }
        ) }) : null
      ] })
    ] }),
    /* @__PURE__ */ n("section", { class: "stat-grid", "aria-label": "Today's snapshot", children: [
      /* @__PURE__ */ n("div", { class: "stat accent", children: [
        /* @__PURE__ */ n("span", { class: "label", children: "Streak" }),
        /* @__PURE__ */ n("strong", { class: "value", children: y(o.streak, "0") }),
        /* @__PURE__ */ n("span", { class: "sub", children: [
          y(o.grace, "0"),
          " grace days remaining"
        ] })
      ] }),
      /* @__PURE__ */ n("div", { class: "stat", children: [
        /* @__PURE__ */ n("span", { class: "label", children: "Sessions today" }),
        /* @__PURE__ */ n("strong", { class: "value", children: y(o.todaysSession, "0") }),
        /* @__PURE__ */ n("span", { class: "sub", children: "portions completed" })
      ] }),
      /* @__PURE__ */ n("div", { class: "stat", children: [
        /* @__PURE__ */ n("span", { class: "label", children: "Current sabqi" }),
        /* @__PURE__ */ n("strong", { class: "value", style: { fontSize: "1.05rem" }, children: y(o.currentSabqi, "—") }),
        /* @__PURE__ */ n("span", { class: "sub", children: "today's new memorization" })
      ] }),
      /* @__PURE__ */ n("div", { class: "stat" + (R ? " imminent" : ""), children: [
        /* @__PURE__ */ n("span", { class: "label", children: "Next prayer" }),
        /* @__PURE__ */ n("strong", { class: "value", children: q ? q.charAt(0).toUpperCase() + q.slice(1) : "—" }),
        /* @__PURE__ */ n("span", { class: "sub", children: P === "—" || P === "unknown" ? "configure home location in HA" : R ? `${ke(P)} · within 10 min` : `${ke(P)} · hifdh pauses inside the window` })
      ] }),
      /* @__PURE__ */ n("div", { class: "stat", children: [
        /* @__PURE__ */ n("span", { class: "label", children: "Hijri date" }),
        /* @__PURE__ */ n("strong", { class: "value", style: { fontSize: "1.05rem" }, children: y(o.hijri, "—") }),
        /* @__PURE__ */ n("span", { class: "sub", children: h ? "Ramadan — special UI active" : "Islamic calendar" })
      ] }),
      C > 0 ? /* @__PURE__ */ n("div", { class: "stat accent", children: [
        /* @__PURE__ */ n("span", { class: "label", children: "Mutashabihat" }),
        /* @__PURE__ */ n("strong", { class: "value", children: C }),
        /* @__PURE__ */ n("span", { class: "sub", children: "similar-ayah pairs to drill on this portion" })
      ] }) : null,
      _ > 0 ? /* @__PURE__ */ n("div", { class: "stat", children: [
        /* @__PURE__ */ n("span", { class: "label", children: "Family khatm" }),
        /* @__PURE__ */ n("strong", { class: "value", children: [
          _,
          /* @__PURE__ */ n("span", { style: { fontSize: "0.85rem", opacity: 0.55, fontWeight: 500 }, children: " / 30" })
        ] }),
        /* @__PURE__ */ n("span", { class: "sub", children: "juz the household has completed together" })
      ] }) : null,
      p ? /* @__PURE__ */ n("div", { class: "stat", children: [
        /* @__PURE__ */ n("span", { class: "label", children: "Sunnah window" }),
        /* @__PURE__ */ n("strong", { class: "value", style: { fontSize: "1.05rem" }, children: "Surah al-Kahf" }),
        /* @__PURE__ */ n("span", { class: "sub", children: "Thursday Maghrib → Friday Maghrib" })
      ] }) : null,
      X && X !== "unknown" ? /* @__PURE__ */ n("div", { class: "stat", children: [
        /* @__PURE__ */ n("span", { class: "label", children: "Next review" }),
        /* @__PURE__ */ n("strong", { class: "value", style: { fontSize: "1.05rem" }, children: qe(X) }),
        /* @__PURE__ */ n("span", { class: "sub", children: "FSRS-scheduled · soonest unlocked portion" })
      ] }) : null,
      z && z !== "unknown" ? /* @__PURE__ */ n("div", { class: "stat", children: [
        /* @__PURE__ */ n("span", { class: "label", children: "Last rated" }),
        /* @__PURE__ */ n("strong", { class: "value", style: { fontSize: "1.05rem" }, children: qe(z) }),
        /* @__PURE__ */ n("span", { class: "sub", children: "most recent activity in this household" })
      ] }) : null,
      I && I !== "unknown" && I !== "—" ? /* @__PURE__ */ n("div", { class: "stat accent", children: [
        /* @__PURE__ */ n("span", { class: "label", children: "Weakest page" }),
        /* @__PURE__ */ n("strong", { class: "value", children: I }),
        /* @__PURE__ */ n("span", { class: "sub", children: "most unresolved-mistake page · drill it next" })
      ] }) : null,
      He && Number.isFinite(Z) ? /* @__PURE__ */ n("div", { class: "stat", children: [
        /* @__PURE__ */ n("span", { class: "label", children: "Daily quota" }),
        /* @__PURE__ */ n("strong", { class: "value", children: [
          Z,
          /* @__PURE__ */ n("span", { style: { fontSize: "0.85rem", opacity: 0.55, fontWeight: 500 }, children: [
            " ",
            Z === 1 ? "page" : "pages",
            "/day"
          ] })
        ] }),
        /* @__PURE__ */ n("span", { class: "sub", children: "tune from any number-card · or open Nahaj to set per plan →" })
      ] }) : null
    ] }),
    h ? /* @__PURE__ */ n("section", { class: "ramadan-strip", "aria-label": "Ramadan day shape", children: [
      /* @__PURE__ */ n("div", { class: "ramadan-pill-row", children: [
        /* @__PURE__ */ n("span", { class: "phase-pill phase-" + m, children: m === "suhoor" ? "سُحُور · Suhoor" : m === "iftar" ? "إِفْطَار · Iftar" : m === "taraweeh" ? "تَرَاوِيح · Taraweeh" : m === "odd_night" ? "لَيْلَة · Odd night" : "يَوْم · Day" }),
        c ? /* @__PURE__ */ n("span", { class: "last-ten-pill", children: "Last ten nights · Laylat al-Qadr awareness" }) : null
      ] }),
      /* @__PURE__ */ n("p", { class: "ramadan-hint", children: [
        "Lighting + audio scenes follow this phase automatically when the",
        /* @__PURE__ */ n("code", { children: " Ramadan-scenes " }),
        "blueprint is installed."
      ] })
    ] }) : null,
    s ? /* @__PURE__ */ n("section", { class: "prayer-strip", "aria-live": "polite", children: [
      /* @__PURE__ */ n("span", { class: "prayer-dot", "aria-hidden": !0 }),
      "Prayer window active — Hifdh sessions paused, audio quiet, automations dimmed"
    ] }) : null,
    /* @__PURE__ */ n("section", { class: "row-section", children: [
      /* @__PURE__ */ n("h2", { children: "Currently" }),
      /* @__PURE__ */ n("div", { class: "row-card", children: [
        /* @__PURE__ */ n("div", { class: "row", children: [
          /* @__PURE__ */ n("span", { children: [
            /* @__PURE__ */ n("span", { class: "label", children: [
              A ? /* @__PURE__ */ n("span", { class: "live-dot", "aria-hidden": !0 }) : null,
              "Reciting now"
            ] }),
            /* @__PURE__ */ n("span", { class: "hint", children: A ? "Audio is flowing through your speakers" : "No active recitation" })
          ] }),
          /* @__PURE__ */ n("span", { class: "value" + (A ? "" : " idle"), children: A ? y(o.currentVerse, "in progress") : "idle" })
        ] }),
        /* @__PURE__ */ n("div", { class: "row", children: [
          /* @__PURE__ */ n("span", { children: [
            /* @__PURE__ */ n("span", { class: "label", children: [
              T ? /* @__PURE__ */ n("span", { class: "live-dot", "aria-hidden": !0 }) : null,
              "Hifdh session"
            ] }),
            /* @__PURE__ */ n("span", { class: "hint", children: "Family-private practice mode" })
          ] }),
          /* @__PURE__ */ n("span", { class: "value" + (T ? "" : " idle"), children: T ? "in session" : "inactive" })
        ] }),
        /* @__PURE__ */ n("div", { class: "row", children: [
          /* @__PURE__ */ n("span", { class: "label", children: "Active reciter" }),
          /* @__PURE__ */ n("span", { class: "value", children: y(o.activeReciter, "—") })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ n("section", { class: "row-section", children: [
      /* @__PURE__ */ n("h2", { children: "Quick actions" }),
      /* @__PURE__ */ n("div", { class: "row-card", style: { padding: "1.3rem 1.4rem 1.4rem" }, children: [
        /* @__PURE__ */ n("p", { class: "empty", style: { marginTop: 0 }, children: "Trigger a session right from the panel, or tap “Open Nahaj” for the full reader, study, and listen surfaces." }),
        /* @__PURE__ */ n("div", { class: "actions", children: [
          /* @__PURE__ */ n(
            "button",
            {
              type: "button",
              class: "nahaj",
              onClick: () => {
                je(e, "start_memorization_session", {});
              },
              children: "Start memorization session"
            }
          ),
          /* @__PURE__ */ n(
            "button",
            {
              type: "button",
              class: "nahaj gold",
              onClick: () => {
                je(e, "play_surah", {
                  surah: 1,
                  target: "media_player.nahaj"
                });
              },
              children: "Play Al-Fātiḥa"
            }
          ),
          /* @__PURE__ */ n(
            "button",
            {
              type: "button",
              class: "nahaj secondary",
              onClick: () => {
                i("/nahaj");
              },
              children: "Open Nahaj →"
            }
          ),
          /* @__PURE__ */ n(
            "button",
            {
              type: "button",
              class: "nahaj secondary",
              onClick: () => {
                i("/mushaf/tajweed/1");
              },
              children: "Open tajweed mushaf →"
            }
          )
        ] })
      ] })
    ] }),
    /* @__PURE__ */ n("section", { class: "row-section", children: [
      /* @__PURE__ */ n("h2", { children: "Explore" }),
      /* @__PURE__ */ n("div", { class: "row-card", style: { padding: "1.3rem 1.4rem 1.4rem" }, children: [
        /* @__PURE__ */ n("p", { class: "empty", style: { marginTop: 0 }, children: "New editorial surfaces shipped across mobile + web. Each opens in a new tab in the standalone Nahaj app — family-private, synced to your account." }),
        /* @__PURE__ */ n("div", { class: "actions", children: [
          /* @__PURE__ */ n(
            "button",
            {
              type: "button",
              class: "nahaj gold",
              onClick: () => {
                i("/verse-of-day");
              },
              children: "Verse of the day →"
            }
          ),
          /* @__PURE__ */ n(
            "button",
            {
              type: "button",
              class: "nahaj secondary",
              onClick: () => {
                i("/asma-ul-husna");
              },
              children: "99 Names of Allah →"
            }
          ),
          /* @__PURE__ */ n(
            "button",
            {
              type: "button",
              class: "nahaj secondary",
              onClick: () => {
                i("/playlists");
              },
              children: "Audio playlists →"
            }
          ),
          /* @__PURE__ */ n(
            "button",
            {
              type: "button",
              class: "nahaj secondary",
              onClick: () => {
                i("/grammar");
              },
              children: "Grammar primer →"
            }
          ),
          /* @__PURE__ */ n(
            "button",
            {
              type: "button",
              class: "nahaj secondary",
              onClick: () => {
                i("/roots");
              },
              children: "Roots concordance →"
            }
          ),
          /* @__PURE__ */ n(
            "button",
            {
              type: "button",
              class: "nahaj secondary",
              onClick: () => {
                i("/bookmarks");
              },
              children: "Bookmarks · Stars · Notes →"
            }
          )
        ] })
      ] })
    ] }),
    /* @__PURE__ */ n("section", { class: "row-section", children: [
      /* @__PURE__ */ n("h2", { children: "Linked entities" }),
      /* @__PURE__ */ n("div", { class: "row-card", children: [
        /* @__PURE__ */ n("div", { class: "row entity", children: [
          /* @__PURE__ */ n("span", { class: "label", children: "media_player.nahaj" }),
          /* @__PURE__ */ n("span", { class: "value", children: y(o.mediaPlayer, "idle") })
        ] }),
        /* @__PURE__ */ n("div", { class: "row entity", children: [
          /* @__PURE__ */ n("span", { class: "label", children: "select.nahaj_reciter" }),
          /* @__PURE__ */ n("span", { class: "value", children: y(o.reciterSelect, "—") })
        ] }),
        /* @__PURE__ */ n("div", { class: "row entity", children: [
          /* @__PURE__ */ n("span", { class: "label", children: "select.nahaj_mushaf" }),
          /* @__PURE__ */ n("span", { class: "value", children: y(o.mushafSelect, "—") })
        ] }),
        /* @__PURE__ */ n("div", { class: "row entity", children: [
          /* @__PURE__ */ n("span", { class: "label", children: "binary_sensor.nahaj_in_session" }),
          /* @__PURE__ */ n("span", { class: "value", children: y(o.inSession, "off") })
        ] }),
        /* @__PURE__ */ n("div", { class: "row entity", children: [
          /* @__PURE__ */ n("span", { class: "label", children: "binary_sensor.nahaj_is_reciting" }),
          /* @__PURE__ */ n("span", { class: "value", children: y(o.isReciting, "off") })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ n("footer", { class: "nahaj-footer", children: [
      /* @__PURE__ */ n("span", { class: "smallcaps-foot", children: "Nahaj" }),
      "Audio never leaves the device. Family-private. The panel surfaces only sensors HA already exposes — no extra fetches, no third-party calls (per ADR-0005)."
    ] })
  ] });
}
function ke(e) {
  if (!e || e === "—" || e === "unknown" || e === "unavailable") return "—";
  try {
    const a = new Date(e);
    return Number.isNaN(a.getTime()) ? e : a.toLocaleTimeString(void 0, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return e;
  }
}
function qe(e) {
  if (!e || e === "—" || e === "unknown" || e === "unavailable") return "—";
  try {
    const a = new Date(e);
    if (Number.isNaN(a.getTime())) return e;
    const r = 1440 * 60 * 1e3, t = Math.round((a.getTime() - Date.now()) / r);
    return t === 0 ? "today" : t === 1 ? "tomorrow" : t === -1 ? "yesterday" : t > 1 && t < 7 ? `in ${String(t)}d` : t >= 7 && t < 30 ? `in ${String(Math.round(t / 7))}w` : t >= 30 ? `in ${String(Math.round(t / 30))}mo` : t < -1 && t > -7 ? `${String(Math.abs(t))}d ago` : t <= -7 && t > -30 ? `${String(Math.round(Math.abs(t) / 7))}w ago` : `${String(Math.round(Math.abs(t) / 30))}mo ago`;
  } catch {
    return e;
  }
}
function je(e, a, r) {
  e && e.callService?.("nahaj", a, r);
}
class ta extends HTMLElement {
  _hass;
  _narrow = !1;
  _panel;
  /** HA writes this on every WebSocket update. */
  set hass(a) {
    this._hass = a, this.render();
  }
  get hass() {
    return this._hass;
  }
  set narrow(a) {
    this._narrow = a, this.render();
  }
  get narrow() {
    return this._narrow;
  }
  /** HA writes this once on mount and again on config-entry update. */
  set panel(a) {
    this._panel = a, this.render();
  }
  get panel() {
    return this._panel;
  }
  connectedCallback() {
    this.shadowRoot || this.attachShadow({ mode: "open" }), this.render();
  }
  render() {
    if (!this.shadowRoot) return;
    const a = this._panel?.config?.nahaj?.web_url;
    Qe(
      /* @__PURE__ */ n(na, { hass: this._hass, narrow: this._narrow, webUrl: a }),
      this.shadowRoot
    );
  }
}
customElements.get("nahaj-panel") || customElements.define("nahaj-panel", ta);
//# sourceMappingURL=nahaj-panel.js.map
