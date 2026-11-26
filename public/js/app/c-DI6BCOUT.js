import{a as d,d as r,e as t,f as a,s as o}from"./c-GRGDXCIO.js";function l(s){return[`Hi EOS, I just placed order ${s.orderNumber}.`,"",...s.items.map(n=>`- ${n.quantity} x ${n.title}${n.variant?` (${n.variant})`:""}: ${a(n.price*n.quantity)}`),"",`Subtotal: ${a(s.subtotal)}`,s.discount?`Discount${s.discountCode?` (${s.discountCode})`:""}: -${a(s.discount)}`:null,`Delivery (${s.shippingZone||"my state"}): ${s.shipping===null||s.shipping===void 0?"to confirm":a(s.shipping)}`,`Total: ${a(s.total)}${s.shipping===null||s.shipping===void 0?" + delivery":""}`,"",`Name: ${s.customer.name}`,`Delivery to: ${s.customer.city}, ${s.customer.state}`,"","Please send payment details to confirm."].filter(n=>n!==null).join(`
`)}function c(){let s=d("[data-success-body]"),e=null;try{e=JSON.parse(sessionStorage.getItem("eos:lastOrder")||"null")}catch{}let n=new URLSearchParams(location.search).get("o");if(!e||n&&e.orderNumber.replace("#","")!==n.replace("#","")){s.innerHTML=`<p>${n?`Your order <strong>#${t(n.replace("#",""))}</strong> is with us.`:"Your order is with us."} Message us on WhatsApp to confirm payment and delivery.</p>
      <div class="success__actions"><a class="btn btn--blood" href="${o(`Hi EOS, I placed order ${n?`#${n.replace("#","")}`:""} on the site.`)}" target="_blank" rel="noopener"><svg class="btn__icon"><use href="#i-whatsapp"/></svg><span>Confirm on WhatsApp</span></a><a class="link-arrow" href="/track">Track an order <svg><use href="#i-arrow"/></svg></a></div>`;return}let p=r.settings.payment&&r.settings.payment.instructions||"";s.innerHTML=`
    <div class="order-no"><span>Order</span><strong>${t(e.orderNumber)}</strong></div>
    <p class="lede">Thank you, ${t(e.customer.name.split(" ")[0])}. Your pieces are held for you.</p>
    <p>${t(p)}</p>
    <ol class="success__steps">
      <li><span>Tap <strong>Confirm on WhatsApp</strong>. Your order details are already written for you.</span></li>
      <li><span>We reply with payment details${e.shipping===null||e.shipping===void 0?" and your delivery fee":""}.</span></li>
      <li><span>Once payment is confirmed, your order is packed and sent to ${t(e.customer.city)}, ${t(e.customer.state)}.</span></li>
    </ol>
    <dl class="totals">
      ${e.items.map(i=>`<div><dt>${i.quantity} \xD7 ${t(i.title)}${i.variant?` (${t(i.variant)})`:""}</dt><dd>${a(i.price*i.quantity)}</dd></div>`).join("")}
      ${e.discount?`<div><dt>Discount${e.discountCode?` (${t(e.discountCode)})`:""}</dt><dd>-${a(e.discount)}</dd></div>`:""}
      <div class="${e.shipping===null||e.shipping===void 0?"is-muted":""}"><dt>Delivery</dt><dd>${e.shipping===null||e.shipping===void 0?"Delivery fee confirmed on WhatsApp":a(e.shipping)}</dd></div>
      <div class="is-total"><dt>Total</dt><dd>${a(e.total)}</dd></div>
    </dl>
    <div class="success__actions">
      <a class="btn btn--blood" href="${o(l(e))}" target="_blank" rel="noopener"><svg class="btn__icon"><use href="#i-whatsapp"/></svg><span>Confirm on WhatsApp</span></a>
      <a class="link-arrow" href="/track?o=${encodeURIComponent(e.orderNumber.replace("#",""))}">Track this order <svg><use href="#i-arrow"/></svg></a>
    </div>`}export{c as default,l as whatsappMessage};
//# sourceMappingURL=c-DI6BCOUT.js.map
